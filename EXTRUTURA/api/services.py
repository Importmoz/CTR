import pandas as pd
import random
import numpy as np
import io
import os
import shutil
import asyncio
from PIL import Image, ImageChops
from html2image import Html2Image
from datetime import datetime

from core.whatsapp import upload_whatchimp_media, send_whatchimp_template
from core.data_processor import process_and_clean_data, export_with_formatting, get_bank_info
from core.media_generator import generate_html_table, get_message_template
from core.database import save_session, save_setting, get_setting
from core.logger import get_logger

hti = Html2Image(custom_flags=['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu'])

async def process_excel_bg(df, id_ctr, origin_sel, loading_date, expected_date, payment_deadline, dist_mode, filipe_target, progress_callback):
    try:
        get_logger("BackgroundProcessor").info(f"Iniciando processamento background para {id_ctr}")
        save_setting(f"proc_status_{id_ctr}", "running")
        
        await progress_callback(5, 100, "Limpando e formatando dados...")
        
        if 'USERNAME' in df.columns:
            df = df.drop('USERNAME', axis=1)
        df = df.dropna(axis=1, how='all')
        df = df.loc[:, ~df.columns.astype(str).str.match(r'^Unnamed')]
        
        new_columns = [
            "NO", "ID CODE", "CONSIGNEE", "PHONE NUMBER", "ORDER NUMBER", 
            "ITEM NAME", "CBM", "UNIT CBM FREIGHT", "AMOUNT FREIGHT", 
            "RECEIVED FREIGHT", "UNIT CBM DUTY", "AMOUNT DUTY", "DUTY PREPAID", 
            "PKGS", "PM", "PD", "AGENT"
        ]
        if len(df.columns) > len(new_columns):
            df = df.iloc[:, :len(new_columns)]
        elif len(df.columns) < len(new_columns):
            for i in range(len(new_columns) - len(df.columns)):
                df[f'_PAD_{i}'] = ''
        df.columns = new_columns
        df = df.iloc[:-4]
        
        try:
            mask_artifact = df.astype(str).apply(
                lambda row: row.str.contains('STILL SHORT FREIGHT BALANCE', case=False, na=False).any(),
                axis=1
            )
            if mask_artifact.any():
                df = df[~mask_artifact].reset_index(drop=True)
        except Exception:
            pass
            
        df['ID CODE'] = df['ID CODE'].ffill()
        for col in ["NO", "CONSIGNEE", "PHONE NUMBER"]:
            df[col] = df.groupby('ID CODE')[col].ffill()
        df[["NO", "CONSIGNEE", "PHONE NUMBER"]] = df[["NO", "CONSIGNEE", "PHONE NUMBER"]].fillna('')
        
        df["AMOUNT DUTY"] = pd.to_numeric(df["AMOUNT DUTY"], errors='coerce')
        df["DUTY PREPAID"] = pd.to_numeric(df["DUTY PREPAID"], errors='coerce')
        df["AMOUNT DUTY"] = np.where(df["AMOUNT DUTY"].isna(), 0, df["AMOUNT DUTY"])
        df["DUTY PREPAID"] = np.where(df["DUTY PREPAID"].isna(), 0, df["DUTY PREPAID"])
        df["TOTAL_AMOUNT"] = df["AMOUNT DUTY"] - df["DUTY PREPAID"]
        
        df_submitted = df.drop(columns=['TOTAL_AMOUNT'], errors='ignore')
        
        await progress_callback(15, 100, "Gerando distribuição de valores...")
        
        column_mapping = {
            "NO": "LIST_CODE",
            "ID CODE": "ID_CODE",
            "CONSIGNEE": "NAME",
            "PHONE NUMBER": "PHONE_NUMBER",
            "ORDER NUMBER": "ORDER_NUMBER",
            "ITEM NAME": "CARGO_DESCRIPTION",
            "CBM": "CBM",
            "UNIT CBM DUTY": "UNIT_CBM",
            "PKGS": "PACKAGES"
        }
        cols_to_export = list(column_mapping.keys()) + ["TOTAL_AMOUNT"]
        df_export = df[cols_to_export].rename(columns=column_mapping)
        df_export['CBM'] = pd.to_numeric(df_export['CBM'], errors='coerce').fillna(0)
        df_export['PACKAGES'] = pd.to_numeric(df_export['PACKAGES'], errors='coerce').fillna(0)
        
        group_sums = df_export.groupby('ID_CODE')['TOTAL_AMOUNT'].sum().reset_index()
        group_sums = group_sums.sort_values('TOTAL_AMOUNT', ascending=False).reset_index(drop=True)
        selected_ids = []
        if dist_mode == "FILIPE":
            selected_ids = df_export['ID_CODE'].unique().tolist()
        elif dist_mode == "JUPITER":
            selected_ids = []
        elif dist_mode == "Meta FILIPE":
            target_min = filipe_target
            target_max = filipe_target + 10_000
            shuffled_indices = list(group_sums.index)
            random.shuffle(shuffled_indices)
            current_sum = 0
            for idx in shuffled_indices:
                candidate_id = group_sums.loc[idx, 'ID_CODE']
                candidate_sum = group_sums.loc[idx, 'TOTAL_AMOUNT']
                if current_sum + candidate_sum <= target_max:
                    selected_ids.append(candidate_id)
                    current_sum += candidate_sum
                    if current_sum >= target_min:
                        break
            if current_sum < target_min and len(shuffled_indices) > len(selected_ids):
                remaining = group_sums[~group_sums['ID_CODE'].isin(selected_ids)]
                if not remaining.empty:
                    selected_ids.append(remaining.iloc[0]['ID_CODE'])
        else:
            target_min = 200_000
            target_max = 210_000
            shuffled_indices = list(group_sums.index)
            random.shuffle(shuffled_indices)
            current_sum = 0
            for idx in shuffled_indices:
                candidate_id = group_sums.loc[idx, 'ID_CODE']
                candidate_sum = group_sums.loc[idx, 'TOTAL_AMOUNT']
                if current_sum + candidate_sum <= target_max:
                    selected_ids.append(candidate_id)
                    current_sum += candidate_sum
                    if current_sum >= target_min:
                        break
            if current_sum < target_min and len(shuffled_indices) > len(selected_ids):
                remaining = group_sums[~group_sums['ID_CODE'].isin(selected_ids)]
                if not remaining.empty:
                    selected_ids.append(remaining.iloc[0]['ID_CODE'])
                    
        df_export['BANK_IN'] = df_export['ID_CODE'].apply(lambda x: "FILIPE" if x in selected_ids else "JUPITER")
        
        await progress_callback(25, 100, "A preparar ficheiros em disco...")
        
        db_root = "db"
        id_ctr_root = os.path.join(db_root, id_ctr)
        pagamentos_root = os.path.join(id_ctr_root, "PAGAMENTOS")
        info_dir = os.path.join(pagamentos_root, "info")
        
        if os.path.exists(id_ctr_root):
            shutil.rmtree(id_ctr_root)
        os.makedirs(info_dir, exist_ok=True)
        
        detailed_data_bg, _ = process_and_clean_data(df_submitted)
        formatted_list_path = export_with_formatting(detailed_data_bg, id_ctr)
        if os.path.exists(formatted_list_path):
            shutil.copy(formatted_list_path, os.path.join(pagamentos_root, f"Lista_{id_ctr}.xlsx"))
            
        container_number = f"{id_ctr}TH"
        seen_ids = set()
        queue = []
        
        unique_ids = df_export['ID_CODE'].unique()
        total_clients = len(unique_ids)
        
        await progress_callback(30, 100, f"Gerando imagens para {total_clients} clientes...")
        
        for idx, id_code in enumerate(unique_ids):
            client_orders = df_export[df_export['ID_CODE'] == id_code].to_dict(orient='records')
            
            first_order = client_orders[0]
            name = first_order['NAME']
            list_code = first_order['LIST_CODE']
            if isinstance(list_code, float):
                list_code = int(list_code)
            list_code = str(list_code)
            id_code_str = str(int(id_code)) if isinstance(id_code, float) else str(id_code)
            phone = first_order['PHONE_NUMBER']
            bank = first_order['BANK_IN']
            
            combined_orders_str = " / ".join([str(o['ORDER_NUMBER']) for o in client_orders])
            combined_cbm = sum(o['CBM'] for o in client_orders)
            combined_pkgs = sum(o['PACKAGES'] for o in client_orders)
            combined_cargo = ", ".join(set([str(o['CARGO_DESCRIPTION']) for o in client_orders]))
            combined_total = sum(o['TOTAL_AMOUNT'] for o in client_orders)
            
            dir_name = f"{list_code}-{str(name).replace(' ', '_')}"
            client_dir = os.path.join(pagamentos_root, dir_name)
            os.makedirs(client_dir, exist_ok=True)
            
            bank_info = get_bank_info(bank)
            payment_deadline_str = payment_deadline.strftime("%Y-%m-%d") if payment_deadline else expected_date.strftime("%Y-%m-%d")
            msg = get_message_template(
                origin_sel, name, list_code, id_code_str, phone, combined_orders_str,
                container_number, loading_date.strftime("%Y-%m-%d"), expected_date.strftime("%Y-%m-%d"),
                payment_deadline_str, combined_cbm, combined_pkgs, combined_cargo, combined_total, bank_info
            )
            md_filename = f"{id_code_str}-{id_ctr}.md"
            with open(os.path.join(info_dir, md_filename), "w", encoding="utf-8") as f:
                f.write(msg)
            with open(os.path.join(client_dir, md_filename), "w", encoding="utf-8") as f:
                f.write(msg)
                
            html_table = generate_html_table(client_orders, container_number, bank_info)
            img_filename = f"{id_code_str}-{id_ctr}.png"
            hti.output_path = info_dir
            
            # Executar html2image de forma sincrona mas evitar travar o event loop
            await asyncio.to_thread(hti.screenshot, html_str=html_table, save_as=img_filename, size=(1200, 2000))
            
            img_path = os.path.join(info_dir, img_filename)
            try:
                with Image.open(img_path) as img:
                    img_rgb = img.convert("RGB")
                    bg = Image.new(img_rgb.mode, img_rgb.size, img_rgb.getpixel((0,0)))
                    diff = ImageChops.difference(img_rgb, bg)
                    bbox = diff.getbbox()
                    if bbox:
                        margin = 15
                        left, top, right, bottom = bbox
                        cropped = img.crop((max(0, left-margin), max(0, top-margin), min(img.width, right+margin), min(img.height, bottom+margin)))
                        cropped.save(img_path)
                        cropped.save(os.path.join(client_dir, img_filename))
            except: pass
            
            queue.append({
                "list_code": str(list_code),
                "id_code": id_code_str,
                "name": name,
                "phone": str(phone).replace(".0", ""),
                "img_path": img_path,
                "msg": msg,
                "template_data": {
                    "templateVariable-NomeDoCliente-1": name,
                    "templateVariable-OrigemDaCarga-2": origin_sel,
                    "templateVariable-ListCode-3": str(list_code),
                    "templateVariable-IdCode-4": id_code_str,
                    "templateVariable-OrderNumber-5": combined_orders_str,
                    "templateVariable-ContainerNumber-6": container_number,
                    "templateVariable-LoadingDate-7": loading_date.strftime("%Y-%m-%d"),
                    "templateVariable-PrevisaoChegada-8": expected_date.strftime("%Y-%m-%d"),
                    "templateVariable-Cbm-9": f"{combined_cbm:.2f}",
                    "templateVariable-Packages-10": str(combined_pkgs),
                    "templateVariable-DescricaoDaCarga-11": combined_cargo,
                    "templateVariable-ValorAPagar-12": f"{combined_total:,.2f}",
                    "templateVariable-DataLimite-13": payment_deadline_str,
                    "bank": bank,
                    "is_paid": combined_total == 0
                },
                "status": "Pendente",
                "error": ""
            })
            
            percent = 30 + int(70 * (idx + 1) / total_clients)
            await progress_callback(percent, 100, f"Processado {idx + 1} de {total_clients}: {name}")
            
        save_session(id_ctr, queue)
        shutil.make_archive(id_ctr_root, 'zip', id_ctr_root)
        save_setting(f"proc_status_{id_ctr}", "completed")
        get_logger("BackgroundProcessor").info(f"Processamento concluído com sucesso para {id_ctr}")
        await progress_callback(100, 100, "Concluído!")
        
    except Exception as e:
        save_setting(f"proc_status_{id_ctr}", f"error: {e}")
        get_logger("BackgroundProcessor").error(f"Erro no processamento background de {id_ctr}: {e}")
        await progress_callback(100, 100, f"Erro: {str(e)}")

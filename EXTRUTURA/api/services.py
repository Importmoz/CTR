import pandas as pd
import random
import numpy as np
import io
import os
import shutil
import asyncio
import requests
from PIL import Image, ImageChops
from html2image import Html2Image
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from core.whatsapp import upload_whatchimp_media, send_whatchimp_template
from core.data_processor import process_and_clean_data, export_with_formatting, get_bank_info
from core.media_generator import generate_html_table, get_message_template
from core.database import save_session, save_setting, get_setting
from core.logger import get_logger

hti = Html2Image(custom_flags=['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu', '--disable-dbus', '--disable-dev-shm-usage', '--log-level=3', '--silent'])

async def process_excel_bg(df, id_ctr, origin_sel, dest_sel, loading_date, expected_date, payment_deadline, dist_mode, filipe_target, progress_callback, send_whatsapp=False):
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
        if dist_mode in ["FILIPE", "Tudo para FILIPE"]:
            selected_ids = df_export['ID_CODE'].unique().tolist()
        elif dist_mode in ["JUPITER", "Tudo para JUPITER"]:
            selected_ids = []
        elif dist_mode in ["Meta FILIPE", "Meta FILIPE (valor desejado)"]:
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
        
        export_columns_order = [
            "LIST_CODE", "ID_CODE", "NAME", "PHONE_NUMBER", "ORDER_NUMBER",
            "CARGO_DESCRIPTION", "CBM", "UNIT_CBM", "TOTAL_AMOUNT", "PACKAGES", "BANK_IN"
        ]
        df_export = df_export[export_columns_order]
        
        info_columns = ["ID_CTR", "ORIGEM", "LOADING", "EXPECTED", "LIMITE"]
        df_info = pd.DataFrame([{
            "ID_CTR": id_ctr,
            "ORIGEM": origin_sel,
            "LOADING": loading_date.strftime("%Y-%m-%d") if loading_date else "",
            "EXPECTED": expected_date.strftime("%Y-%m-%d") if expected_date else "",
            "LIMITE": payment_deadline.strftime("%Y-%m-%d") if payment_deadline else ""
        }])
        
        output_genlist = io.BytesIO()
        with pd.ExcelWriter(output_genlist, engine='xlsxwriter') as writer2:
            df_export.to_excel(writer2, index=False, sheet_name='JUPITER')
            df_info.to_excel(writer2, index=False, sheet_name='INFO')
            workbook2 = writer2.book
            worksheet_jupiter = writer2.sheets['JUPITER']
            center_format_jup = workbook2.add_format({'align': 'center', 'valign': 'vcenter'})
            for i, col in enumerate(df_export.columns):
                max_len = max(df_export[col].fillna('').astype(str).map(len).max(), len(col)) + 1
                worksheet_jupiter.set_column(i, i, max_len, center_format_jup)
            merge_cols_gen = ['LIST_CODE', 'ID_CODE', 'NAME', 'PHONE_NUMBER']
            merge_indices_gen = [df_export.columns.get_loc(col) for col in merge_cols_gen if col in df_export.columns]
            current_values_gen = {idx: None for idx in merge_indices_gen}
            start_rows_gen = {idx: 1 for idx in merge_indices_gen}
            for row_idx in range(len(df_export)):
                excel_row = row_idx + 1
                for col_idx in merge_indices_gen:
                    cell_value = str(df_export.iloc[row_idx, col_idx])
                    if current_values_gen[col_idx] != cell_value:
                        if current_values_gen[col_idx] is not None and start_rows_gen[col_idx] < excel_row:
                            worksheet_jupiter.merge_range(start_rows_gen[col_idx], col_idx, excel_row - 1, col_idx, current_values_gen[col_idx], center_format_jup)
                        current_values_gen[col_idx] = cell_value
                        start_rows_gen[col_idx] = excel_row
            for col_idx in merge_indices_gen:
                if current_values_gen[col_idx] is not None and start_rows_gen[col_idx] < len(df_export) + 1:
                    worksheet_jupiter.merge_range(start_rows_gen[col_idx], col_idx, len(df_export), col_idx, current_values_gen[col_idx], center_format_jup)
            
            worksheet_info = writer2.sheets['INFO']
            center_format_info = workbook2.add_format({'align': 'center', 'valign': 'vcenter'})
            for i, col in enumerate(df_info.columns):
                max_len = max(df_info[col].fillna('').astype(str).map(len).max(), len(col)) + 1
                worksheet_info.set_column(i, i, max_len, center_format_info)
            
            last_row_jup = len(df_export)
            if last_row_jup > 0:
                worksheet_jupiter.data_validation(1, 10, last_row_jup, 10, {'validate': 'list', 'source': ['FILIPE', 'JUPITER', '?'], 'dropdown': True})
        output_genlist.seek(0)
        
        output_submitted = io.BytesIO()
        with pd.ExcelWriter(output_submitted, engine='xlsxwriter') as writer1:
            df_submitted.to_excel(writer1, index=False, sheet_name='Sheet1')
            workbook1 = writer1.book
            worksheet1 = writer1.sheets['Sheet1']
            center_format = workbook1.add_format({'align': 'center', 'valign': 'vcenter'})
            for i, col in enumerate(df_submitted.columns):
                max_len = max(df_submitted[col].fillna('').astype(str).map(len).max(), len(col)) + 1
                worksheet1.set_column(i, i, max_len, center_format)
            
            merge_cols = ['NO', 'ID CODE', 'CONSIGNEE', 'PHONE NUMBER']
            merge_indices = [df_submitted.columns.get_loc(col) for col in merge_cols if col in df_submitted.columns]
            current_values = {idx: None for idx in merge_indices}
            start_rows = {idx: 1 for idx in merge_indices}
            for row_idx in range(len(df_submitted)):
                excel_row = row_idx + 1
                for col_idx in merge_indices:
                    cell_value = str(df_submitted.iloc[row_idx, col_idx])
                    if current_values[col_idx] != cell_value:
                        if current_values[col_idx] is not None and start_rows[col_idx] < excel_row:
                            worksheet1.merge_range(start_rows[col_idx], col_idx, excel_row - 1, col_idx, current_values[col_idx], center_format)
                        current_values[col_idx] = cell_value
                        start_rows[col_idx] = excel_row
            for col_idx in merge_indices:
                if current_values[col_idx] is not None and start_rows[col_idx] < len(df_submitted) + 1:
                    worksheet1.merge_range(start_rows[col_idx], col_idx, len(df_submitted), col_idx, current_values[col_idx], center_format)
        output_submitted.seek(0)
        
        with open(os.path.join(id_ctr_root, f"SubmitedList_{id_ctr}.xlsx"), "wb") as f:
            f.write(output_submitted.getvalue())
        
        genlist_path = os.path.join(info_dir, f"{id_ctr}.xlsx")
        with open(genlist_path, "wb") as f:
            f.write(output_genlist.getvalue())
            
        detailed_data_bg, _ = process_and_clean_data(df_submitted)
        formatted_list_path = export_with_formatting(detailed_data_bg, id_ctr)
        if os.path.exists(formatted_list_path):
            shutil.copy(formatted_list_path, os.path.join(pagamentos_root, f"Lista_{id_ctr}.xlsx"))
            try:
                os.remove(formatted_list_path)
            except:
                pass
            
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
            
            import re
            safe_name = re.sub(r'[\\/*?:"<>|]', "", str(name)).strip()
            safe_list_code = re.sub(r'[\\/*?:"<>|]', "", str(list_code)).strip()
            dir_name = f"{safe_list_code}-{safe_name.replace(' ', '_')}"
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
                
            table_bank_info = None if combined_total == 0 else bank_info
            html_table = generate_html_table(client_orders, container_number, table_bank_info)
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
        
        # Sincronizar com Google Drive se configurado
        from api.google_drive import get_gdrive_service, create_folder, upload_file, create_local_gsheet_shortcut, upload_folder_recursive
        gdrive_service, gdrive_email = get_gdrive_service()
        if gdrive_service:
            await progress_callback(95, 100, "A sincronizar pasta com o Google Drive...")
            try:
                maputo_folder_id = "1KVePfb9KU4nKMIj-w9hta_iQ0euIJO5J"
                nacala_folder_id = "1KYlkMqXQaC25hxy4IaycI4HfvpQf2VAV"
                parent_id = nacala_folder_id if "NACALA" in str(dest_sel).upper() else maputo_folder_id
                
                ctr_folder_id = create_folder(gdrive_service, id_ctr, parent_id)
                pag_folder_id = create_folder(gdrive_service, "PAGAMENTOS", ctr_folder_id)
                if pag_folder_id:
                    save_setting(f"gdrive_folder_id_{id_ctr}", pag_folder_id)
                
                sheet_id = None
                # Sobe a Lista como GSheet
                lista_excel_path = os.path.join(pagamentos_root, f"Lista_{id_ctr}.xlsx")
                if os.path.exists(lista_excel_path):
                    sheet_id = upload_file(gdrive_service, lista_excel_path, f"Lista_{id_ctr}", pag_folder_id, convert_to_gsheet=True)
                    if sheet_id:
                        save_setting(f"gdrive_sheet_id_{id_ctr}", sheet_id)
                    gsheet_path = os.path.join(pagamentos_root, f"Lista_{id_ctr}.gsheet")
                    create_local_gsheet_shortcut(sheet_id, gsheet_path, gdrive_email)
                    os.remove(lista_excel_path)
                    
                # Sobe as restantes sub-pastas (imagens e mds)
                upload_folder_recursive(gdrive_service, pagamentos_root, pag_folder_id)
                
                # Grava no PocketBase na tabela confirm_projects
                try:
                    pb_base_url = os.getenv("POCKETBASE_URL", "http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io").rstrip("/")
                    pb_url = f"{pb_base_url}/api/collections/confirm_projects/records"
                    pb_payload = {
                        "name": id_ctr,
                        "sheetId": sheet_id or "",
                        "folderId": pag_folder_id or ""
                    }
                    pb_res = requests.post(pb_url, json=pb_payload, timeout=15)
                    if pb_res.status_code in [200, 201]:
                        get_logger("BackgroundProcessor").info(f"Registo em confirm_projects criado com sucesso no PocketBase para {id_ctr}")
                    else:
                        get_logger("BackgroundProcessor").warning(f"Falha ao criar registo no PocketBase (status {pb_res.status_code}): {pb_res.text}")
                except Exception as pb_err:
                    get_logger("BackgroundProcessor").error(f"Erro ao ligar ao PocketBase: {pb_err}")
                
            except Exception as e:
                get_logger("BackgroundProcessor").error(f"Erro no GDrive upload: {e}")
                
        shutil.make_archive(id_ctr_root, 'zip', root_dir=id_ctr_root, base_dir="PAGAMENTOS")
        save_setting(f"proc_status_{id_ctr}", "completed")
        get_logger("BackgroundProcessor").info(f"Processamento concluído com sucesso para {id_ctr}")
        
        if send_whatsapp:
            await progress_callback(99, 100, "A iniciar envio de WhatsApp em segundo plano...")
            from api.main import start_sending
            asyncio.create_task(start_sending(id_ctr=id_ctr, send_mode="normal"))

        sheet_id_res = get_setting(f"gdrive_sheet_id_{id_ctr}", "")
        folder_id_res = get_setting(f"gdrive_folder_id_{id_ctr}", "")
        await progress_callback(100, 100, "Concluído!", extra={"sheetId": sheet_id_res, "folderId": folder_id_res})
        
    except Exception as e:
        save_setting(f"proc_status_{id_ctr}", f"error: {e}")
        get_logger("BackgroundProcessor").error(f"Erro no processamento background de {id_ctr}: {e}")
        await progress_callback(100, 100, f"Erro: {str(e)}")

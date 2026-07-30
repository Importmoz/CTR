import streamlit as st
import threading

st.set_page_config(page_title="Processador CTR", page_icon="📦", layout="centered")

# --- Sistema de Login ---
if 'logged_in' not in st.session_state:
    st.session_state['logged_in'] = False

if not st.session_state['logged_in']:
    # Ocultar o sidebar nativo do Streamlit na página de login
    st.markdown("""
        <style>
            [data-testid="stSidebar"] {
                display: none;
            }
            .stButton > button {
                border-radius: 8px;
            }
        </style>
    """, unsafe_allow_html=True)
    
    # Criar colunas para centrar o login (espremendo a coluna central)
    col1, col_login, col3 = st.columns([1, 2, 1])
    
    with col_login:
        st.markdown("<h2 style='text-align: center; margin-bottom: 20px;'>🔒 Acesso Restrito</h2>", unsafe_allow_html=True)
        
        with st.form("login_form"):
            username = st.text_input("E-mail")
            password = st.text_input("Palavra-passe", type="password")
            submit_button = st.form_submit_button("Entrar", type="primary", use_container_width=True)
            
            if submit_button:
                if not username or not password:
                    st.error("Por favor, preencha o e-mail e a palavra-passe.")
                else:
                    pb_url = "http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io"
                    auth_endpoint = f"{pb_url}/api/collections/users/auth-with-password"
                    
                    try:
                        import requests
                        response = requests.post(auth_endpoint, json={
                            "identity": username,
                            "password": password
                        }, timeout=10)
                        
                        if response.status_code == 200:
                            data = response.json()
                            st.session_state['logged_in'] = True
                            st.session_state['user_data'] = data.get('record', {})
                            st.session_state['pb_token'] = data.get('token', '')
                            st.success("Login efetuado com sucesso!")
                            import time
                            time.sleep(1)
                            st.rerun()
                        else:
                            st.error("E-mail ou palavra-passe incorretos.")
                    except Exception as e:
                        st.error(f"Erro de comunicação com o servidor: {e}")
    st.stop() # Bloqueia o resto da aplicação de correr se não estiver logado

import pandas as pd
import random
import numpy as np
import io
import os
import shutil
import openpyxl
from PIL import Image, ImageChops
from datetime import datetime
from html2image import Html2Image
import requests
import time
import threading
from dotenv import load_dotenv

from core.whatsapp import upload_whatchimp_media, send_whatchimp_template
from core.data_processor import process_and_clean_data, export_with_formatting, get_bank_info
from core.media_generator import generate_html_table, get_message_template
from core.database import init_db, save_session, load_session, get_all_sessions, get_setting, save_setting, delete_session
from core.logger import get_logger

logger = get_logger("UI_App")



# Inicializar Base de Dados
init_db()

load_dotenv()
# Inicializa o conversor de HTML para Imagem
if not os.path.exists('db'):
    os.makedirs('db', exist_ok=True)
# Configuração para rodar Chromium dentro do Docker (sem interface gráfica e sem sandbox)
hti = Html2Image(custom_flags=['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu'])
import formater
# --- Fim das Funções Etapa 3 ---

import json

def save_queue_state():
    if 'message_queue' in st.session_state and 'id_ctr' in st.session_state:
        save_session(st.session_state['id_ctr'], st.session_state['message_queue'])



def reset_system():
    """Limpa arquivos gerados, session_state e cache."""
    # NÃO APAGA A PASTA DB, caso contrário perde-se o histórico e configurações.
    # Apenas apagar ficheiros temporários da raiz se houver.
    for item in os.listdir('.'):
        if item.endswith('.zip') or item.endswith('.xlsx'):
            if item.startswith('Lista_') or item.startswith('SubmitedList_') or item.endswith('.xlsx'):
                try:
                    os.remove(item)
                except:
                    pass
            
    # 3. Limpa session_state (Protegendo variáveis vitais)
    keys_to_keep = ['logged_in', 'id_ctr', 'message_queue', 'processed', 'user_data', 'pb_token']
    for key in list(st.session_state.keys()):
        if key not in keys_to_keep:
            del st.session_state[key]
        
    # 4. Limpar cache
    try:
        st.cache_data.clear()
        st.cache_resource.clear()
    except:
        pass
    
    st.rerun()

# --- Função de Processamento em Background ---
def process_excel_in_background(df, id_ctr, origin_sel, loading_date, expected_date, payment_deadline, dist_mode, filipe_target):
    try:
        get_logger("BackgroundProcessor").info(f"Iniciando processamento background para {id_ctr}")
        save_setting(f"proc_status_{id_ctr}", "running")
        
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
        
        group_sums = df_export.groupby('ID_CODE')['TOTAL_AMOUNT'].sum().reset_index()
        group_sums = group_sums.sort_values('TOTAL_AMOUNT', ascending=False).reset_index(drop=True)
        selected_ids = []
        if dist_mode == "Tudo para FILIPE":
            selected_ids = df_export['ID_CODE'].unique().tolist()
        elif dist_mode == "Tudo para JUPITER":
            selected_ids = []
        elif dist_mode == "Meta FILIPE (valor desejado)":
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
            last_row_jup = len(df_export)
            if last_row_jup > 0:
                worksheet_jupiter.data_validation(1, 10, last_row_jup, 10, {'validate': 'list', 'source': ['FILIPE', 'JUPITER', '?'], 'dropdown': True})
            worksheet_info = writer2.sheets['INFO']
            center_format_info = workbook2.add_format({'align': 'center'})
            for i, col in enumerate(info_columns):
                max_len = max(df_info[col].fillna('').astype(str).map(len).max(), len(col)) + 1
                worksheet_info.set_column(i, i, max_len, center_format_info)
        output_genlist.seek(0)
        
        # --- Criar pastas e arquivos no disco ---
        db_root = "db"
        id_ctr_root = os.path.join(db_root, id_ctr)
        pagamentos_root = os.path.join(id_ctr_root, "PAGAMENTOS")
        info_dir = os.path.join(pagamentos_root, "info")
        
        if os.path.exists(id_ctr_root):
            shutil.rmtree(id_ctr_root)
        os.makedirs(info_dir, exist_ok=True)
        
        genlist_path = os.path.join(info_dir, f"{id_ctr}.xlsx")
        with open(genlist_path, "wb") as f:
            f.write(output_genlist.getbuffer())
            
        detailed_data_bg, _ = process_and_clean_data(df_submitted)
        formatted_list_path = export_with_formatting(detailed_data_bg, id_ctr)
        if os.path.exists(formatted_list_path):
            shutil.copy(formatted_list_path, os.path.join(pagamentos_root, f"Lista_{id_ctr}.xlsx"))
            
        container_number = f"{id_ctr}TH"
        seen_ids = set()
        queue = []
        
        for _, row in df_export.iterrows():
            id_code = row['ID_CODE']
            if id_code in seen_ids:
                continue
            seen_ids.add(id_code)
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
            hti.screenshot(html_str=html_table, save_as=img_filename, size=(1200, 2000))
            
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
            save_session(id_ctr, queue)
            
        shutil.make_archive(id_ctr_root, 'zip', id_ctr_root)
        save_setting(f"proc_status_{id_ctr}", "completed")
        get_logger("BackgroundProcessor").info(f"Processamento concluído com sucesso para {id_ctr}")
    except Exception as e:
        save_setting(f"proc_status_{id_ctr}", f"error: {e}")
        get_logger("BackgroundProcessor").error(f"Erro no processamento background de {id_ctr}: {e}")

# Título do App
# (st.set_page_config movido para o topo)



# CSS para inputs mais compactos
st.markdown("""
<style>
    .stDateInput > div > div > input {
        padding: 4px 8px;
        font-size: 12px;
        width: 110px;
    }
    .stDateInput label {
        font-size: 11px;
    }
    .stSelectbox > div > div > div {
        padding: 6px 10px;
        font-size: 13px;
    }
    .stTextInput > div > div > input {
        padding: 6px 10px;
        font-size: 13px;
    }
    div[data-testid="stVerticalBlock"] > div > div {
        gap: 0.3rem;
    }
    .stSelectbox label, .stDateInput label {
        font-size: 11px !important;
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)
st.title("📦 Processador CTR")

page = st.radio("Navegação:", ["⚙️ Processador", "📊 Histórico e Relatórios", "📈 Dashboard", "⚙️ Configurações"], horizontal=True)

if page == "📈 Dashboard":
    st.subheader("📈 Dashboard de Analítica")
    st.markdown("Visão global de todos os envios realizados pela plataforma.")
    
    sessions = get_all_sessions()
    if not sessions:
        st.info("Ainda não há dados suficientes para gerar analítica.")
        st.stop()
        
    total_messages = 0
    total_success = 0
    total_error = 0
    
    for s in sessions:
        loaded_queue = load_session(s['id_ctr'])
        if loaded_queue:
            df_hist = pd.DataFrame(loaded_queue)
            total_messages += len(df_hist)
            total_success += len(df_hist[df_hist['status'] == 'Enviado'])
            total_error += len(df_hist[df_hist['status'] == 'Erro'])
            
    col1, col2, col3 = st.columns(3)
    col1.metric("Mensagens Totais", total_messages)
    col2.metric("Entregas de Sucesso", total_success)
    col3.metric("Falhas / Pendentes", total_error)
    
    # Gráfico simples nativo do Streamlit
    data = {'Estado': ['Sucesso', 'Falha/Pendente'], 'Quantidade': [total_success, total_error]}
    df_chart = pd.DataFrame(data).set_index('Estado')
    st.bar_chart(df_chart)
    
    st.stop()

if page == "⚙️ Configurações":
    st.subheader("⚙️ Configurações do Sistema")
    st.markdown("Altere os parâmetros do sistema sem precisar de alterar o código.")
    from core.database import get_setting, save_setting
    
    with st.expander("🔌 Chaves da API WhatsApp", expanded=True):
        with st.form("api_config_form"):
            api_token = st.text_input("WhatChimp API Token", value=get_setting('whatchimp_api_token', os.getenv('WHATCHIMP_API_TOKEN', '')), type="password")
            phone_id = st.text_input("WhatChimp Phone Number ID", value=get_setting('whatchimp_phone_id', os.getenv('WHATCHIMP_PHONE_ID', '')))
            if st.form_submit_button("Salvar API", use_container_width=True):
                save_setting('whatchimp_api_token', api_token)
                save_setting('whatchimp_phone_id', phone_id)
                st.success("Chaves guardadas na base de dados!")
                
    with st.expander("📄 Templates do WhatsApp"):
        with st.form("templates_form"):
            t_carga_pagar = st.text_input("Alerta Carga (A Pagar)", value=get_setting('template_alerta_carga_pagar', '409806'))
            t_carga_pago = st.text_input("Alerta Carga (Pago)", value=get_setting('template_alerta_carga_pago', '409807'))
            t_notas_pago = st.text_input("Notas (Carga Paga)", value=get_setting('template_notas_regras_pago', '409400'))
            t_notas_pagamento = st.text_input("Notas (Com Pagamento)", value=get_setting('template_notas_regras_pagamento', '409373'))
            t_banco_jup = st.text_input("Banco Jupiter", value=get_setting('template_banco_jupiter', '409374'))
            t_banco_fil = st.text_input("Banco Filipe", value=get_setting('template_banco_filipe', '409375'))
            t_lembrete_1 = st.text_input("Lembrete Part 1 (Detalhes e Localização)", value=get_setting('template_lembrete_1', '412705'))
            t_lembrete_2 = st.text_input("Lembrete Part 2 (Regras e Instruções)", value=get_setting('template_lembrete_2', '412707'))
            if st.form_submit_button("Salvar Templates", use_container_width=True):
                save_setting('template_alerta_carga_pagar', t_carga_pagar)
                save_setting('template_alerta_carga_pago', t_carga_pago)
                save_setting('template_notas_regras_pago', t_notas_pago)
                save_setting('template_notas_regras_pagamento', t_notas_pagamento)
                save_setting('template_banco_jupiter', t_banco_jup)
                save_setting('template_banco_filipe', t_banco_fil)
                save_setting('template_lembrete_1', t_lembrete_1)
                save_setting('template_lembrete_2', t_lembrete_2)
                st.success("Templates guardados!")
                
    with st.expander("🏦 Dados Bancários Padrão"):
        with st.form("banks_form"):
            bank_jup = st.text_area("Jupiter Logistics", height=150, value=get_setting('bank_info_jupiter', "Insira aqui os dados..."))
            bank_fil = st.text_area("Filipe Chitofo", height=100, value=get_setting('bank_info_filipe', "Insira aqui os dados..."))
            if st.form_submit_button("Salvar Bancos", use_container_width=True):
                save_setting('bank_info_jupiter', bank_jup)
                save_setting('bank_info_filipe', bank_fil)
                st.success("Dados bancários guardados!")
                
    with st.expander("⚠️ Zona de Perigo (Reset do Sistema)"):
        st.error("Atenção! Esta ação vai apagar todo o histórico de envios, configurações guardadas, pastas geradas e logs.")
        with st.form("reset_form"):
            auth_code = st.text_input("Código de Autorização", type="password")
            confirm_reset = st.checkbox("Tenho a certeza absoluta")
            if st.form_submit_button("🧨 RESET TOTAL", type="primary"):
                if auth_code == "792721" and confirm_reset:
                    try:
                        # 1. Limpa Base de Dados
                        import sqlite3
                        db_path = os.path.join("db", "ctr_database.db")
                        if os.path.exists(db_path):
                            conn = sqlite3.connect(db_path)
                            conn.execute("DROP TABLE IF EXISTS sessions")
                            conn.execute("DROP TABLE IF EXISTS settings")
                            conn.commit()
                            conn.close()
                        
                        init_db() # Reinicializa as tabelas vazias
                        
                        # 2. Limpa Logs
                        try:
                            import logging
                            # Fechar os processos que estão a prender o ficheiro de logs
                            for name, log_obj in logging.Logger.manager.loggerDict.items():
                                if isinstance(log_obj, logging.Logger):
                                    for handler in log_obj.handlers[:]:
                                        if isinstance(handler, logging.FileHandler):
                                            handler.close()
                                            log_obj.removeHandler(handler)
                                            
                            if os.path.exists("logs/erros_sistema.log"):
                                os.remove("logs/erros_sistema.log")
                        except Exception as log_e:
                            # Plano B: Esvaziar o ficheiro sem apagar
                            try:
                                with open("logs/erros_sistema.log", "w", encoding='utf-8') as f:
                                    f.write("")
                            except:
                                pass
                            
                        # 3. Limpa pastas geradas (ficheiros de clientes)
                        import glob
                        for ctr_folder in glob.glob("db/*"):
                            if os.path.isdir(ctr_folder):
                                shutil.rmtree(ctr_folder)
                                
                        # Limpa também arquivos temporários zipados
                        for zip_file in glob.glob("db/*.zip"):
                            os.remove(zip_file)
                            
                        # 4. Limpa session_state (mantendo a sessão de login do PocketBase)
                        keys_to_keep = ['logged_in', 'user_data', 'pb_token']
                        for key in list(st.session_state.keys()):
                            if key not in keys_to_keep:
                                del st.session_state[key]
                                
                        st.success("Limpeza profunda concluída! A reiniciar sistema...")
                        time.sleep(2)
                        st.rerun()
                    except Exception as e:
                        st.error(f"Erro ao executar o reset: {e}")
                else:
                    st.error("Código incorreto ou falta de confirmação na caixa.")
                    
    st.stop()

if page == "📊 Histórico e Relatórios":
    st.subheader("📊 Histórico de Envios (Base de Dados)")
    st.markdown("Aqui pode consultar todas as sessões anteriores e o estado final dos clientes.")
    
    sessions = get_all_sessions()
    if sessions:
        display_options = [""] + [f"{s['id_ctr']} (Atualizado a {s['updated_at']})" for s in sessions]
        selected_hist = st.selectbox("Selecione uma sessão para ver os detalhes:", display_options)
        
        if selected_hist:
            id_from_file = selected_hist.split(" (")[0]
            loaded_queue = load_session(id_from_file)
            
            if loaded_queue:
                df_hist = pd.DataFrame(loaded_queue)
                
                # Estatísticas rápidas
                col1, col2, col3 = st.columns(3)
                col1.metric("Total de Mensagens", len(df_hist))
                col2.metric("Enviados com Sucesso", len(df_hist[df_hist['status'] == 'Enviado']))
                col3.metric("Erros", len(df_hist[df_hist['status'] == 'Erro']))
                
                st.dataframe(df_hist[["list_code", "id_code", "name", "phone", "status", "error"]], use_container_width=True)
                
                col_csv, col_zip, col_del_h = st.columns([2, 2, 1])
                with col_csv:
                    csv = df_hist.to_csv(index=False).encode('utf-8')
                    st.download_button(
                        label="📥 Relatório (CSV)",
                        data=csv,
                        file_name=f"Relatorio_WhatsApp_{id_from_file}.csv",
                        mime="text/csv",
                        use_container_width=True,
                        key=f"btn_dl_csv_{id_from_file}"
                    )
                with col_zip:
                    zip_path_h = os.path.join("db", f"{id_from_file}.zip")
                    if os.path.exists(zip_path_h):
                        with open(zip_path_h, "rb") as f_zip:
                            zip_bytes_h = f_zip.read()
                        st.download_button(
                            label=f"📥 Baixar ZIP ({id_from_file}.zip)",
                            data=zip_bytes_h,
                            file_name=f"{id_from_file}.zip",
                            mime="application/zip",
                            use_container_width=True,
                            key=f"btn_dl_zip_hist_{id_from_file}"
                        )
                    else:
                        st.caption("Ficheiro ZIP não encontrado.")
                with col_del_h:
                    if st.button("🗑️ Apagar", use_container_width=True, type="secondary"):
                        if delete_session(id_from_file):
                            st.success(f"Sessão {id_from_file} apagada!")
                            time.sleep(1)
                            st.rerun()
                        else:
                            st.error("Erro ao apagar sessão.")
    else:
        st.info("Ainda não há dados no histórico.")
        
    st.stop() # Não processa o resto do código da página Processador

# Upload do arquivo (Continuação da página principal)
uploaded_file = st.file_uploader("📁 Escolha o arquivo Excel", type=["xlsx"], label_visibility="collapsed")
if uploaded_file is not None:
    try:
        # Carrega o arquivo Excel (sem processar ainda)
        df = pd.read_excel(uploaded_file, skiprows=3)
        # Validação: Verifica se a coluna "USERNAME" existe
        if 'USERNAME' not in df.columns:
            st.error("❌ Coluna 'USERNAME' não encontrada no arquivo.")
            st.stop()
        # --- Mostra formulário ANTES de processar ---
        st.markdown("---")
        st.subheader("📋 INFO")
        with st.form("info_form"):
            col1, col2 = st.columns([3, 1])
            with col1:
                id_ctr = st.text_input("ID_CTR*", placeholder="CTR001")
            with col2:
                origin_sel = st.selectbox("ORIGEM", ["CHINA", "DUBAI"], key="origin_sel_form")
            col_load, col_exp, col_lim, col_btn = st.columns(4)
            with col_load:
                loading_date = st.date_input("LOADING", help="Data carga")
            with col_exp:
                expected_date = st.date_input("EXPECTED", help="Data prevista")
            with col_lim:
                payment_deadline = st.date_input("LIMITE", help="Data limite")
            with col_btn:
                st.markdown("<div style='height: 1.76rem'></div>", unsafe_allow_html=True)
                submitted = st.form_submit_button("PROCESSAR", use_container_width=True)
            with st.expander("⚙️ CONFIGURAR"):
                dist_mode = st.radio(
                    "Modo de distribuição:",
                    [
                        "Padrão (lógica atual)",
                        "Tudo para FILIPE",
                        "Tudo para JUPITER",
                        "Meta FILIPE (valor desejado)"
                    ],
                    index=0,
                    key="dist_mode"
                )
                filipe_target = 200_000
                if dist_mode == "Meta FILIPE (valor desejado)":
                    filipe_target = st.number_input(
                        "Valor alvo para FILIPE (MT)",
                        min_value=0,
                        value=200_000,
                        step=10_000,
                        help="O sistema tentará alocar clientes para FILIPE próximo deste valor",
                        key="filipe_target"
                    )
            with st.expander("📱 Configurar WhatChimp (WhatsApp)"):
                send_whatsapp = st.checkbox("Activar Envio por WhatsApp", value=False, help="Se marcado, enviará as imagens geradas para os clientes automaticamente via WhatChimp.")
                # As credenciais agora são carregadas do arquivo .env
                whatchimp_api_token = get_setting("whatchimp_api_token", os.getenv("WHATCHIMP_API_TOKEN"))
                whatchimp_phone_id = get_setting("whatchimp_phone_id", os.getenv("WHATCHIMP_PHONE_ID"))
        if submitted:
            if not id_ctr or not id_ctr.strip():
                st.error("❌ O campo ID_CTR é obrigatório!")
                st.stop()
                
            id_ctr = id_ctr.strip()
            st.session_state['message_queue'] = []
            st.session_state['id_ctr'] = id_ctr
            st.session_state['processed'] = True
            
            save_session(id_ctr, [])
            save_setting(f"proc_status_{id_ctr}", "running")
            
            thread = threading.Thread(
                target=process_excel_in_background,
                args=(df, id_ctr, origin_sel, loading_date, expected_date, payment_deadline, dist_mode, filipe_target)
            )
            thread.daemon = True
            thread.start()
            
            st.success(f"🚀 Processamento do ID_CTR **'{id_ctr}'** iniciado em segundo plano com sucesso!")
            st.info("💡 Pode navegar para o **Painel de Envio** ou **Histórico** imediatamente. As imagens e ficheiros estão a ser gerados em pano de fundo.")
            
        # Exibe status e botão ZIP
        active_id = st.session_state.get('id_ctr', '')
        if active_id:
            proc_status = get_setting(f"proc_status_{active_id}", "stopped")
            if proc_status == "running":
                st.info(f"⏳ O servidor está a gerar as tabelas e imagens para a lista **'{active_id}'**...")
                if st.button("🔄 Atualizar Progresso", use_container_width=True):
                    loaded_q = load_session(active_id)
                    if loaded_q:
                        st.session_state['message_queue'] = loaded_q
                    st.rerun()
            elif proc_status == "completed":
                zip_path = os.path.join("db", f"{active_id}.zip")
                if os.path.exists(zip_path):
                    with open(zip_path, "rb") as f:
                        zip_bytes = f.read()
                    st.download_button(
                        label=f"📥 Baixar Ficheiro ZIP ({active_id}.zip)",
                        data=zip_bytes,
                        file_name=f"{active_id}.zip",
                        mime="application/zip",
                        use_container_width=True,
                        key=f"btn_dl_zip_{active_id}"
                    )
                    st.markdown("---")
                    st.success("Imagens e ficheiros gerados com sucesso!")
                    if st.button("📱 Abrir Painel de Envio WhatsApp", type="primary", use_container_width=True):
                        st.switch_page("pages/1_Painel_Envio.py")
    except Exception as err:
        st.error(f"Erro ao processar ficheiro Excel: {err}")
else:
    st.info("👆 Por favor, faça upload do arquivo `.xlsx` para começar ou selecione uma sessão no menu lateral.")
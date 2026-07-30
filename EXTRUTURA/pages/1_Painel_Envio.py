import streamlit as st
import pandas as pd
import threading
import time
import os
from datetime import datetime
from core.database import load_session, save_session, get_setting, save_setting, get_all_sessions, delete_session
from core.whatsapp import upload_whatchimp_media, send_whatchimp_template, extract_phone_numbers
from core.logger import get_logger
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="Painel de Envio CTR", page_icon="📱", layout="wide")

logger = get_logger("PainelEnvio")

# --- Sistema de Login ---
if 'logged_in' not in st.session_state or not st.session_state['logged_in']:
    st.error("Por favor, faça login na página principal primeiro.")
    st.stop()

# --- Sistema de Retoma de Sessão ---
with st.sidebar:
    st.header("🕰️ Retomar Sessão")
    st.markdown("Recupere o painel de controlo de envios caso o navegador tenha sido fechado acidentalmente.")
    sessions = get_all_sessions()
    
    if sessions:
        # Criar uma lista para exibição
        display_options = [""] + [f"{s['id_ctr']} (Atualizado a {s['updated_at']})" for s in sessions]
        
        current_id = st.session_state.get('id_ctr', '')
        default_index = 0
        if current_id:
            for idx, opt in enumerate(display_options):
                if opt.startswith(f"{current_id} (") or opt == current_id:
                    default_index = idx
                    break

        selected_option = st.selectbox("Escolha uma sessão gravada:", display_options, index=default_index, key="sidebar_session_select")
        
        col_load, col_del = st.columns(2)
        with col_load:
            if st.button("📥 Carregar", use_container_width=True) and selected_option:
                try:
                    # Extrair o ID
                    id_from_file = selected_option.split(" (")[0]
                    
                    loaded_queue = load_session(id_from_file)
                    if loaded_queue:
                        st.session_state['message_queue'] = loaded_queue
                        st.session_state['id_ctr'] = id_from_file
                        st.session_state['processed'] = True
                        first_td = loaded_queue[0].get('template_data', {}) if loaded_queue else {}
                        st.session_state['container_num_field'] = first_td.get('templateVariable-ContainerNumber-6', f"{id_from_file}TH")
                        st.session_state['current_ctr_bound'] = id_from_file
                        
                        st.success(f"Sessão carregada com {len(loaded_queue)} mensagens!")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error("Erro ao ler os dados da sessão.")
                except Exception as e:
                    st.error(f"Erro ao carregar: {e}")
        with col_del:
            if st.button("🗑️ Apagar", use_container_width=True, type="secondary") and selected_option:
                try:
                    id_to_del = selected_option.split(" (")[0]
                    if delete_session(id_to_del):
                        if st.session_state.get('id_ctr') == id_to_del:
                            st.session_state['message_queue'] = []
                            st.session_state['id_ctr'] = ""
                        st.success(f"Sessão {id_to_del} apagada!")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error("Erro ao apagar sessão da base de dados.")
                except Exception as e:
                    st.error(f"Erro ao apagar: {e}")
    else:
        st.info("Nenhuma sessão gravada encontrada na base de dados.")

# Trabalhador de Fundo
def background_worker(id_ctr, status_filter, session_queue, send_mode="normal", data_disp="", horario_disp="", valor_taxa_disp=""):
    """
    Função de trabalhador de Fundo (Thread). Não interage com a interface (st.UI).
    Lê e escreve diretamente na base de dados para garantir persistência assíncrona.
    """
    # Refresh queue from DB just to be sure we have the latest
    queue = load_session(id_ctr)
    if not queue:
        queue = session_queue
        
    opt_wc_token = get_setting("whatchimp_api_token", os.getenv("WHATCHIMP_API_TOKEN", ""))
    opt_wc_phone = get_setting("whatchimp_phone_id", os.getenv("WHATCHIMP_PHONE_ID", ""))
    
    if not opt_wc_token or not opt_wc_phone:
        get_logger("Background").error("Falta API Token ou Phone ID do WhatsApp!")
        return # Falha silenciosa no background. O erro deve ser visto na UI antes.

    template_ids = {
        "alerta_carga_pagar": get_setting("template_alerta_carga_pagar", "409806"),
        "alerta_carga_pago": get_setting("template_alerta_carga_pago", "409807"),
        "notas_regras_pago": get_setting("template_notas_regras_pago", "409400"),
        "banco_filipe": get_setting("template_banco_filipe", "409375"),
        "banco_jupiter": get_setting("template_banco_jupiter", "409374"),
        "notas_regras_pagamento": get_setting("template_notas_regras_pagamento", "409373"),
        "lembrete_1": get_setting("template_lembrete_1", "412705"),
        "lembrete_2": get_setting("template_lembrete_2", "412707")
    }
    
    # Marcar a tarefa em execução
    save_setting(f"bg_task_{id_ctr}", "running")
    save_setting(f"stop_{id_ctr}", "false")
    
    try:
        for i, item in enumerate(queue):
            # Verifica interrupção
            if get_setting(f"stop_{id_ctr}", "false") == "true":
                break
                
            if item['status'].startswith(status_filter) and item.get('Selecionar', False):
                phones = extract_phone_numbers(item['phone'])
                if not phones:
                    item['status'] = "Erro"
                    item['error'] = f"Sem número válido ({item['phone']})"
                    save_session(id_ctr, queue)
                    continue
                    
                td = item.get("template_data")
                if not td:
                    item['status'] = "Erro"
                    item['error'] = "Dados em falta."
                    save_session(id_ctr, queue)
                    continue
                    
                phone_errors = []
                phone_successes = []
                
                for target_phone in phones:
                    if send_mode == "lembrete":
                        t1_id = template_ids["lembrete_1"]
                        t2_id = template_ids["lembrete_2"]
                        
                        if not t1_id:
                            phone_errors.append("Template Lembrete não configurado")
                            continue
                            
                        container_num = td.get("templateVariable-ContainerNumber-6", f"{id_ctr}TH")
                        t_vars = {
                            "templateVariable-Data-1": data_disp,
                            "templateVariable-Horario-2": horario_disp,
                            "templateVariable-ContainerNumber-3": container_num,
                            "templateVariable-ValorTaxa-4": valor_taxa_disp
                        }
                        
                        res1 = send_whatchimp_template(opt_wc_token, opt_wc_phone, target_phone, t1_id, t_vars)
                        if str(res1.get("status")) == "1":
                            if t2_id:
                                time.sleep(8)
                                res2 = send_whatchimp_template(opt_wc_token, opt_wc_phone, target_phone, t2_id, {})
                                if str(res2.get("status")) == "1":
                                    phone_successes.append(target_phone)
                                else:
                                    phone_errors.append(f"{target_phone} (Part 2): {res2.get('message')}")
                            else:
                                phone_successes.append(target_phone)
                        else:
                            phone_errors.append(f"{target_phone} (Part 1): {res1.get('message')}")
                    else:
                        upload_res = upload_whatchimp_media(opt_wc_token, opt_wc_phone, item['img_path'])
                        if str(upload_res.get("status")) == "1":
                            vars_to_send = dict(td)
                            bank_val = vars_to_send.pop("bank", "")
                            is_paid_val = vars_to_send.pop("is_paid", False)
                            
                            if "media_url" in upload_res:
                                vars_to_send["template_header_media_url"] = upload_res["media_url"]
                            elif "media_id" in upload_res:
                                vars_to_send["template_header_media_id"] = upload_res["media_id"]
                            
                            if is_paid_val:
                                seq = [("alerta_carga_pago", vars_to_send, 12), ("notas_regras_pago", {}, 3)]
                            else:
                                bank_template = "banco_jupiter" if "JUPITER" in str(bank_val).upper() else "banco_filipe"
                                seq = [("alerta_carga_pagar", vars_to_send, 12), (bank_template, {}, 4), ("notas_regras_pagamento", {}, 1)]
                            
                            all_success = True
                            sub_errors = []
                            for t_name, t_vars, delay in seq:
                                res = send_whatchimp_template(opt_wc_token, opt_wc_phone, target_phone, template_ids[t_name], t_vars)
                                if str(res.get("status")) != "1":
                                    all_success = False
                                    sub_errors.append(f"{t_name}: {res.get('message')}")
                                    break 
                                time.sleep(delay)
                                
                            if all_success:
                                phone_successes.append(target_phone)
                            else:
                                phone_errors.append(f"{target_phone}: {' | '.join(sub_errors)}")
                        else:
                            phone_errors.append(f"Upload Falhou: {upload_res.get('message')}")
                            break
                            
                if phone_successes:
                    item['status'] = "Enviado"
                    item['error'] = "" if not phone_errors else f"OK em {len(phone_successes)}/{len(phones)}"
                else:
                    item['status'] = "Erro"
                    item['error'] = " | ".join(phone_errors)
                
                # Grava a cada iteração (cada cliente) na BD
                try:
                    save_session(id_ctr, queue)
                except Exception as db_e:
                    logger.error(f"Erro ao salvar sessao {id_ctr}: {db_e}")
                
                time.sleep(1) # Rate limit global
    except Exception as fatal_e:
        get_logger("Background").error(f"Erro fatal na thread: {fatal_e}")
        
    # Tarefa terminou
    save_setting(f"bg_task_{id_ctr}", "stopped")

def process_whatsapp_queue(status_filter="Pendente", send_mode="normal", data_disp="", horario_disp="", valor_taxa_disp=""):
    queue = st.session_state.get('message_queue', [])
    # UI Delegation
    id_ctr = st.session_state.get('id_ctr', 'SEM_ID')
    
    # Avisar o Utilizador que o processo começou
    st.info("🔄 Servidor em background ativado! Pode mudar de aba se quiser.")
    
    # Criar Thread Fantasma que fará o processamento pesado
    thread = threading.Thread(
        target=background_worker, 
        args=(id_ctr, status_filter, queue, send_mode, data_disp, horario_disp, valor_taxa_disp)
    )
    thread.daemon = True # Morre com a aplicação se reiniciar
    thread.start()
    
    st.session_state['bg_started'] = True
    time.sleep(1)
    st.rerun()

# --- Renderização do Ecrã ---
st.title("Painel de Controlo do WhatsApp")

if 'message_queue' not in st.session_state or not st.session_state['message_queue']:
    st.info("👆 Por favor, vá à aplicação principal e processe uma lista, ou selecione uma lista no menu 'Retomar Sessão'.")
    st.stop()

id_ctr_atual = st.session_state.get('id_ctr', '')
is_running = get_setting(f"bg_task_{id_ctr_atual}", "stopped") == "running"

st.subheader(f"Lista em Curso: {st.session_state.get('id_ctr', 'N/A')}")

# Extrair e permitir edição do número do contentor da sessão ativa
first_item_td = st.session_state['message_queue'][0].get('template_data', {}) if st.session_state['message_queue'] else {}
default_container = first_item_td.get('templateVariable-ContainerNumber-6', f"{st.session_state.get('id_ctr', '')}TH")

if 'container_num_field' not in st.session_state or st.session_state.get('current_ctr_bound') != id_ctr_atual:
    st.session_state['container_num_field'] = default_container
    st.session_state['current_ctr_bound'] = id_ctr_atual

col_container1, col_container2 = st.columns([3, 1])
with col_container1:
    st.text_input("🚢 Número do Contentor (para esta lista):", key="container_num_field", disabled=is_running)
with col_container2:
    st.markdown("<div style='height: 1.76rem'></div>", unsafe_allow_html=True)
    if st.button("💾 Atualizar Contentor", use_container_width=True, disabled=is_running):
        updated_val = st.session_state.get('container_num_field', default_container).strip()
        old_id_ctr = st.session_state.get('id_ctr', '')
        
        if updated_val:
            if old_id_ctr and old_id_ctr != updated_val:
                delete_session(old_id_ctr)
            st.session_state['id_ctr'] = updated_val
            
            for item in st.session_state['message_queue']:
                if 'template_data' not in item or item['template_data'] is None:
                    item['template_data'] = {}
                item['template_data']['templateVariable-ContainerNumber-6'] = updated_val
                
            save_session(updated_val, st.session_state['message_queue'])
            st.session_state['current_ctr_bound'] = updated_val
            st.success(f"Número do contentor e nome da lista atualizados para '{updated_val}'!")
            time.sleep(1)
            st.rerun()

# Garantir que as colunas existem para compatibilidade com sessões antigas
for item in st.session_state['message_queue']:
    if 'Selecionar' not in item:
        item['Selecionar'] = True if item['status'] in ['Pendente', 'Erro'] else False
    if 'list_code' not in item:
        item['list_code'] = "N/A"
        
df_queue = pd.DataFrame(st.session_state['message_queue'])

# Adicionar emojis ao status visualmente
def get_status_icon(status):
    if status == "Enviado":
        return "🟢 Enviado"
    elif status == "Pendente":
        return "⏳ Pendente"
    elif status == "Erro":
        return "🔴 Erro"
    return status
    
df_display = df_queue.copy()
df_display['status'] = df_display['status'].apply(get_status_icon)



# --- SELETOR DE MODO DE ENVIO ---
st.markdown("### ⚙️ Tipo de Mensagem a Enviar")
send_mode_choice = st.radio(
    "Escolha o tipo de mensagem:",
    ["📄 Envio Normal (Faturas / Notificação)", "📦 Lembrete de Levantamento de Mercadoria"],
    horizontal=True,
    disabled=is_running
)
selected_send_mode = "lembrete" if "Lembrete" in send_mode_choice else "normal"

data_disp_val = ""
horario_disp_val = ""
valor_taxa_disp_val = ""

if selected_send_mode == "lembrete":
    st.info("📦 **Modo Lembrete Ativo:** Os clientes receberão a mensagem de disponibilidade de carga no armazém.")
    c_data, c_horario, c_taxa = st.columns(3)
    with c_data:
        data_disp_val = st.text_input("📅 Data de Disponibilidade", value=datetime.now().strftime("%d/%m/%Y"), disabled=is_running)
    with c_horario:
        horario_disp_val = st.text_input("⏰ Horário para Levantamento", value="10h30 – 17h00", disabled=is_running)
    with c_taxa:
        valor_taxa_disp_val = st.text_input("💰 Taxa Cópia de Despacho", value="240,00 MZN", disabled=is_running)

edited_df = st.data_editor(
    df_display[["Selecionar", "list_code", "id_code", "name", "phone", "status", "error"]],
    use_container_width=True,
    hide_index=True,
    disabled=["list_code", "id_code", "name", "phone", "status", "error"],
    key="queue_data_editor"
)

col_send_all, col_send, col_send_next, col_retry = st.columns([2, 1, 1, 1])

with col_send_all:
    btn_send_all = st.button("🚀 Iniciar Envios (Todos)", type="primary", disabled=is_running)
with col_send:
    btn_send = st.button("🚀 Enviar (Seleção)", disabled=is_running)
with col_send_next:
    btn_send_next = st.button("▶️ Enviar (1 Cliente)", disabled=is_running)
with col_retry:
    btn_retry = st.button("🔄 Re-tentar Erros", disabled=is_running)



col_refresh, col_stop = st.columns(2)
with col_refresh:
    if st.button("🔄 ATUALIZAR STATUS DA FILA", use_container_width=True, type="primary"):
        updated_queue = load_session(id_ctr_atual)
        if updated_queue:
            st.session_state['message_queue'] = updated_queue
        st.rerun()
        
with col_stop:
    if st.button("🛑 PARAR SERVIDOR", use_container_width=True, type="secondary"):
        save_setting(f"stop_{id_ctr_atual}", "true")
        st.warning("Ordem de paragem enviada! O servidor vai parar no próximo cliente.")

if is_running:
    st.success("☁️ O SERVIDOR ESTÁ A ENVIAR MENSAGENS NESTE MOMENTO! Clique em ATUALIZAR STATUS DA FILA para ver o progresso.")
    
if btn_send_all or btn_send or btn_retry or btn_send_next:
    save_setting(f"stop_{id_ctr_atual}", "false")
    
    # Primeiro garantimos que a nossa seleção é salva na sessão atual
    if btn_send_all:
        for i, row in df_queue.iterrows():
            if row['status'] == 'Pendente':
                st.session_state['message_queue'][i]['Selecionar'] = True
    elif btn_send_next:
        found_one = False
        for i, row in df_queue.iterrows():
            if row['status'] == 'Pendente' and not found_one:
                st.session_state['message_queue'][i]['Selecionar'] = True
                found_one = True
            else:
                st.session_state['message_queue'][i]['Selecionar'] = False
        if not found_one:
            st.warning("Não há mensagens pendentes para enviar.")
            st.stop()
    else:
        for i, row in edited_df.iterrows():
            st.session_state['message_queue'][i]['Selecionar'] = row['Selecionar']
            
    # IMPORTANTE: Salvar a sessão de volta no DB ANTES de lançar a Thread
    save_session(id_ctr_atual, st.session_state['message_queue'])
    
    if btn_send_all or btn_send or btn_send_next:
        process_whatsapp_queue(
            status_filter="Pendente",
            send_mode=selected_send_mode,
            data_disp=data_disp_val,
            horario_disp=horario_disp_val,
            valor_taxa_disp=valor_taxa_disp_val
        )
    elif btn_retry:
        process_whatsapp_queue(
            status_filter="Erro",
            send_mode=selected_send_mode,
            data_disp=data_disp_val,
            horario_disp=horario_disp_val,
            valor_taxa_disp=valor_taxa_disp_val
        )

# --- MODO FOCO INDIVIDUAL ---
st.markdown("<br>", unsafe_allow_html=True)
with st.expander("🎯 Modo Foco Individual", expanded=False):
    st.markdown("Use esta opção se preferir procurar um cliente específico na lista e enviar apenas para ele.")
    pending_clients = [c for c in st.session_state['message_queue'] if c['status'] in ['Pendente', 'Erro']]
    
    if pending_clients:
        options = {f"{c.get('list_code', '')} - {c['name']} ({c['status']})": c for c in pending_clients}
        selected_client_label = st.selectbox("Escolha um cliente da fila:", list(options.keys()))
        
        if st.button("📤 Disparar Mensagem Agora", type="primary", disabled=is_running):
            selected_client = options[selected_client_label]
            
            # Desmarcar todos e marcar apenas o escolhido
            for item in st.session_state['message_queue']:
                if item['phone'] == selected_client['phone'] and item['name'] == selected_client['name']:
                    item['Selecionar'] = True
                else:
                    item['Selecionar'] = False
                    
            save_setting(f"stop_{id_ctr_atual}", "false")
            save_session(id_ctr_atual, st.session_state['message_queue'])
            
            # String vazia faz match com qualquer status no background worker
            process_whatsapp_queue(
                status_filter="",
                send_mode=selected_send_mode,
                data_disp=data_disp_val,
                horario_disp=horario_disp_val,
                valor_taxa_disp=valor_taxa_disp_val
            ) 
    else:
        st.success("🎉 Não há clientes pendentes ou com erro nesta lista!")

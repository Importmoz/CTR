import asyncio
import os
import json
import time
import io
import pandas as pd
from datetime import datetime
from core.logger import get_logger
from core.database import (
    get_all_conversion_jobs, update_conversion_job_status, delete_conversion_job,
    get_all_sending_jobs, update_sending_job_status, delete_sending_job,
    load_session, save_session, get_setting, save_setting
)
from core.whatsapp import send_whatchimp_template, upload_whatchimp_media, extract_phone_numbers

logger = get_logger("QueueManager")

def read_excel_smart_path(file_path: str) -> pd.DataFrame:
    with open(file_path, "rb") as f:
        content = f.read()
    bio = io.BytesIO(content)
    df = pd.read_excel(bio)
    if 'USERNAME' in df.columns or 'ID CODE' in df.columns or 'CONSIGNEE' in df.columns:
        return df
    
    bio.seek(0)
    df_skip3 = pd.read_excel(bio, skiprows=3)
    if 'USERNAME' in df_skip3.columns or 'ID CODE' in df_skip3.columns or 'CONSIGNEE' in df_skip3.columns:
        return df_skip3

    bio.seek(0)
    df_scan = pd.read_excel(bio, header=None)
    for idx, row in df_scan.head(10).iterrows():
        row_str = row.astype(str).str.upper().tolist()
        if any('ID CODE' in cell or 'CONSIGNEE' in cell for cell in row_str):
            bio.seek(0)
            return pd.read_excel(bio, skiprows=idx)
            
    bio.seek(0)
    return pd.read_excel(bio, skiprows=3)

class QueueManager:
    def __init__(self):
        self.ws_manager = None
        self.conversion_worker_running = False
        self.sending_worker_running = False

    def set_ws_manager(self, ws_manager):
        self.ws_manager = ws_manager

    async def start_workers(self):
        logger.info("Starting persistent queue workers...")
        # Se houve reinício do servidor com tarefas pendentes, devolve para a fila
        conv_jobs = get_all_conversion_jobs("processing")
        for job in conv_jobs:
            update_conversion_job_status(job["job_id"], "queued", 0, "A retomar após reinício do servidor...")
            
        send_jobs = get_all_sending_jobs("processing")
        for job in send_jobs:
            update_sending_job_status(job["job_id"], "queued")

        if not self.conversion_worker_running:
            self.conversion_worker_running = True
            asyncio.create_task(self._conversion_loop())

        if not self.sending_worker_running:
            self.sending_worker_running = True
            asyncio.create_task(self._sending_loop())

    async def _conversion_loop(self):
        from api.services import process_excel_bg
        while self.conversion_worker_running:
            try:
                queued = get_all_conversion_jobs("queued")
                if queued:
                    job = queued[0]
                    job_id = job["job_id"]
                    id_ctr = job["id_ctr"]
                    params = job["params"]
                    file_path = job["file_path"]

                    logger.info(f"[ConversionQueue] Iniciando processamento do CTR {id_ctr} (Job {job_id})")
                    update_conversion_job_status(job_id, "processing", 5, "Iniciando conversão em background...")

                    if self.ws_manager:
                        await self.ws_manager.send_progress(id_ctr, 5, "Iniciando conversão em background...")

                    async def progress_callback(prog, tot, msg, extra=None):
                        percent = int((prog / tot) * 100) if tot > 0 else prog
                        update_conversion_job_status(job_id, "processing", percent, msg)
                        if self.ws_manager:
                            await self.ws_manager.send_progress(id_ctr, percent, msg, extra=extra)

                    try:
                        if not os.path.exists(file_path):
                            raise Exception("Ficheiro temporário de upload não encontrado.")
                            
                        df = await asyncio.to_thread(read_excel_smart_path, file_path)
                        ld = datetime.strptime(params["loading_date"], "%Y-%m-%d") if params.get("loading_date") else None
                        ed = datetime.strptime(params["expected_date"], "%Y-%m-%d") if params.get("expected_date") else None
                        pd_date = datetime.strptime(params["payment_deadline"], "%Y-%m-%d") if params.get("payment_deadline") else None
                        
                        await process_excel_bg(
                            df, id_ctr, params.get("origin_sel", "CHINA"), params.get("dest_sel", "MAPUTO"),
                            ld, ed, pd_date, params.get("dist_mode", "Padrão"), float(params.get("filipe_target", 200000)),
                            progress_callback, params.get("send_whatsapp", False)
                        )
                        
                        update_conversion_job_status(job_id, "completed", 100, "Processado com sucesso!")
                        if os.path.exists(file_path):
                            try:
                                os.remove(file_path)
                            except Exception:
                                pass
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        err_msg = f"Erro no processamento: {str(e)}"
                        logger.error(f"[ConversionQueue] {err_msg}")
                        update_conversion_job_status(job_id, "error", 0, err_msg)
                        if self.ws_manager:
                            await self.ws_manager.send_progress(id_ctr, 0, err_msg)

                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Erro no loop de conversão: {e}")
                await asyncio.sleep(5)

    async def _sending_loop(self):
        while self.sending_worker_running:
            try:
                queued = get_all_sending_jobs("queued")
                if queued:
                    job = queued[0]
                    job_id = job["job_id"]
                    id_ctr = job["id_ctr"]
                    send_mode = job["send_mode"]
                    params = job["params"]

                    logger.info(f"[SendingQueue] Iniciando envio do CTR {id_ctr} (Mode: {send_mode})")
                    update_sending_job_status(job_id, "processing")
                    save_setting(f"bg_task_{id_ctr}", "running")
                    save_setting(f"stop_{id_ctr}", "false")

                    await asyncio.to_thread(
                        self.execute_sender_sync,
                        id_ctr, send_mode,
                        params.get("data_disp", ""),
                        params.get("horario_disp", ""),
                        params.get("valor_taxa_disp", "")
                    )

                    update_sending_job_status(job_id, "completed")
                    save_setting(f"bg_task_{id_ctr}", "completed")

                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Erro no loop de envio: {e}")
                await asyncio.sleep(5)

    def execute_sender_sync(self, id_ctr, send_mode, data_disp="", horario_disp="", valor_taxa_disp=""):
        queue = load_session(id_ctr)
        if not queue:
            return
        
        opt_wc_token = get_setting("whatchimp_api_token", os.getenv("WHATCHIMP_API_TOKEN", ""))
        opt_wc_phone = get_setting("whatchimp_phone_id", os.getenv("WHATCHIMP_PHONE_ID", ""))
        
        template_ids = {
            "alerta_carga_pagar": get_setting("template_alerta_carga_pagar", "409806"),
            "alerta_carga_pago": get_setting("template_alerta_carga_pago", "409807"),
            "notas_regras_pago": get_setting("template_notas_regras_pago", "409400"),
            "banco_filipe": get_setting("template_banco_filipe", "409375"),
            "banco_jupiter": get_setting("template_banco_jupiter", "409374"),
            "notas_regras_pagamento": get_setting("template_notas_regras_pagamento", "409373"),
            "levantamento": get_setting("template_levantamento", "412705"),
            "levantamento_nota": get_setting("template_levantamento_nota", "412707")
        }
        
        for i, item in enumerate(queue):
            if get_setting(f"stop_{id_ctr}", "false") == "true":
                break
            
            curr_status = item.get('status_levantamento', 'Pendente') if send_mode == 'levantamento' else item.get('status', 'Pendente')
            if curr_status == "Pendente" or curr_status == "Erro":
                self._send_item_logic(item, id_ctr, send_mode, opt_wc_token, opt_wc_phone, template_ids, data_disp, horario_disp, valor_taxa_disp)
                save_session(id_ctr, queue)

    def _send_item_logic(self, item, id_ctr, send_mode, opt_wc_token, opt_wc_phone, template_ids, data_disp, horario_disp, valor_taxa_disp):
        phones = extract_phone_numbers(item['phone'])
        if not phones:
            if send_mode == "levantamento":
                item['status_levantamento'] = "Erro"
                item['error_levantamento'] = "Sem número válido"
            else:
                item['status'] = "Erro"
                item['error'] = "Sem número válido"
            return

        td = item.get("template_data", {})
        phone_successes = []
        
        for target_phone in phones:
            if send_mode == "levantamento":
                t1_id = template_ids["levantamento"]
                t2_id = template_ids["levantamento_nota"]
                
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
                    phone_successes.append(target_phone)
            else:
                upload_res = upload_whatchimp_media(opt_wc_token, opt_wc_phone, item.get('img_path', ''))
                if str(upload_res.get("status")) == "1":
                    vars_to_send = dict(td)
                    bank_val = vars_to_send.pop("bank", "")
                    is_paid_val = vars_to_send.pop("is_paid", False)
                    if "media_url" in upload_res:
                        vars_to_send["template_header_media_url"] = upload_res["media_url"]
                        
                    if is_paid_val:
                        seq = [("alerta_carga_pago", vars_to_send, 12), ("notas_regras_pago", {}, 3)]
                    else:
                        bank_template = "banco_jupiter" if "JUPITER" in str(bank_val).upper() else "banco_filipe"
                        seq = [("alerta_carga_pagar", vars_to_send, 12), (bank_template, {}, 4), ("notas_regras_pagamento", {}, 1)]
                        
                    all_success = True
                    for t_name, t_vars_s, delay in seq:
                        res = send_whatchimp_template(opt_wc_token, opt_wc_phone, target_phone, template_ids[t_name], t_vars_s)
                        if str(res.get("status")) != "1":
                            all_success = False
                            break
                        time.sleep(delay)
                        
                    if all_success:
                        phone_successes.append(target_phone)
                        
        if len(phone_successes) > 0:
            if send_mode == "levantamento":
                item['status_levantamento'] = "Enviado"
                item['error_levantamento'] = ""
            else:
                item['status'] = "Enviado"
                item['error'] = ""
        else:
            if send_mode == "levantamento":
                item['status_levantamento'] = "Erro"
                item['error_levantamento'] = "Falha no envio"
            else:
                item['status'] = "Erro"
                item['error'] = "Falha no envio"

    def send_single_item_sync(self, id_ctr: str, index: int, send_mode: str, data_disp="", horario_disp="", valor_taxa_disp=""):
        queue = load_session(id_ctr)
        if not queue or index < 0 or index >= len(queue):
            return {"success": False, "error": "Sessão ou item não encontrado."}
        
        opt_wc_token = get_setting("whatchimp_api_token", os.getenv("WHATCHIMP_API_TOKEN", ""))
        opt_wc_phone = get_setting("whatchimp_phone_id", os.getenv("WHATCHIMP_PHONE_ID", ""))
        template_ids = {
            "alerta_carga_pagar": get_setting("template_alerta_carga_pagar", "409806"),
            "alerta_carga_pago": get_setting("template_alerta_carga_pago", "409807"),
            "notas_regras_pago": get_setting("template_notas_regras_pago", "409400"),
            "banco_filipe": get_setting("template_banco_filipe", "409375"),
            "banco_jupiter": get_setting("template_banco_jupiter", "409374"),
            "notas_regras_pagamento": get_setting("template_notas_regras_pagamento", "409373"),
            "levantamento": get_setting("template_levantamento", "412705"),
            "levantamento_nota": get_setting("template_levantamento_nota", "412707")
        }
        item = queue[index]
        self._send_item_logic(item, id_ctr, send_mode, opt_wc_token, opt_wc_phone, template_ids, data_disp, horario_disp, valor_taxa_disp)
        save_session(id_ctr, queue)
        
        new_status = item.get('status_levantamento', '') if send_mode == "levantamento" else item.get('status', '')
        if new_status == "Enviado":
            return {"success": True, "message": "Mensagem reenviada com sucesso!", "item": item}
        else:
            err = item.get('error_levantamento', '') if send_mode == "levantamento" else item.get('error', 'Falha no envio')
            return {"success": False, "error": f"Falha no reenvio: {err}", "item": item}

queue_manager = QueueManager()

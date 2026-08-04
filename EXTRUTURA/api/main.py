from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any
import asyncio
import io
import os
import pandas as pd
import requests
import shutil
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from api.services import process_excel_bg
from core.database import get_all_sessions, load_session, get_setting, save_setting, init_db, delete_session, save_session, get_general_metrics
from core.whatsapp import send_whatchimp_template, upload_whatchimp_media, extract_phone_numbers

app = FastAPI(title="Processador CTR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, ws_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[ws_id] = websocket

    def disconnect(self, ws_id: str):
        if ws_id in self.active_connections:
            del self.active_connections[ws_id]

    async def send_progress(self, ws_id: str, progress: int, message: str, extra: dict = None):
        if ws_id in self.active_connections:
            try:
                payload = {
                    "progress": progress,
                    "message": message
                }
                if extra:
                    payload.update(extra)
                await self.active_connections[ws_id].send_json(payload)
            except:
                self.disconnect(ws_id)

manager = ConnectionManager()

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    pb_base_url = os.getenv("POCKETBASE_URL", "http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io").rstrip("/")
    auth_endpoint = f"{pb_base_url}/api/collections/users/auth-with-password"
    try:
        response = requests.post(auth_endpoint, json={
            "identity": username,
            "password": password
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return {"success": True, "token": data.get('token'), "user": data.get('record')}
        else:
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def read_excel_smart(content: bytes) -> pd.DataFrame:
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

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    id_ctr: str = Form(...),
    origin_sel: str = Form(...),
    dest_sel: str = Form("MAPUTO"),
    loading_date: str = Form(...),
    expected_date: str = Form(...),
    payment_deadline: str = Form(""),
    dist_mode: str = Form(...),
    filipe_target: float = Form(200000),
    send_whatsapp: bool = Form(False)
):
    try:
        content = await file.read()
        df = read_excel_smart(content)
        
        ld = datetime.strptime(loading_date, "%Y-%m-%d")
        ed = datetime.strptime(expected_date, "%Y-%m-%d")
        pd_date = datetime.strptime(payment_deadline, "%Y-%m-%d") if payment_deadline else None
        
        async def progress_callback(progress, total, message, extra=None):
            await manager.send_progress(id_ctr, progress, message, extra=extra)

        asyncio.create_task(process_excel_bg(
            df, id_ctr, origin_sel, dest_sel, ld, ed, pd_date, 
            dist_mode, filipe_target, progress_callback, send_whatsapp
        ))
        
        return {"success": True, "message": "Processamento iniciado", "id_ctr": id_ctr}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/progress/{id_ctr}")
async def websocket_endpoint(websocket: WebSocket, id_ctr: str):
    await manager.connect(id_ctr, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(id_ctr)

@app.get("/sessions")
async def get_sessions():
    sessions = get_all_sessions()
    return {"sessions": sessions}

@app.get("/metrics/summary")
async def get_metrics_summary():
    metrics = get_general_metrics()
    return {"success": True, "metrics": metrics}

@app.get("/sessions/{id_ctr}")
async def get_session(id_ctr: str):
    queue = load_session(id_ctr)
    if queue:
        sheet_id = get_setting(f"gdrive_sheet_id_{id_ctr}", "")
        folder_id = get_setting(f"gdrive_folder_id_{id_ctr}", "")
        return {"success": True, "queue": queue, "sheetId": sheet_id, "folderId": folder_id}
    raise HTTPException(status_code=404, detail="Sessão não encontrada")

class DeleteSessionRequest(BaseModel):
    auth_code: str

@app.post("/sessions/{id_ctr}/delete")
async def delete_session_api(id_ctr: str, req: DeleteSessionRequest):
    if req.auth_code != "792721":
        raise HTTPException(status_code=401, detail="Código de autorização inválido")
        
    if delete_session(id_ctr):
        # Apagar a pasta com os dados gerados
        id_folder = os.path.join("db", id_ctr)
        zip_path = os.path.join("db", f"{id_ctr}.zip")
        if os.path.exists(id_folder):
            shutil.rmtree(id_folder)
        if os.path.exists(zip_path):
            os.remove(zip_path)
            
        return {"success": True}
    raise HTTPException(status_code=500, detail="Erro ao apagar sessão")

@app.get("/download/zip/{id_ctr}")
async def download_zip(id_ctr: str):
    zip_path = os.path.join("db", f"{id_ctr}.zip")
    if os.path.exists(zip_path):
        return FileResponse(zip_path, media_type="application/zip", filename=f"{id_ctr}.zip")
    raise HTTPException(status_code=404, detail="Ficheiro ZIP não encontrado")

@app.get("/download/csv/{id_ctr}")
async def download_csv(id_ctr: str):
    queue = load_session(id_ctr)
    if queue:
        df = pd.DataFrame(queue)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return StreamingResponse(
            iter([csv_buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Relatorio_WhatsApp_{id_ctr}.csv"}
        )
    raise HTTPException(status_code=404, detail="Sessão não encontrada")

class SettingsUpdate(BaseModel):
    settings: Dict[str, str]

@app.get("/settings")
def get_settings():
    keys = [
        'template_alerta_carga_pagar', 'template_alerta_carga_pago',
        'template_notas_regras_pagamento', 'template_notas_regras_pago',
        'template_banco_jupiter', 'template_banco_filipe',
        'template_levantamento', 'template_levantamento_nota',
        'template_lembrete_1', 'template_lembrete_2',
        'bank_info_jupiter', 'bank_info_filipe',
        'google_oauth_token'
    ]
    res = {}
    for k in keys:
        val = get_setting(k, "")
        if val:
            res[k] = val
    return res

@app.get("/google/auth-url")
def google_auth_url():
    try:
        from api.google_drive import get_google_flow
        flow = get_google_flow()
        if not flow:
            return {"success": False, "message": "Credenciais do Google não encontradas! Configura as variáveis GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas Variáveis de Ambiente do Backend no Coolify."}
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        return {"success": True, "url": auth_url, "code_verifier": getattr(flow, 'code_verifier', '')}
    except Exception as e:
        return {"success": False, "message": str(e)}

class GoogleCallbackRequest(BaseModel):
    code: str
    code_verifier: str = None

@app.post("/google/callback")
def google_callback(req: GoogleCallbackRequest):
    try:
        from api.google_drive import get_google_flow
        flow = get_google_flow()
        if not flow:
            raise HTTPException(status_code=400, detail="Flow não configurado")
            
        if req.code_verifier:
            flow.code_verifier = req.code_verifier
            
        flow.fetch_token(code=req.code)
        creds = flow.credentials
        
        token_data = {
            'token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': creds.scopes
        }
        
        import json
        save_setting('google_oauth_token', json.dumps(token_data))
        return {"success": True}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}

@app.post("/settings")
async def update_settings(data: SettingsUpdate):
    for k, v in data.settings.items():
        save_setting(k, v)
    return {"success": True}

class ResetRequest(BaseModel):
    auth_code: str
    confirm: bool

@app.post("/reset")
async def reset_system(req: ResetRequest):
    if req.auth_code == "792721" and req.confirm:
        try:
            db_path = os.path.join("db", "ctr_database.db")
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                conn.execute("DROP TABLE IF EXISTS sessions")
                conn.execute("DROP TABLE IF EXISTS settings")
                conn.commit()
                conn.close()
            
            init_db()
            
            import glob
            for ctr_folder in glob.glob("db/*"):
                if os.path.isdir(ctr_folder):
                    shutil.rmtree(ctr_folder)
            for zip_file in glob.glob("db/*.zip"):
                os.remove(zip_file)
            return {"success": True}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=401, detail="Código incorreto")

@app.post("/send")
async def start_sending(
    id_ctr: str = Form(...),
    send_mode: str = Form(...), # "normal" or "lembrete"
    data_disp: str = Form(""),
    horario_disp: str = Form(""),
    valor_taxa_disp: str = Form("")
):
    save_setting(f"bg_task_{id_ctr}", "running")
    save_setting(f"stop_{id_ctr}", "false")
    
    # Inicia num thread separado
    # A implementação exata da função de envio é migrada de 1_Painel_Envio.py para aqui
    # (Para manter o ficheiro manejável, assumimos que as filas e o log são geridos adequadamente na thread)
    def bg_sender():
        import time
        queue = load_session(id_ctr)
        if not queue: return
        
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
                phones = extract_phone_numbers(item['phone'])
                if not phones:
                    if send_mode == "levantamento":
                        item['status_levantamento'] = "Erro"
                        item['error_levantamento'] = f"Sem número válido"
                    else:
                        item['status'] = "Erro"
                        item['error'] = f"Sem número válido"
                    save_session(id_ctr, queue)
                    continue
                
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
                        upload_res = upload_whatchimp_media(opt_wc_token, opt_wc_phone, item['img_path'])
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
                    
                save_session(id_ctr, queue)
        
        save_setting(f"bg_task_{id_ctr}", "completed")

    import threading
    t = threading.Thread(target=bg_sender)
    t.start()
    
    return {"success": True, "message": "Envio iniciado em background"}

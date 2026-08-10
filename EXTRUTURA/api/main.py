from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
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
from core.database import (
    get_all_sessions, load_session, get_setting, save_setting, init_db, delete_session, save_session, get_general_metrics,
    save_conversion_job, get_all_conversion_jobs, delete_conversion_job,
    save_sending_job, get_all_sending_jobs, delete_sending_job
)
from core.whatsapp import send_whatchimp_template, upload_whatchimp_media, extract_phone_numbers
from core.queue_manager import queue_manager
from core.subscription import SubscriptionManager
import uuid
import time
import re
import traceback

def sanitize_path_param(param: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]', '', param)

app = FastAPI(title="Processador CTR API")

class SubscriptionActivation(BaseModel):
    subscription_id: str

def require_subscription():
    sub = SubscriptionManager.check_subscription()
    if not sub.get("is_active"):
        raise HTTPException(status_code=402, detail=sub.get("message", "Subscrição inativa."))
    return sub

cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
if cors_origins_env:
    for o in cors_origins_env.split(","):
        if o.strip():
            allowed_origins.append(o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_token_cache = {}

def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Acesso negado. Token de autenticação ausente.")
    
    token = auth_header.split(" ")[1]
    
    # Simple in-memory cache for 5 minutes
    now = time.time()
    if token in _token_cache and now - _token_cache[token]['time'] < 300:
        return _token_cache[token]['user']

    pb_base_url = os.getenv("POCKETBASE_URL", "http://pocketbase-cgk4w0o8koocsg4wggsgg888.144.91.110.199.sslip.io").rstrip("/")
    auth_endpoint = f"{pb_base_url}/api/collections/users/auth-refresh"
    
    try:
        response = requests.post(auth_endpoint, headers={"Authorization": auth_header}, timeout=5)
        if response.status_code == 200:
            user_data = response.json().get('record')
            _token_cache[token] = {'time': now, 'user': user_data}
            return user_data
        else:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Não foi possível validar o token de segurança.")

@app.on_event("startup")
async def startup_event():
    init_db()
    queue_manager.set_ws_manager(manager)
    await queue_manager.start_workers()

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
    except requests.exceptions.RequestException as re:
        print(f"Erro de conexão ao Pocketbase: {re}")
        raise HTTPException(status_code=503, detail="Servidor de autenticação indisponível.")
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

@app.post("/upload", dependencies=[Depends(require_subscription), Depends(get_current_user)])
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
        
        # Guardar ficheiro temporário para o worker da fila processar
        os.makedirs(os.path.join("db", "uploads"), exist_ok=True)
        ts = int(time.time())
        safe_id_ctr = sanitize_path_param(id_ctr)
        temp_filename = f"temp_{safe_id_ctr}_{ts}_{uuid.uuid4().hex[:6]}.xlsx"
        file_path = os.path.join("db", "uploads", temp_filename)
        with open(file_path, "wb") as f:
            f.write(content)

        params_dict = {
            "origin_sel": origin_sel,
            "dest_sel": dest_sel,
            "loading_date": loading_date,
            "expected_date": expected_date,
            "payment_deadline": payment_deadline,
            "dist_mode": dist_mode,
            "filipe_target": filipe_target,
            "send_whatsapp": send_whatsapp
        }
        job_id = f"conv_{id_ctr}_{ts}_{uuid.uuid4().hex[:4]}"
        save_conversion_job(job_id, id_ctr, "queued", 0, "Aguardando na fila de conversão...", file_path, params_dict)
        
        return {"success": True, "message": "CTR adicionado à fila de processamento", "job_id": job_id, "id_ctr": id_ctr}
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

@app.get("/sessions", dependencies=[Depends(get_current_user)])
async def get_sessions():
    sessions = get_all_sessions()
    return {"sessions": sessions}

@app.get("/metrics/summary", dependencies=[Depends(get_current_user)])
async def get_metrics_summary():
    metrics = get_general_metrics()
    return {"success": True, "metrics": metrics}

@app.get("/sessions/{id_ctr}", dependencies=[Depends(get_current_user)])
async def get_session(id_ctr: str):
    queue = load_session(id_ctr)
    if queue:
        sheet_id = get_setting(f"gdrive_sheet_id_{id_ctr}", "")
        folder_id = get_setting(f"gdrive_folder_id_{id_ctr}", "")
        return {"success": True, "queue": queue, "sheetId": sheet_id, "folderId": folder_id}
    raise HTTPException(status_code=404, detail="Sessão não encontrada")

@app.post("/sessions/{id_ctr}/delete", dependencies=[Depends(get_current_user)])
async def delete_session_api(id_ctr: str):
    # Auth is handled by get_current_user dependency
        
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

@app.get("/download/zip/{id_ctr}", dependencies=[Depends(get_current_user)])
async def download_zip(id_ctr: str):
    safe_id_ctr = sanitize_path_param(id_ctr)
    zip_path = os.path.join("db", f"{safe_id_ctr}.zip")
    if os.path.exists(zip_path):
        return FileResponse(zip_path, media_type="application/zip", filename=f"{id_ctr}.zip")
    raise HTTPException(status_code=404, detail="Ficheiro ZIP não encontrado")

@app.get("/download/csv/{id_ctr}", dependencies=[Depends(get_current_user)])
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

@app.get("/settings", dependencies=[Depends(get_current_user)])
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
def google_auth_url(request: Request):
    try:
        from api.google_drive import get_google_flow
        origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
        redirect_uri = f"{origin}/api/google/auth/callback" if origin else None
        
        flow = get_google_flow(redirect_uri)
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

@app.get("/subscription/status")
def get_subscription_status():
    return SubscriptionManager.check_subscription(force_refresh=False)

@app.post("/subscription/activate")
def activate_subscription(data: SubscriptionActivation):
    return SubscriptionManager.activate_subscription(data.subscription_id)

@app.post("/subscription/clear")
def clear_subscription():
    return SubscriptionManager.clear_subscription()

class GoogleCallbackRequest(BaseModel):
    code: str
    code_verifier: str = None

@app.post("/google/callback")
def google_callback(req: GoogleCallbackRequest, request: Request):
    try:
        from api.google_drive import get_google_flow
        origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
        redirect_uri = f"{origin}/api/google/auth/callback" if origin else None
        
        flow = get_google_flow(redirect_uri)
        if not flow:
            raise HTTPException(status_code=400, detail="Flow não configurado")
            
        if req.code_verifier:
            flow.code_verifier = req.code_verifier
            
        os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
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
        err_str = str(e)
        if "invalid_grant" in err_str or "Bad Request" in err_str:
            existing_token = get_setting('google_oauth_token', '')
            if existing_token and len(existing_token) > 10:
                return {"success": True, "message": "Token já processado em chamada anterior."}
        import traceback
        traceback.print_exc()
        return {"success": False, "message": err_str}

@app.post("/settings", dependencies=[Depends(get_current_user)])
async def update_settings(data: SettingsUpdate):
    for k, v in data.settings.items():
        save_setting(k, v)
    return {"success": True}

@app.post("/reset", dependencies=[Depends(get_current_user)])
async def reset_system():
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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/send", dependencies=[Depends(require_subscription), Depends(get_current_user)])
async def start_sending(
    id_ctr: str = Form(...),
    send_mode: str = Form(...),
    data_disp: str = Form(""),
    horario_disp: str = Form(""),
    valor_taxa_disp: str = Form("")
):
    params_dict = {
        "data_disp": data_disp,
        "horario_disp": horario_disp,
        "valor_taxa_disp": valor_taxa_disp
    }
    ts = int(time.time())
    job_id = f"send_{id_ctr}_{ts}_{uuid.uuid4().hex[:4]}"
    save_sending_job(job_id, id_ctr, "queued", send_mode, params_dict)
    save_setting(f"stop_{id_ctr}", "false")
    return {"success": True, "message": "Envio adicionado à fila do WhatsApp", "job_id": job_id}

# --- ROTAS DE GESTÃO E MONITORAMENTO DAS FILAS ---

@app.get("/conversion-queue/status", dependencies=[Depends(get_current_user)])
async def get_conversion_queue_status():
    jobs = get_all_conversion_jobs()
    return {"success": True, "jobs": jobs}

@app.post("/conversion-queue/remove/{job_id}", dependencies=[Depends(get_current_user)])
async def remove_conversion_job_endpoint(job_id: str):
    delete_conversion_job(job_id)
    return {"success": True}

@app.post("/conversion-queue/clear-completed", dependencies=[Depends(get_current_user)])
async def clear_completed_conversion_jobs():
    jobs = get_all_conversion_jobs()
    for job in jobs:
        if job["status"] in ["completed", "error"]:
            delete_conversion_job(job["job_id"])
    return {"success": True}

@app.get("/send-queue/status", dependencies=[Depends(get_current_user)])
async def get_send_queue_status():
    jobs = get_all_sending_jobs()
    return {"success": True, "jobs": jobs}

@app.post("/send-queue/add", dependencies=[Depends(require_subscription), Depends(get_current_user)])
async def add_send_queue_job(
    id_ctr: str = Form(...),
    send_mode: str = Form(...),
    data_disp: str = Form(""),
    horario_disp: str = Form(""),
    valor_taxa_disp: str = Form("")
):
    params_dict = {
        "data_disp": data_disp,
        "horario_disp": horario_disp,
        "valor_taxa_disp": valor_taxa_disp
    }
    ts = int(time.time())
    job_id = f"send_{id_ctr}_{ts}_{uuid.uuid4().hex[:4]}"
    save_sending_job(job_id, id_ctr, "queued", send_mode, params_dict)
    save_setting(f"stop_{id_ctr}", "false")
    return {"success": True, "message": "Sessão adicionada à fila de envio", "job_id": job_id}

@app.post("/send-queue/remove/{job_id}", dependencies=[Depends(get_current_user)])
async def remove_send_job_endpoint(job_id: str):
    delete_sending_job(job_id)
    return {"success": True}

@app.post("/send-queue/clear-completed", dependencies=[Depends(get_current_user)])
async def clear_completed_send_jobs():
    jobs = get_all_sending_jobs()
    for job in jobs:
        if job["status"] in ["completed", "error"]:
            delete_sending_job(job["job_id"])
    return {"success": True}

@app.post("/send/retry-item", dependencies=[Depends(get_current_user)])
async def retry_single_item_endpoint(
    id_ctr: str = Form(...),
    index: int = Form(...),
    send_mode: str = Form("normal"),
    data_disp: str = Form(""),
    horario_disp: str = Form(""),
    valor_taxa_disp: str = Form("")
):
    result = await asyncio.to_thread(
        queue_manager.send_single_item_sync,
        id_ctr, index, send_mode, data_disp, horario_disp, valor_taxa_disp
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erro ao reenviar mensagem"))
    return result

@app.get("/whatsapp/conversation/{phone_number}", dependencies=[Depends(get_current_user)])
def get_conversation_endpoint(phone_number: str, limit: int = 50, offset: int = 1):
    from core.whatsapp import get_whatchimp_conversation
    from core.database import get_setting
    
    import os
    api_token = get_setting("whatchimp_api_token", os.getenv("WHATCHIMP_API_TOKEN", ""))
    phone_number_id = get_setting("whatchimp_phone_id", os.getenv("WHATCHIMP_PHONE_ID", ""))
    
    if not api_token or not phone_number_id:
        return {"success": False, "message": "Credenciais do WhatChimp não configuradas"}
        
    result = get_whatchimp_conversation(api_token, phone_number_id, phone_number, limit, offset)
    return {"success": True, "data": result}

@app.get("/whatsapp/status/{wa_message_id}")
def get_whatsapp_status(wa_message_id: str):
    from core.whatsapp import get_whatchimp_message_status
    from core.database import get_setting
    import os
    
    api_token = get_setting("whatchimp_api_token", os.getenv("WHATCHIMP_API_TOKEN", ""))
    
    if not api_token:
        return {"success": False, "message": "API Token do WhatChimp não configurado"}
        
    try:
        res = get_whatchimp_message_status(api_token, wa_message_id)
        if str(res.get("status")) == "1":
            return {"success": True, "data": res.get("message", {})}
        else:
            return {"success": False, "message": res.get("message", "Erro desconhecido")}
    except Exception as e:
        logger.error(f"Erro ao buscar status WhatChimp: {e}")
        return {"success": False, "message": str(e)}

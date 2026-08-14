import sqlite3
import json
import os
from datetime import datetime
from core.logger import get_logger

logger = get_logger("Database")

DB_PATH = os.path.join("db", "ctr_database.db")

def get_connection():
    if not os.path.exists("db"):
        os.makedirs("db", exist_ok=True)
    # timeout=20 previne o erro "database is locked" quando há concorrência entre threads
    return sqlite3.connect(DB_PATH, timeout=20.0)

def init_db():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Tabela para guardar o estado completo de cada sessão (substitui os ficheiros .json)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id_ctr TEXT PRIMARY KEY,
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                queue_data_json TEXT
            )
        """)
        
        # Tabela para guardar configurações globais (Admin)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        # Tabela para Fila de Conversão de Múltiplos CTRs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversion_jobs (
                job_id TEXT PRIMARY KEY,
                id_ctr TEXT,
                status TEXT,
                progress INTEGER,
                message TEXT,
                file_path TEXT,
                params_json TEXT,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            )
        """)

        # Tabela para Fila de Envia de WhatsApp para Múltiplos CTRs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sending_jobs (
                job_id TEXT PRIMARY KEY,
                id_ctr TEXT,
                status TEXT,
                send_mode TEXT,
                params_json TEXT,
                scheduled_at TIMESTAMP,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            )
        """)
        try:
            cursor.execute("ALTER TABLE sending_jobs ADD COLUMN scheduled_at TIMESTAMP")
        except Exception:
            pass

        conn.commit()
        conn.close()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing DB: {e}")

def save_session(id_ctr, queue_data):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        queue_json = json.dumps(queue_data, ensure_ascii=False)
        
        # Verifica se já existe
        cursor.execute("SELECT created_at FROM sessions WHERE id_ctr = ?", (id_ctr,))
        row = cursor.fetchone()
        
        if row:
            cursor.execute("""
                UPDATE sessions 
                SET updated_at = ?, queue_data_json = ? 
                WHERE id_ctr = ?
            """, (now, queue_json, id_ctr))
        else:
            cursor.execute("""
                INSERT INTO sessions (id_ctr, created_at, updated_at, queue_data_json)
                VALUES (?, ?, ?, ?)
            """, (id_ctr, now, now, queue_json))
            
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error saving session {id_ctr}: {e}")

def load_session(id_ctr):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT queue_data_json FROM sessions WHERE id_ctr = ?", (id_ctr,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception as e:
        logger.error(f"Error loading session {id_ctr}: {e}")
        return None

def get_all_sessions():
    """Returns a list of dicts with session metadata"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id_ctr, updated_at FROM sessions ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        
        return [{"id_ctr": row[0], "updated_at": row[1]} for row in rows]
    except Exception as e:
        logger.error(f"Error getting all sessions: {e}")
        return []

def delete_session(id_ctr):
    """Deletes a session record from the database by id_ctr"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE id_ctr = ?", (id_ctr,))
        conn.commit()
        conn.close()
        logger.info(f"Session {id_ctr} deleted from DB.")
        return True
    except Exception as e:
        logger.error(f"Error deleting session {id_ctr}: {e}")
        return False

def update_message_status_from_webhook(wa_message_id, new_status):
    """
    Pesquisa nas últimas sessões pelo wa_message_id e atualiza o estado para o new_status.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        # Buscar as últimas 50 sessões (são as mais propensas a receber updates recentes)
        cursor.execute("SELECT id_ctr, queue_data_json FROM sessions ORDER BY updated_at DESC LIMIT 50")
        rows = cursor.fetchall()
        
        updated = False
        target_id_ctr = None
        target_queue_json = None
        
        for row in rows:
            id_ctr = row[0]
            try:
                queue = json.loads(row[1]) if row[1] else []
            except Exception:
                continue
                
            for item in queue:
                # Pode ser Normal ou Levantamento
                if str(item.get("wa_message_id")) == str(wa_message_id):
                    # Encontrou o alvo no modo Normal
                    if new_status.lower() == 'read': item['status'] = 'Lido'
                    elif new_status.lower() == 'delivered': item['status'] = 'Entregue'
                    elif new_status.lower() == 'failed': item['status'] = 'Falhou'
                    updated = True
                
                if str(item.get("wa_message_id_levantamento")) == str(wa_message_id):
                    # Encontrou o alvo no modo Levantamento
                    if new_status.lower() == 'read': item['status_levantamento'] = 'Lido'
                    elif new_status.lower() == 'delivered': item['status_levantamento'] = 'Entregue'
                    elif new_status.lower() == 'failed': item['status_levantamento'] = 'Falhou'
                    updated = True
                    
            if updated:
                target_id_ctr = id_ctr
                target_queue_json = json.dumps(queue, ensure_ascii=False)
                break
                
        if updated and target_id_ctr:
            cursor.execute("""
                UPDATE sessions 
                SET queue_data_json = ?, updated_at = ?
                WHERE id_ctr = ?
            """, (target_queue_json, datetime.now(), target_id_ctr))
            conn.commit()
            logger.info(f"Estado da mensagem {wa_message_id} atualizado para {new_status} no CTR {target_id_ctr}")
            
        conn.close()
        return updated
    except Exception as e:
        logger.error(f"Erro ao processar atualização do webhook: {e}")
        return False

# --- Configurações / Settings ---

def save_setting(key, value):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, value))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error saving setting {key}: {e}")

def get_setting(key, default=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        
        if row and row[0]:
            return row[0]
        return default
    except Exception as e:
        logger.error(f"Error getting setting {key}: {e}")
        return default

def get_general_metrics():
    """Computes aggregate reporting statistics across all processed sessions including WhatsApp read receipts and delivery metrics"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id_ctr, updated_at, queue_data_json FROM sessions ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        
        cursor.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'gdrive_folder_id_%' AND value != ''")
        gdrive_row = cursor.fetchone()
        gdrive_count = gdrive_row[0] if gdrive_row else 0
        
        conn.close()
        
        total_projects = len(rows)
        total_messages = 0
        total_sent = 0
        total_delivered = 0
        total_read = 0
        total_errors = 0
        total_pending = 0
        unique_clients = set()
        recent_projects = []
        
        for idx, (id_ctr, updated_at, queue_json) in enumerate(rows):
            try:
                queue = json.loads(queue_json) if queue_json else []
            except Exception:
                queue = []
                
            proj_total = 0
            proj_sent = 0
            proj_delivered = 0
            proj_read = 0
            proj_errors = 0
            proj_pending = 0
            
            for item in queue:
                client_id = item.get("id_code") or item.get("codigo")
                if client_id:
                    unique_clients.add(str(client_id).strip())

                # Verificar estado normal e levantamento
                statuses_to_check = []
                if item.get("status"):
                    statuses_to_check.append(str(item.get("status")).lower())
                if item.get("status_levantamento"):
                    statuses_to_check.append(str(item.get("status_levantamento")).lower())
                if not statuses_to_check:
                    statuses_to_check.append("pendente")

                for st in statuses_to_check:
                    total_messages += 1
                    proj_total += 1
                    
                    if "lido" in st or "read" in st:
                        total_read += 1
                        total_delivered += 1
                        total_sent += 1
                        proj_read += 1
                        proj_delivered += 1
                        proj_sent += 1
                    elif "entregue" in st or "delivered" in st:
                        total_delivered += 1
                        total_sent += 1
                        proj_delivered += 1
                        proj_sent += 1
                    elif "enviado" in st or "sucesso" in st or "success" in st or "sent" in st:
                        total_sent += 1
                        proj_sent += 1
                    elif "falha" in st or "erro" in st or "sem contacto" in st or "error" in st or "failed" in st:
                        total_errors += 1
                        proj_errors += 1
                    else:
                        total_pending += 1
                        proj_pending += 1
            
            if idx < 100:
                recent_projects.append({
                    "id_ctr": id_ctr,
                    "updated_at": str(updated_at)[:16].replace("T", " "),
                    "total": proj_total,
                    "sent": proj_sent,
                    "delivered": proj_delivered,
                    "read": proj_read,
                    "success": proj_sent,
                    "error": proj_errors,
                    "pending": proj_pending
                })
                
        delivery_rate = round((total_delivered / total_messages * 100), 1) if total_messages > 0 else 0.0
        read_rate = round((total_read / total_messages * 100), 1) if total_messages > 0 else 0.0
        success_rate = round((total_sent / total_messages * 100), 1) if total_messages > 0 else 0.0
        
        return {
            "total_projects": total_projects,
            "total_messages": total_messages,
            "total_sent": total_sent,
            "total_delivered": total_delivered,
            "total_read": total_read,
            "total_success": total_sent,
            "total_errors": total_errors,
            "total_pending": total_pending,
            "success_rate": success_rate,
            "delivery_rate": delivery_rate,
            "read_rate": read_rate,
            "unique_clients": len(unique_clients),
            "gdrive_synced": gdrive_count,
            "recent_projects": recent_projects
        }
    except Exception as e:
        logger.error(f"Error computing general metrics: {e}")
        return {
            "total_projects": 0, "total_messages": 0, "total_sent": 0, "total_delivered": 0, "total_read": 0,
            "total_success": 0, "total_errors": 0, "total_pending": 0, "success_rate": 0.0, "delivery_rate": 0.0,
            "read_rate": 0.0, "unique_clients": 0, "gdrive_synced": 0, "recent_projects": []
        }

# --- FUNÇÕES DE CONTROLE DAS FILAS PERSISTENTES (CONVERSÃO & ENVIO) ---

def save_conversion_job(job_id, id_ctr, status, progress, message, file_path, params_dict):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        params_json = json.dumps(params_dict, ensure_ascii=False)
        cursor.execute("""
            INSERT OR REPLACE INTO conversion_jobs (job_id, id_ctr, status, progress, message, file_path, params_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (job_id, id_ctr, status, progress, message, file_path, params_json, now, now))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error saving conversion job {job_id}: {e}")

def update_conversion_job_status(job_id, status, progress=None, message=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        fields = ["status = ?", "updated_at = ?"]
        values = [status, now]
        if progress is not None:
            fields.append("progress = ?")
            values.append(progress)
        if message is not None:
            fields.append("message = ?")
            values.append(message)
        values.append(job_id)
        cursor.execute(f"UPDATE conversion_jobs SET {', '.join(fields)} WHERE job_id = ?", tuple(values))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating conversion job {job_id}: {e}")

def get_all_conversion_jobs(status=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT job_id, id_ctr, status, progress, message, file_path, params_json, created_at FROM conversion_jobs WHERE status = ? ORDER BY created_at ASC", (status,))
        else:
            cursor.execute("SELECT job_id, id_ctr, status, progress, message, file_path, params_json, created_at FROM conversion_jobs ORDER BY created_at ASC")
        rows = cursor.fetchall()
        conn.close()
        jobs = []
        for r in rows:
            jobs.append({
                "job_id": r[0],
                "id_ctr": r[1],
                "status": r[2],
                "progress": r[3],
                "message": r[4],
                "file_path": r[5],
                "params": json.loads(r[6]) if r[6] else {},
                "created_at": str(r[7])
            })
        return jobs
    except Exception as e:
        logger.error(f"Error fetching conversion jobs: {e}")
        return []

def delete_conversion_job(job_id):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM conversion_jobs WHERE job_id = ?", (job_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error deleting conversion job {job_id}: {e}")

def save_sending_job(job_id, id_ctr, status, send_mode, params_dict, scheduled_at=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        params_json = json.dumps(params_dict, ensure_ascii=False)
        cursor.execute("""
            INSERT OR REPLACE INTO sending_jobs (job_id, id_ctr, status, send_mode, params_json, scheduled_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (job_id, id_ctr, status, send_mode, params_json, scheduled_at, now, now))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error saving sending job {job_id}: {e}")

def update_sending_job_status(job_id, status):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        cursor.execute("UPDATE sending_jobs SET status = ?, updated_at = ? WHERE job_id = ?", (status, now, job_id))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating sending job {job_id}: {e}")

def get_all_sending_jobs(status=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT job_id, id_ctr, status, send_mode, params_json, created_at, scheduled_at FROM sending_jobs WHERE status = ? ORDER BY created_at ASC", (status,))
        else:
            cursor.execute("SELECT job_id, id_ctr, status, send_mode, params_json, created_at, scheduled_at FROM sending_jobs ORDER BY created_at ASC")
        rows = cursor.fetchall()
        conn.close()
        jobs = []
        for r in rows:
            jobs.append({
                "job_id": r[0],
                "id_ctr": r[1],
                "status": r[2],
                "send_mode": r[3],
                "params": json.loads(r[4]) if r[4] else {},
                "created_at": str(r[5]),
                "scheduled_at": str(r[6]) if r[6] else None
            })
        return jobs
    except Exception as e:
        logger.error(f"Error fetching sending jobs: {e}")
        return []

def delete_sending_job(job_id):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sending_jobs WHERE job_id = ?", (job_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error deleting sending job {job_id}: {e}")

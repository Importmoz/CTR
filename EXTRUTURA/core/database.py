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

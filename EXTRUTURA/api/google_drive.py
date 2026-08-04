import os
import json
from core.database import get_setting, save_setting
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from core.logger import get_logger

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

logger = get_logger("GoogleDrive")

SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]

def get_client_secrets_file():
    base_dir = os.path.dirname(os.path.dirname(__file__)) # EXTRUTURA
    root_dir = os.path.dirname(base_dir) # EXTRUTURA_CTR
    
    file1 = os.path.join(base_dir, "google-oauth.json")
    file2 = os.path.join(root_dir, "google-oauth.json")
    
    if os.path.exists(file1): return file1
    if os.path.exists(file2): return file2
    return None

def get_google_flow(redirect_uri=None):
    if redirect_uri is None:
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://m447cyfq0dvffd1xwstwi1ca.144.91.110.199.sslip.io/api/google/auth/callback")
    client_secrets_file = get_client_secrets_file()
    if not client_secrets_file:
        return None
    
    flow = Flow.from_client_secrets_file(
        client_secrets_file,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )
    return flow

def get_gdrive_service():
    token_json_str = get_setting("google_oauth_token", "")
    if not token_json_str.strip():
        return None, None
        
    try:
        creds_info = json.loads(token_json_str)
        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)
        
        service = build('drive', 'v3', credentials=creds)
        # We don't have client_email directly in user credentials, so we return empty or try to fetch user info
        return service, ""
    except Exception as e:
        logger.error(f"Erro ao autenticar Google Drive (OAuth): {e}")
        return None, None

def create_folder(service, name, parent_id):
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    file = service.files().create(body=file_metadata, fields='id').execute()
    return file.get('id')

def upload_file(service, file_path, name, parent_id, convert_to_gsheet=False):
    file_metadata = {
        'name': name,
        'parents': [parent_id]
    }
    if convert_to_gsheet:
        file_metadata['mimeType'] = 'application/vnd.google-apps.spreadsheet'
        
    media = MediaFileUpload(file_path, resumable=True)
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

def create_local_gsheet_shortcut(gdrive_file_id, dest_path, creds_email):
    shortcut_data = {
        "url": f"https://docs.google.com/open?id={gdrive_file_id}",
        "doc_id": gdrive_file_id,
        "email": creds_email
    }
    with open(dest_path, "w", encoding="utf-8") as f:
        json.dump(shortcut_data, f)

def upload_folder_recursive(service, local_folder, parent_id):
    """Sobe uma pasta e todos os seus subdiretórios e ficheiros para o Google Drive."""
    for item in os.listdir(local_folder):
        item_path = os.path.join(local_folder, item)
        if os.path.isdir(item_path):
            if item == "info": # Não fazemos upload da pasta info temporária
                continue
            new_folder_id = create_folder(service, item, parent_id)
            upload_folder_recursive(service, item_path, new_folder_id)
        elif os.path.isfile(item_path):
            if item.endswith(".xlsx") and item.startswith("Lista_"):
                # Já tratado separadamente
                continue
            if item.endswith(".gsheet"):
                continue
            
            # Simple mimetype detection based on extension
            mime_type = None
            if item.endswith(".png"): mime_type = "image/png"
            elif item.endswith(".md"): mime_type = "text/markdown"
            elif item.endswith(".pdf"): mime_type = "application/pdf"
            
            file_metadata = {'name': item, 'parents': [parent_id]}
            media = MediaFileUpload(item_path, mimetype=mime_type, resumable=True)
            try:
                service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            except Exception as e:
                logger.error(f"Erro ao subir ficheiro {item}: {e}")


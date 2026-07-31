import requests
import cloudscraper
import os
from .logger import get_logger

logger = get_logger("WhatsAppAPI")

def upload_whatchimp_media(api_token, phone_number_id, image_path):
    url = "https://app.whatchimp.com/api/v1/whatsapp/upload/media"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    payload = {'phone_number_id': phone_number_id}
    
    logger.info(f"Uploading media: {image_path}")
    
    try:
        with open(image_path, 'rb') as f:
            files = [('media_file', (os.path.basename(image_path), f, 'image/png'))]
            scraper = cloudscraper.create_scraper()
            response = scraper.post(url, headers=headers, data=payload, files=files, timeout=30)
            try:
                result = response.json()
            except Exception as json_err:
                logger.error(f"Upload falhou. Code: {response.status_code}, Body: {response.text}")
                return {"status": "0", "message": f"Non-JSON response: {response.text[:100]}"}
                
            if str(result.get("status")) != "1":
                logger.error(f"Upload falhou: {result}")
            return result
    except Exception as e:
        logger.error(f"Erro de exceção no upload: {e}")
        return {"status": "0", "message": str(e)}

def extract_phone_numbers(raw_phone):
    """
    Extrai todos os números de telefone válidos de uma string/célula que pode conter 1 ou múltiplos números.
    Suporta separadores por espaços, barras (/), vírgulas, etc.
    Exemplos:
    - "867066505" -> ["258867066505"]
    - "845467054 875467051" -> ["258845467054", "258875467051"]
    - "823229394  843229294 863329394" -> ["258823229394", "258843229294", "258863329394"]
    """
    if not raw_phone or str(raw_phone).strip() in ['nan', 'None', '']:
        return []
    
    import re
    s = str(raw_phone).replace('.0', '').strip()
    digits_only = re.sub(r'\D', '', s)
    
    # Procura por números de 9 dígitos iniciados por 8 (opcionalmente com 258 na frente)
    matches = re.findall(r'(?:258)?(8\d{8})', digits_only)
    
    phone_list = []
    for m in matches:
        full_num = f"258{m}"
        if full_num not in phone_list:
            phone_list.append(full_num)
            
    # Fallback: Se não encontrou 8XXXXXXXX padrão, separa por delimitadores genéricos
    if not phone_list:
        parts = re.split(r'[\s/,\n;\t|]+', s)
        for part in parts:
            d = re.sub(r'\D', '', part)
            if len(d) == 9 and d.startswith('8'):
                d = f"258{d}"
            if 8 <= len(d) <= 15 and d not in phone_list:
                phone_list.append(d)
                
    return phone_list

def send_whatchimp_template(api_token, phone_number_id, phone_number, template_id, variables=None):
    url = "https://app.whatchimp.com/api/v1/whatsapp/send/template"
    
    # Limpa e formata o número de telefone
    phone_str = str(phone_number).replace("+", "").replace(" ", "").replace("-", "").strip()
    if phone_str.endswith(".0"):
        phone_str = phone_str[:-2]
    
    # Se for um número de Moçambique de 9 dígitos, adiciona o 258
    if len(phone_str) == 9 and phone_str.startswith("8"):
        phone_str = f"258{phone_str}"
        
    payload = {
        'apiToken': api_token,
        'phone_number_id': phone_number_id,
        'phone_number': phone_str,
        'template_id': template_id
    }
    if variables:
        import re
        cleaned_vars = {}
        for k, v in variables.items():
            if isinstance(v, str):
                # Substitui parágrafos e tabs por espaços
                v = v.replace('\n', ' ').replace('\t', ' ').replace('\r', '')
                # Substitui múltiplos espaços seguidos por um só espaço
                v = re.sub(r'\s{2,}', ' ', v)
                cleaned_vars[k] = v.strip()
            else:
                cleaned_vars[k] = v
        payload.update(cleaned_vars)
    
    logger.info(f"Sending template {template_id} to {phone_str}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        scraper = cloudscraper.create_scraper()
        response = scraper.post(url, headers=headers, data=payload, timeout=30)
        try:
            result = response.json()
        except Exception as json_err:
            logger.error(f"Template falhou. Code: {response.status_code}, Body: {response.text}")
            return {"status": "0", "message": f"Non-JSON response: {response.text[:100]}"}
            
        if str(result.get("status")) != "1":
            logger.error(f"Template falhou: {result}")
        return result
    except Exception as e:
        logger.error(f"Erro de exceção no template: {e}")
        return {"status": "0", "message": str(e)}

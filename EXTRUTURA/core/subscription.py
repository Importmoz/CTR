import os
import requests
from datetime import datetime, timedelta
from core.database import get_setting, save_setting
from core.logger import get_logger

logger = get_logger("Subscription")

# Utilizar a chave de API fornecida para modo de teste
CREEM_API_KEY = os.getenv("CREEM_API_KEY", "creem_test_4rcFgtrtHTZLCvVCg7tq65")
# Base URL da API v1 do Creem (test-api para chaves _test)
CREEM_API_URL = "https://test-api.creem.io/v1" if "test_" in CREEM_API_KEY else "https://api.creem.io/v1"

class SubscriptionManager:
    _cache_status = None
    _cache_time = None
    CACHE_DURATION_MINUTES = 60

    @classmethod
    def get_cached_status(cls):
        """Retorna o estado da cache, minimizando chamadas à API."""
        if cls._cache_status and cls._cache_time:
            if datetime.now() - cls._cache_time < timedelta(minutes=cls.CACHE_DURATION_MINUTES):
                return cls._cache_status
        return None

    @classmethod
    def update_cache(cls, status_data):
        cls._cache_status = status_data
        cls._cache_time = datetime.now()

    @classmethod
    def check_subscription(cls, force_refresh=False):
        """
        Verifica a validade da subscrição.
        Retorna um dicionário: {"is_active": bool, "status": str, "subscription_id": str, "message": str}
        """
        subscription_id = get_setting("creem_subscription_id")
        
        if not subscription_id:
            return {
                "is_active": False,
                "status": "missing",
                "subscription_id": None,
                "message": "Nenhuma subscrição configurada. Por favor, ative a sua licença."
            }

        if not force_refresh:
            cached = cls.get_cached_status()
            if cached:
                return cached

        try:
            headers = {
                "x-api-key": CREEM_API_KEY,
                "Accept": "application/json"
            }
            url = f"{CREEM_API_URL}/subscriptions?subscription_id={subscription_id}"
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "").lower()
                
                # Estados ativos no Creem.io (active, trialing)
                is_active = status in ["active", "trialing"]
                
                result = {
                    "is_active": is_active,
                    "status": status,
                    "subscription_id": subscription_id,
                    "message": "Subscrição válida." if is_active else f"A sua subscrição encontra-se no estado: {status}.",
                    "details": {
                        "plan_name": data.get("product", {}).get("name", "Desconhecido"),
                        "price": data.get("product", {}).get("price", 0) / 100,
                        "currency": data.get("product", {}).get("currency", "USD"),
                        "customer_name": data.get("customer", {}).get("name", ""),
                        "customer_email": data.get("customer", {}).get("email", ""),
                        "current_period_start": data.get("current_period_start_date"),
                        "current_period_end": data.get("current_period_end_date"),
                    }
                }
                cls.update_cache(result)
                return result
            elif response.status_code == 404:
                return {
                    "is_active": False,
                    "status": "invalid",
                    "subscription_id": subscription_id,
                    "message": "O ID de subscrição fornecido é inválido ou não existe."
                }
            else:
                logger.error(f"Erro na API do Creem: {response.status_code} - {response.text}")
                return {
                    "is_active": False,
                    "status": "error",
                    "subscription_id": subscription_id,
                    "message": "Não foi possível validar a subscrição devido a um erro no servidor de faturação."
                }
        except Exception as e:
            logger.error(f"Exceção ao verificar subscrição: {e}")
            # Em caso de falha de rede temporária, tentar usar a cache expirada se existir
            if cls._cache_status:
                return cls._cache_status
                
            return {
                "is_active": False,
                "status": "network_error",
                "subscription_id": subscription_id,
                "message": "Erro de ligação ao validar subscrição. Verifique a internet."
            }

    @classmethod
    def activate_subscription(cls, subscription_id):
        """
        Salva o novo ID e força uma verificação.
        """
        if not subscription_id:
            return {"is_active": False, "message": "ID de subscrição vazio."}
            
        save_setting("creem_subscription_id", subscription_id.strip())
        return cls.check_subscription(force_refresh=True)

    @classmethod
    def clear_subscription(cls):
        save_setting("creem_subscription_id", "")
        cls._cache_status = None
        cls._cache_time = None
        return {"is_active": False, "message": "Subscrição removida."}

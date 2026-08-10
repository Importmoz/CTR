import os
import requests
from datetime import datetime, timedelta
from core.database import get_setting, save_setting
from core.logger import get_logger

logger = get_logger("Subscription")

# Chave da API do Lemon Squeezy fornecida pelo utilizador
LEMONSQUEEZY_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY", "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiJjYjliNWNhMzFiODlmNGM2ZWViMDY1YjlkNzBkMTI2NTM0ZDU1NGM0NWUyMGQyN2MxZDZiNDRlMTg0NTg2NmQ1N2U2NTlmMmRiNjQwMDQ3ZiIsImlhdCI6MTc4NjM3MDcxNy4yNzExMywibmJmIjoxNzg2MzcwNzE3LjI3MTEzMywiZXhwIjoxODAyMjE3NjAwLjA0MTUwNCwic3ViIjoiNzY5MDA1OCIsInNjb3BlcyI6W119.E-d27NCcxUdCUB6sBsWz3ipXKJFp08auafp6jzYOKLc7aaj62WktQHSvmbhNryyal2kwzwZ-54llWngCzvMtamP-Rsmd4y8CPhI6nfygxDoo2kLg6clydxkUQjkU8YOtbS8ynPQ6f1MrbEytBYvUDCJIbAsncVjRq8PJejspFnVP_fzccoazdHVpAClNKDH-b4uWBAythwDUWfMKCd_Pg82GyEpyfhxjYbdlk0f-lpQnafYQBt78UDklTdRfVynAEw6nVTXmJyFOgGH_0liTbu-0m9WGN_JTZBYwINWBrQx2R_bYPyIs-L1onTZCbkFVT8ALNUW-5E3hvgzeke0OjGRsWo4UdxGDWlxJkSo7Y0JfgXZDugNxjksmaZPqZldRybN-uHGhJxq9ch10Gv_YvR8waUJfn3QsAmh5YZ3RcA4tIlJz2sD161OXbT6hoNjQh_EDJtXL7pP2zFIeJsLKdBqTbM8l2pwCOr8uLXVhB2YMS9XJIBUhT8c-ygUF1WJOmm88bqBCiD2Wu4tikeAx7cTRkUBwkvfLkpEkXAgpKbFxe8RDSu5B964JAZxKFZc8FDUQC6IzK196zxmSyqPpNyyG4kdATPz_9rL_KFveIUPkFExmJVumyZ2mCBLZmF6ImyKrL2VCI853b3s1r-m97oz5Qc68CwQLG1hnZhBeAow")
LEMONSQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1"

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
        # FREE TRIAL TEMPORÁRIO (ENQUANTO LEMON SQUEEZY ESTÁ EM REVISÃO)
        return {
            "is_active": True,
            "status": "on_trial",
            "subscription_id": "free_trial_mode",
            "message": "Período Free Trial ativo (A aguardar revisão Lemon Squeezy).",
            "details": {
                "plan_name": "Plano Free Trial",
                "price": 0,
                "currency": "USD",
                "customer_name": "Modo Avaliação",
                "customer_email": "",
                "current_period_start": datetime.now().isoformat(),
                "current_period_end": (datetime.now() + timedelta(days=30)).isoformat(),
            }
        }

        try:
            headers = {
                "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
                "Accept": "application/vnd.api+json"
            }
            url = f"{LEMONSQUEEZY_API_URL}/subscriptions/{subscription_id}"
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                attributes = data.get("data", {}).get("attributes", {})
                status = attributes.get("status", "").lower()
                
                # Estados ativos no Lemon Squeezy (active, on_trial)
                is_active = status in ["active", "on_trial"]
                
                result = {
                    "is_active": is_active,
                    "status": status,
                    "subscription_id": subscription_id,
                    "message": "Subscrição válida." if is_active else f"A sua subscrição encontra-se no estado: {status}.",
                    "details": {
                        "plan_name": attributes.get("product_name", "Plano Lemon Squeezy"),
                        "price": 0,
                        "currency": "USD",
                        "customer_name": attributes.get("user_name", ""),
                        "customer_email": attributes.get("user_email", ""),
                        "current_period_start": attributes.get("created_at"),
                        "current_period_end": attributes.get("renews_at"),
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
                logger.error(f"Erro na API da Lemon Squeezy: {response.status_code} - {response.text}")
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
            
        save_setting("lemonsqueezy_subscription_id", subscription_id.strip())
        return cls.check_subscription(force_refresh=True)

    @classmethod
    def clear_subscription(cls):
        save_setting("lemonsqueezy_subscription_id", "")
        cls._cache_status = None
        cls._cache_time = None
        return {"is_active": False, "message": "Subscrição removida."}

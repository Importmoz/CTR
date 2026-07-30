import logging
import os

def get_logger(name="ProcessadorCTR"):
    if not os.path.exists('logs'):
        os.makedirs('logs', exist_ok=True)
        
    logger = logging.getLogger(name)
    
    # Avoid adding multiple handlers se já estiver inicializado
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # File handler
        fh = logging.FileHandler('logs/erros_sistema.log', encoding='utf-8')
        fh.setLevel(logging.INFO)
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setLevel(logging.ERROR)
        
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)
        
        logger.addHandler(fh)
        logger.addHandler(ch)
        
    return logger

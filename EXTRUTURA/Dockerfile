# Imagem base oficial do Python
FROM python:3.10-slim

# Definir o diretório de trabalho no container
WORKDIR /app

# Instalar as dependências do sistema operativo necessárias (Chromium para o html2image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    libnss3 \
    fontconfig \
    fonts-liberation \
    libxrender1 \
    libxext6 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar os ficheiros de dependências
COPY requirements.txt .

# Instalar os pacotes Python otimizados (uso de binários para não estourar a memória RAM da nuvem)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary pandas numpy Pillow openpyxl xlsxwriter xlrd && \
    pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta do servidor FastAPI
EXPOSE 8000

# Definir volume de dados persistente para a base de dados SQLite (db/ctr_database.db) e sessões
VOLUME ["/app/db"]

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1

# Comando para iniciar o servidor Backend (FastAPI via Uvicorn)
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

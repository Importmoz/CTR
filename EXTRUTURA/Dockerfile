# Imagem base oficial do Python
FROM python:3.10-slim

# Definir o diretório de trabalho no container
WORKDIR /app

# Instalar as dependências do sistema operativo necessárias (Chromium para o html2image)
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libgconf-2-4 \
    fontconfig \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Copiar os ficheiros de dependências
COPY requirements.txt .

# Instalar os pacotes Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o restante do código da aplicação
COPY . .

# Expor a porta do servidor FastAPI
EXPOSE 8000

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1

# Comando para iniciar o servidor Backend (FastAPI via Uvicorn)
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

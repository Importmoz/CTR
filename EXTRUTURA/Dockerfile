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

# Expor o porto que o Streamlit usa (por defeito 8501)
EXPOSE 8501

# Variável de ambiente indicando ao Streamlit como rodar sem interface e numa cloud
ENV PYTHONUNBUFFERED=1
ENV STREAMLIT_SERVER_PORT=8501
ENV STREAMLIT_SERVER_ADDRESS=0.0.0.0

# Comando para iniciar a aplicação (com flags explícitas para evitar falhas de rede no Docker)
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]

# 🚀 CTR System - Automação de Processamento de Cargas e WhatsApp

O **CTR System** é uma plataforma completa para processamento automático de dados de carga (Excel), geração automatizada de relatórios visuais (tabelas formatadas e cortadas em imagem PNG) e disparo automatizado de notificações via **WhatsApp Meta API** (através da integração WhatChimp).

---

## 🛠️ Arquitetura do Sistema

O projeto é composto por uma arquitetura moderna dividida em **Backend (FastAPI & Streamlit)** e **Frontend (React + Vite)**:

```
EXTRUTURA_CTR/
├── EXTRUTURA/                # Núcleo Backend & Aplicação Streamlit
│   ├── api/                  # Serviços REST FastAPI
│   │   ├── main.py           # Endpoints API (FastAPI)
│   │   ├── services.py       # Serviços de background & processamento Excel
│   │   └── google_drive.py   # Integração OAuth2 Google Drive API
│   ├── core/                 # Módulos de lógica central
│   │   ├── data_processor.py # Limpeza, validação e cálculo financeiro Excel
│   │   ├── database.py       # Gestão SQLite (persistência de sessões)
│   │   ├── media_generator.py# Geração de HTML/PNG com Html2Image/Chrome
│   │   ├── whatsapp.py       # Disparo de mensagens e upload de média WhatChimp
│   │   └── logger.py         # Registo central de logs e erros
│   ├── pages/                # Páginas Streamlit (Painel de Envio)
│   └── app.py                # Dashboard Streamlit legado
├── frontend/                 # Interface Web Moderna (React + Vite)
│   ├── src/
│   │   ├── pages/            # Páginas (Dashboard, SendPanel, History, Settings)
│   │   ├── App.jsx           # Rotas da aplicação
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── Dockerfile                # Dockerfile de produção (Backend + Headless Chrome)
├── .env.example              # Modelo de variáveis de ambiente
└── requirements.txt          # Dependências Python
```

---

## ✨ Funcionalidades Principais

1. **Processamento Inteligente de Ficheiros Excel**:
   - Limpeza automática de dados, consolidação de encomendas por cliente e formato monetário MZN.
   - Distribuição de contas bancárias (Padrão, FILIPE, JUPITER ou Alvo Personalizado).

2. **Geração Automatizada de Imagens PNG**:
   - Converte os dados formatados em cartões HTML estilizados e tira screenshots de alta resolução via **Headless Chrome**.
   - Recorte automático da área exata da tabela e compilação de ficheiros ZIP por contentor/sessão (`ID_CTR`).

3. **Disparo de Notificações via WhatsApp (WhatChimp)**:
   - Suporte a modelos (templates) aprovados pela Meta para Faturas e Lembretes de Levantamento.
   - **Extração inteligente de múltiplos números**: Deteta se uma célula contém múltiplos contactos (ex: `841234567 871234567`) e formata automaticamente para o código de país `258`.
   - Envio sequencial de templates de 2 partes com controlo de atraso (*delay*) para prevenir reordenação de mensagens.

4. **Integração com Google Drive**:
   - Cópia de segurança automática e upload dos relatórios ZIP para pastas dedicadas no Google Drive.

5. **Execução em Pano de Fundo (Background Threading)**:
   - O utilizador pode navegar livremente pela plataforma enquanto as tarefas pesadas correm sem bloquear a interface.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Python 3.10+**
- **Node.js 18+**
- **Google Chrome** instalado (necessário para a renderização de imagens com `Html2Image`)

---

### 1. Configurar o Backend (FastAPI)

```bash
# Entrar na pasta do backend
cd EXTRUTURA

# Instalar dependências Python
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp ../.env.example .env

# Executar o servidor FastAPI
python -m uvicorn api.main:app --reload --port 8000
```
O servidor FastAPI estará acessível em: `http://localhost:8000`  
Documentação Swagger automática: `http://localhost:8000/docs`

---

### 2. Configurar o Frontend (React + Vite)

```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependências Node
npm install

# Iniciar o servidor de desenvolvimento Vite
npm run dev
```
A interface do utilizador estará acessível em: `http://localhost:5173`

---

### 3. (Opcional) Executar a Interface Streamlit

Caso pretenda utilizar a interface original em Streamlit:

```bash
cd EXTRUTURA
streamlit run app.py
```

---

## 🐳 Execução via Docker

Para rodar todo o ambiente backend com Google Chrome Headless num contentor Docker:

```bash
# Construir a imagem Docker
docker build -t ctr-backend .

# Iniciar o contentor
docker run -d -p 8000:8000 --env-file .env ctr-backend
```

---

## 📡 Endpoints Principais da API (FastAPI)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/upload` | Envia ficheiro `.xlsx` e inicia o processamento em background |
| `GET` | `/api/sessions` | Lista todas as sessões e histórico de envios |
| `GET` | `/api/sessions/{id_ctr}` | Obtém o estado e a fila de mensagens de uma sessão |
| `POST` | `/api/send` | Inicia o disparo em lote de mensagens do WhatsApp |
| `POST` | `/api/stop/{id_ctr}` | Envia ordem de paragem ao worker em background |
| `GET` | `/api/drive/auth` | Inicia a autenticação OAuth2 com o Google Drive |

---

## 📄 Licença e Uso

Desenvolvido para **Importmoz / CTR**. Todos os direitos reservados.

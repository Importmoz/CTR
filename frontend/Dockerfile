# Etapa 1: Compilação Node e Vite (Build Stage)
FROM node:20-alpine as build-stage
WORKDIR /app

# Copiar ficheiros de gestão de dependências
COPY package*.json ./
RUN npm ci

# Copiar o código fonte do Frontend
COPY . .

# Aceitar e injetar as variáveis de ambiente em tempo de compilação
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Executar a build de produção otimizada do React Vite
RUN npm run build

# Etapa 2: Servidor Web Nginx ultra-leve (Production Stage)
FROM nginx:alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expor a porta 80 padronizada do servidor Web
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

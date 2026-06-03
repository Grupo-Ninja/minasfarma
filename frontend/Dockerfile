# Estágio 1: Build da aplicação
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# IMPORTANTE: Se o código usa essa variável, ela precisa ser injetada no build!
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Estágio 2: Servidor Nginx de Produção
FROM nginx:alpine

# Copia os arquivos gerados
COPY --from=build /app/dist /usr/share/nginx/html

# ADICIONE ISTO: Configuração do Nginx para lidar com SPAs (React Router)
RUN echo $'server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html index.htm; \n\
        # Tenta achar o arquivo. Se não achar, manda pro index.html (resolve erro 404 do React Router) \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

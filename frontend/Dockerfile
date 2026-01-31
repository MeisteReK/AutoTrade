# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Kopiowanie package files
COPY package*.json ./

# Instalacja zależności
RUN npm ci

# Kopiowanie kodu źródłowego
COPY . .

# Build argument dla API URL
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Build aplikacji
RUN npm run build

# Stage 2: Production (nginx)
FROM nginx:alpine

# Kopiowanie zbudowanych plików
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config (opcjonalnie - domyślna konfiguracja powinna działać)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


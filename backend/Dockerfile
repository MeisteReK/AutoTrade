FROM python:3.11-slim

WORKDIR /app

# Instalacja zależności systemowych
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Kopiowanie requirements i instalacja zależności
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiowanie kodu aplikacji
COPY . .

# Upewnij się, że katalog scrapera istnieje (będzie zamontowany jako volume)
RUN mkdir -p /app/../otomoto-webscrape

# Port dla FastAPI
EXPOSE 8000

# Uruchomienie serwera
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


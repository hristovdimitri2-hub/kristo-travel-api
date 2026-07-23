FROM python:3.11-slim

WORKDIR /app

# Системни зависимости за web3/библиотеки
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# Python зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Код
COPY kristo_api.py .

# Expose порт
EXPOSE 8000

# Старт
CMD ["python", "kristo_api.py"]
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY kristo_api.py .

EXPOSE 8000

CMD ["python", "kristo_api.py"]

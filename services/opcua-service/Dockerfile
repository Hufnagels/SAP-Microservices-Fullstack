FROM python:3.11-slim

WORKDIR /app

COPY services/opcua-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY shared /app/shared
COPY services/opcua-service /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

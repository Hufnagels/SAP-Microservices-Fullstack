FROM python:3.12-slim

WORKDIR /app

COPY services/binpack-service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/binpack-service/data /app/data
COPY services/binpack-service/app  /app/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

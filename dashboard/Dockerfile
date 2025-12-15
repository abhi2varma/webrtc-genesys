FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY registration_api.py .

EXPOSE 5000

CMD ["python", "-u", "registration_api.py"]


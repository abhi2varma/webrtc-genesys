FROM python:3.11-slim

WORKDIR /app

# Install docker CLI for Kamailio status checks
RUN apt-get update && \
    apt-get install -y docker.io && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY registration_api.py .

EXPOSE 5000

CMD ["python", "-u", "registration_api.py"]


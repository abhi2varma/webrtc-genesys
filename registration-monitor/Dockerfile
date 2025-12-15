FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy monitoring script
COPY registration_monitor.py .
RUN chmod +x registration_monitor.py

# Run as non-root user
RUN useradd -m -u 1000 monitor
USER monitor

CMD ["python", "-u", "registration_monitor.py"]


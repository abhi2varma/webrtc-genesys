FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir flask flask-cors

# Copy application files
COPY sip-dashboard.py /app/
COPY requirements.txt /app/

# Create log mount point
RUN mkdir -p /logs

# Expose port
EXPOSE 5000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV LOG_PATH=/logs

# Run the application
CMD ["python", "sip-dashboard.py"]

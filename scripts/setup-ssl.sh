#!/bin/bash
# Setup SSL certificates for WebRTC (HTTPS + WSS)

set -e

echo "=== Setting up SSL for WebRTC Gateway ==="

# Create directories
mkdir -p nginx/ssl
mkdir -p kamailio/ssl

# Generate self-signed certificate (valid for 1 year)
# In production, use Let's Encrypt or a proper CA certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/webrtc.key \
    -out nginx/ssl/webrtc.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=192.168.210.54"

# Copy for Kamailio
cp nginx/ssl/webrtc.crt kamailio/ssl/
cp nginx/ssl/webrtc.key kamailio/ssl/

# Set permissions
chmod 600 nginx/ssl/webrtc.key kamailio/ssl/webrtc.key
chmod 644 nginx/ssl/webrtc.crt kamailio/ssl/webrtc.crt

echo "✓ SSL certificates generated"
echo "✓ Certificate: nginx/ssl/webrtc.crt"
echo "✓ Private key: nginx/ssl/webrtc.key"
echo ""
echo "IMPORTANT: This is a self-signed certificate."
echo "Browsers will show a security warning - you need to click 'Advanced' and 'Proceed'."
echo ""
echo "Next steps:"
echo "1. Run: docker-compose down"
echo "2. Run: docker-compose up -d"
echo "3. Access: https://192.168.210.54:8443"
echo "4. Accept the security warning in your browser"


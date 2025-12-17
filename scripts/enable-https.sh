#!/bin/bash
# Enable HTTPS for WebRTC Gateway on 192.168.210.54

set -e

SERVER_IP="192.168.210.54"

echo "=== Enabling HTTPS for WebRTC Gateway ==="
echo ""

# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate
echo "📜 Generating SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/webrtc.key \
    -out nginx/ssl/webrtc.crt \
    -subj "/C=US/ST=State/L=City/O=WebRTC-Gateway/CN=${SERVER_IP}" \
    2>/dev/null

# Set permissions
chmod 600 nginx/ssl/webrtc.key
chmod 644 nginx/ssl/webrtc.crt

echo "✓ SSL certificates generated"
echo ""

# Deploy to server
echo "📤 Deploying to ${SERVER_IP}..."

# Copy files to server
scp -r nginx/ssl Gencct@${SERVER_IP}:/tmp/
scp nginx/nginx.conf Gencct@${SERVER_IP}:/tmp/
scp nginx/html/index.html Gencct@${SERVER_IP}:/tmp/
scp docker-compose.yml Gencct@${SERVER_IP}:/tmp/

# Execute on server
ssh Gencct@${SERVER_IP} << 'ENDSSH'
cd /home/Gencct/webrtc-genesys

# Backup current files
echo "📦 Creating backup..."
cp -r nginx/ssl nginx/ssl.bak 2>/dev/null || true
cp nginx/nginx.conf nginx/nginx.conf.bak 2>/dev/null || true

# Copy new files
echo "📋 Installing new configuration..."
sudo mv /tmp/ssl nginx/ 2>/dev/null || sudo cp -r /tmp/ssl nginx/
sudo mv /tmp/nginx.conf nginx/
sudo mv /tmp/index.html nginx/html/
sudo mv /tmp/docker-compose.yml .

# Restart services
echo "🔄 Restarting services..."
sudo docker-compose down
sudo docker-compose up -d

echo "✓ Services restarted"
echo ""
echo "=== HTTPS Enabled Successfully! ==="
echo ""
echo "🌐 Access URL: https://192.168.210.54:8443"
echo "⚠️  Browser Warning: You'll see a security warning (self-signed cert)"
echo "   Click 'Advanced' → 'Proceed to 192.168.210.54 (unsafe)'"
echo ""
echo "🔒 WebSocket URL: wss://192.168.210.54:8443/ws"
echo ""
ENDSSH

echo "✅ HTTPS deployment complete!"
echo ""
echo "Next steps:"
echo "1. Open: https://192.168.210.54:8443"
echo "2. Accept the security warning"
echo "3. Grant microphone permission when prompted"
echo "4. Register as 5001 and 5002 in separate tabs"
echo "5. Make a call!"


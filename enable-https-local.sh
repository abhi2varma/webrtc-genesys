#!/bin/bash
# Enable HTTPS for WebRTC Gateway (run directly on 192.168.210.54)

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
    -subj "/C=US/ST=State/L=City/O=WebRTC-Gateway/CN=${SERVER_IP}"

# Set permissions
chmod 600 nginx/ssl/webrtc.key
chmod 644 nginx/ssl/webrtc.crt

echo "✓ SSL certificates generated"
echo "  Certificate: nginx/ssl/webrtc.crt"
echo "  Private key: nginx/ssl/webrtc.key"
echo ""

# Restart services
echo "🔄 Restarting services with HTTPS enabled..."
sudo docker-compose down
sudo docker-compose up -d

echo ""
echo "✅ HTTPS Enabled Successfully!"
echo ""
echo "═══════════════════════════════════════════"
echo "🌐 Access URL: https://192.168.210.54:8443"
echo "═══════════════════════════════════════════"
echo ""
echo "⚠️  IMPORTANT: Browser Security Warning"
echo "    Your browser will show a warning because"
echo "    this is a self-signed certificate."
echo ""
echo "    To proceed:"
echo "    1. Click 'Advanced' or 'Show Details'"
echo "    2. Click 'Proceed to 192.168.210.54 (unsafe)'"
echo "       or 'Accept the Risk and Continue'"
echo ""
echo "═══════════════════════════════════════════"
echo "📞 Testing the Call:"
echo "═══════════════════════════════════════════"
echo ""
echo "Tab 1 (Extension 5001):"
echo "  1. Open: https://192.168.210.54:8443"
echo "  2. Accept security warning"
echo "  3. Agent DN: 5001"
echo "  4. Password: Genesys2024!WebRTC"
echo "  5. Click Connect → Wait for 'Registered'"
echo ""
echo "Tab 2 (Extension 5002):"
echo "  1. Open: https://192.168.210.54:8443 (new tab)"
echo "  2. Accept security warning"
echo "  3. Agent DN: 5002"
echo "  4. Password: Genesys2024!WebRTC"
echo "  5. Click Connect → Wait for 'Registered'"
echo ""
echo "Make the call:"
echo "  1. In Tab 1, enter '5002' in Dial Number"
echo "  2. Click Call button"
echo "  3. Allow microphone permission"
echo "  4. Tab 2 should ring!"
echo ""
echo "═══════════════════════════════════════════"


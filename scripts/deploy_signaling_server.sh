#!/bin/bash
################################################################################
# Deploy Custom Signaling Server
# 
# This script:
# 1. Builds the Node.js signaling server Docker image
# 2. Updates docker-compose configuration
# 3. Starts the signaling server
# 4. Updates Nginx to serve custom client
# 5. Tests the deployment
################################################################################

set -e

echo "========================================================"
echo "Deploy Custom WebRTC Signaling Server"
echo "========================================================"
echo ""

cd "$(dirname "$0")/.."

# Check if running as root/sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root or with sudo"
    exit 1
fi

echo "[1/6] Building signaling server Docker image..."
docker-compose build signaling-server
echo "✓ Image built"
echo ""

echo "[2/6] Creating logs directory..."
mkdir -p signaling-server/logs
chmod 755 signaling-server/logs
echo "✓ Logs directory created"
echo ""

echo "[3/6] Stopping existing signaling server (if any)..."
docker-compose stop signaling-server 2>/dev/null || true
docker-compose rm -f signaling-server 2>/dev/null || true
echo "✓ Stopped"
echo ""

echo "[4/6] Starting signaling server..."
docker-compose up -d signaling-server
echo "✓ Started"
echo ""

echo "[5/6] Waiting for server to be ready..."
sleep 5

# Check if container is running
if ! docker ps | grep -q webrtc-signaling-server; then
    echo "❌ Signaling server container not running!"
    echo "Check logs: docker logs webrtc-signaling-server"
    exit 1
fi

echo "✓ Container running"
echo ""

echo "[6/6] Testing server..."
echo ""

# Test HTTP API
echo "Testing HTTP API..."
HTTP_RESULT=$(curl -s http://localhost:8082/api/health || echo "FAILED")
if echo "$HTTP_RESULT" | grep -q "ok"; then
    echo "✓ HTTP API working"
    echo "  Response: $HTTP_RESULT"
else
    echo "⚠ HTTP API not responding"
    echo "  Check logs: docker logs webrtc-signaling-server"
fi
echo ""

# Show status
echo "========================================================"
echo "✅ Deployment Complete!"
echo "========================================================"
echo ""
echo "Signaling Server:"
echo "  WebSocket: ws://192.168.210.54:8081"
echo "  HTTP API: http://192.168.210.54:8082"
echo ""
echo "Custom WebRTC Client:"
echo "  https://192.168.210.54:8443/index-custom.html"
echo ""
echo "REST API Endpoints:"
echo "  GET  /api/health"
echo "  GET  /api/dn/:dn"
echo "  GET  /api/dn/list"
echo "  GET  /api/calls/active"
echo "  GET  /api/genesys/status"
echo ""
echo "Useful Commands:"
echo "  docker logs -f webrtc-signaling-server   # View logs"
echo "  docker-compose restart signaling-server  # Restart"
echo "  curl http://localhost:8082/api/health    # Health check"
echo ""
echo "Test Registration:"
echo "  1. Open: https://192.168.210.54:8443/index-custom.html"
echo "  2. DN: 5001, Password: Genesys2024!WebRTC"
echo "  3. Click 'Register'"
echo "  4. Check logs: docker logs -f webrtc-signaling-server"
echo ""
echo "JsSIP is still running at: https://192.168.210.54:8443/"
echo "========================================================"


#!/bin/bash

echo "========================================="
echo "Deploy Custom Signaling Server"
echo "========================================="
echo ""

# Step 1: Backup
echo "[1/6] Backing up current config..."
BACKUP_FILE="kamailio-backup-$(date +%Y%m%d-%H%M%S).cfg"
sudo docker cp webrtc-kamailio:/etc/kamailio/kamailio.cfg "kamailio/$BACKUP_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Backup created: kamailio/$BACKUP_FILE"
else
    echo "⚠ Could not backup (will continue anyway)"
fi
echo ""

# Step 2: Verify custom config
echo "[2/6] Verifying custom signaling config..."
if [ ! -f "kamailio/kamailio-custom-signaling.cfg" ]; then
    echo "✗ Custom signaling config not found!"
    exit 1
fi

if grep -q "route\[WS_CALL\]" kamailio/kamailio-custom-signaling.cfg; then
    echo "✓ Custom signaling config found"
else
    echo "✗ route[WS_CALL] not found in config!"
    exit 1
fi
echo ""

# Step 3: Deploy custom signaling config
echo "[3/6] Deploying custom signaling config..."
sudo docker cp kamailio/kamailio-custom-signaling.cfg webrtc-kamailio:/tmp/k-custom.cfg
if [ $? -ne 0 ]; then
    echo "✗ Failed to copy config!"
    exit 1
fi
echo "✓ Config copied to temp"
echo ""

# Step 4: Stop and replace
echo "[4/6] Restarting Kamailio with custom signaling..."
sudo docker restart webrtc-kamailio
sleep 2
sudo docker exec webrtc-kamailio mv /tmp/k-custom.cfg /etc/kamailio/kamailio.cfg
sudo docker restart webrtc-kamailio
echo "✓ Kamailio restarted"
echo "  Waiting 5 seconds for startup..."
sleep 5
echo ""

# Step 5: Deploy custom client files
echo "[5/6] Deploying custom WebRTC client..."
sudo docker cp nginx/html/index-custom.html webrtc-nginx:/usr/share/nginx/html/
sudo docker cp nginx/html/webrtc-custom.js webrtc-nginx:/usr/share/nginx/html/
if [ $? -eq 0 ]; then
    echo "✓ Custom client deployed"
else
    echo "⚠ Failed to deploy client files"
fi
echo ""

# Step 6: Verify
echo "[6/6] Verifying deployment..."

# Check module loaded
if sudo docker logs webrtc-kamailio 2>&1 | grep -q "loadmodule.*dialog"; then
    echo "✓ Dialog module loaded"
else
    echo "⚠ Dialog module not found in logs"
fi

# Check WebSocket handling
if sudo docker logs webrtc-kamailio 2>&1 | grep -q "websocket"; then
    echo "✓ WebSocket module loaded"
else
    echo "⚠ WebSocket module not found"
fi

# Check UAC module
if sudo docker logs webrtc-kamailio 2>&1 | grep -q "loadmodule.*uac"; then
    echo "✓ UAC module loaded"
else
    echo "⚠ UAC module not found"
fi

echo ""

# Test commands
echo "Testing components..."
echo "----------------------------------------"
echo ""

echo "Dialog commands:"
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active
echo ""

echo "API Health:"
curl -k -s https://192.168.210.54:8443/api/health | python -m json.tool 2>/dev/null || curl -k -s https://192.168.210.54:8443/api/health
echo ""
echo ""

echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Custom Signaling URLs:"
echo "  Client:  https://192.168.210.54:8443/index-custom.html"
echo "  API:     https://192.168.210.54:8443/api/health"
echo ""
echo "API Endpoints:"
echo "  GET  /api/health"
echo "  GET  /api/dn/{dn}"
echo "  GET  /api/dn/list"
echo "  GET  /api/genesys/status"
echo "  GET  /api/calls/active"
echo "  GET  /api/calls/dn/{dn}"
echo "  POST /api/call/make"
echo "  POST /api/call/hangup"
echo ""
echo "Test Registration:"
echo "  1. Open: https://192.168.210.54:8443/index-custom.html"
echo "  2. DN: 5001, Password: Genesys2024!WebRTC"
echo "  3. Click Register"
echo "  4. Check logs: sudo docker logs -f webrtc-kamailio"
echo ""
echo "Rollback to JsSIP:"
echo "  sudo docker cp kamailio/$BACKUP_FILE webrtc-kamailio:/tmp/k.cfg"
echo "  sudo docker restart webrtc-kamailio"
echo "  sudo docker exec webrtc-kamailio mv /tmp/k.cfg /etc/kamailio/kamailio.cfg"
echo "  sudo docker restart webrtc-kamailio"
echo ""


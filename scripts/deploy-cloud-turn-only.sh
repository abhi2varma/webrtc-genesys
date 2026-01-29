#!/bin/bash

# Quick deploy cloud TURN configuration

echo "========================================="
echo "Deploying Cloud TURN Configuration"
echo "========================================="

cd /opt/webrtc-genesys

# Pull latest changes
echo "1. Pulling latest changes..."
git pull

# Restart nginx to serve updated HTML
echo "2. Restarting nginx..."
docker-compose restart nginx

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next: Restart Electron on client machine:"
echo "  taskkill /F /IM electron.exe"
echo "  Remove-Item -Recurse -Force \$env:APPDATA\webrtc-gateway-bridge"
echo "  cd webrtc-gateway-bridge && npm start"
echo ""
echo "Then test call (1003 -> 1002) and check for relay candidates!"

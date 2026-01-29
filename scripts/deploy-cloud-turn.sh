#!/bin/bash

# Cloud TURN Deployment Script
# Deploys the fix for ICE connection failure

set -e

echo "========================================="
echo "Deploying Cloud TURN Configuration Fix"
echo "========================================="

# Pull latest changes
echo "1. Pulling latest changes from git..."
git pull

# Restart nginx to serve updated HTML
echo "2. Restarting nginx..."
docker-compose restart nginx

# Optional: Stop coturn to save resources (uncomment if desired)
# echo "3. Stopping local coturn..."
# docker-compose stop coturn

# Verify services
echo "3. Verifying services..."
docker ps | grep -E 'nginx|asterisk|registration-monitor'

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. On client machine, kill Electron and clear cache:"
echo "   taskkill /F /IM electron.exe"
echo "   Remove-Item -Recurse -Force \$env:APPDATA\webrtc-gateway-bridge"
echo "   cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge && npm start"
echo ""
echo "2. Test call flow (1003 -> 1002)"
echo "3. Look for these in Electron console:"
echo "   - 🧊 ICE Candidate [relay]: a.relay.metered.ca"
echo "   - 🧊 ICE Connection State: connected"
echo "   - 🔗 Connection State: connected"
echo ""

#!/bin/bash
# RTPengine Deployment Script
# This script will build and deploy RTPengine to fix ICE connectivity issues

set -e  # Exit on error

echo "=================================================="
echo "🚀 RTPengine Deployment - Starting..."
echo "=================================================="
echo ""

# Step 1: Pull latest changes
echo "📥 Step 1: Pulling latest code from Git..."
cd /home/Gencct/webrtc-genesys
git pull origin main
echo "✅ Code updated"
echo ""

# Step 2: Stop existing services
echo "⏸️  Step 2: Stopping existing services..."
docker compose down kamailio rtpengine 2>/dev/null || true
echo "✅ Services stopped"
echo ""

# Step 3: Build RTPengine image
echo "🔨 Step 3: Building RTPengine image (this will take 5-10 minutes)..."
echo "    Building from source to avoid DNS issues..."
docker compose build --no-cache rtpengine
echo "✅ RTPengine image built successfully"
echo ""

# Step 4: Start RTPengine
echo "▶️  Step 4: Starting RTPengine..."
docker compose up -d rtpengine
sleep 5
echo "✅ RTPengine started"
echo ""

# Step 5: Verify RTPengine is running
echo "🔍 Step 5: Verifying RTPengine status..."
if docker ps | grep -q webrtc-rtpengine; then
    echo "✅ RTPengine container is running"
    docker logs --tail 20 webrtc-rtpengine
else
    echo "❌ ERROR: RTPengine container is not running!"
    docker logs webrtc-rtpengine
    exit 1
fi
echo ""

# Step 6: Start Kamailio
echo "▶️  Step 6: Starting Kamailio with RTPengine integration..."
docker compose up -d kamailio
sleep 3
echo "✅ Kamailio started"
echo ""

# Step 7: Verify Kamailio can connect to RTPengine
echo "🔍 Step 7: Verifying Kamailio-RTPengine connection..."
sleep 2
if docker exec webrtc-kamailio kamcmd rtpengine.show all 2>/dev/null; then
    echo "✅ Kamailio successfully connected to RTPengine!"
else
    echo "⚠️  Warning: Could not verify Kamailio-RTPengine connection"
    echo "    This might be normal if kamcmd is not available"
fi
echo ""

# Step 8: Restart Asterisk to ensure clean state
echo "🔄 Step 8: Restarting Asterisk..."
docker restart webrtc-asterisk
sleep 5
echo "✅ Asterisk restarted"
echo ""

# Step 9: Show service status
echo "📊 Step 9: Service Status Summary"
echo "=================================================="
docker ps --filter "name=webrtc-rtpengine" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter "name=webrtc-kamailio" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter "name=webrtc-asterisk" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Step 10: Show RTPengine configuration
echo "🔧 RTPengine Configuration:"
echo "   Local Interface:  192.168.210.54"
echo "   Advertised IP:    103.167.180.166"
echo "   Control Socket:   127.0.0.1:2223"
echo "   RTP Port Range:   10000-20000"
echo ""

echo "=================================================="
echo "✅ RTPengine Deployment Complete!"
echo "=================================================="
echo ""
echo "📝 Next Steps:"
echo "   1. Restart Electron client with clean cache"
echo "   2. Make a test call from 1002 to 5001"
echo "   3. Watch for proper SDP rewriting in logs"
echo ""
echo "🔍 To check logs:"
echo "   docker logs -f webrtc-rtpengine    # RTPengine logs"
echo "   docker logs -f webrtc-kamailio     # Kamailio logs"
echo "   docker logs -f webrtc-asterisk     # Asterisk logs"
echo ""
echo "🎯 Expected behavior:"
echo "   - INVITE from client → Kamailio rewrites SDP → Asterisk"
echo "   - All IPs in SDP should be 103.167.180.166 (no private IPs)"
echo "   - ICE candidates should connect successfully"
echo "   - Media flows through RTPengine relay"
echo ""

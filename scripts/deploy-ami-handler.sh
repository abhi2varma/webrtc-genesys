#!/bin/bash
# Deploy AMI Auto-Answer Handler to Production Server

set -e

echo "=============================================="
echo " Deploying AMI Auto-Answer Handler"
echo "=============================================="
echo ""

# Navigate to project directory
cd /opt/gcti_apps/webrtc-genesys

# Pull latest code
echo "📥 Pulling latest code from Git..."
git pull

# Stop existing service if running
echo "🛑 Stopping existing AMI handler (if running)..."
sudo docker-compose stop ami-auto-answer-handler 2>/dev/null || true
sudo docker-compose rm -f ami-auto-answer-handler 2>/dev/null || true

# Build the new service
echo "🔨 Building AMI handler container..."
sudo docker-compose build ami-auto-answer-handler

# Start the service
echo "🚀 Starting AMI handler..."
sudo docker-compose up -d ami-auto-answer-handler

# Wait a bit for startup
echo "⏳ Waiting for service to start..."
sleep 3

# Check status
echo ""
echo "📊 Service Status:"
sudo docker ps | grep ami-auto-answer-handler || echo "❌ Service not running!"

echo ""
echo "📋 Recent logs:"
sudo docker logs --tail 20 webrtc-ami-auto-answer-handler

echo ""
echo "=============================================="
echo " Deployment Complete!"
echo "=============================================="
echo ""
echo "📖 Monitor logs with:"
echo "   sudo docker logs -f webrtc-ami-auto-answer-handler"
echo ""
echo "🔍 Check AMI connection with:"
echo "   sudo docker exec webrtc-asterisk asterisk -rx 'manager show connected'"
echo ""

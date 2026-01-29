# WWE Call Notification Fix - Server Deployment Script
# Run this on the server: ssh root@103.167.180.166

cd /root/webrtc-genesys

echo "========================================"
echo "Deploying WWE Call Notification Fix"
echo "========================================"
echo ""

# Pull latest changes
echo "Step 1: Pulling latest changes from git..."
git pull origin main

# Build the SIP NOTIFY monitor
echo ""
echo "Step 2: Building SIP NOTIFY Monitor..."
docker-compose build sip-notify-monitor

# Start the monitor
echo ""
echo "Step 3: Starting SIP NOTIFY Monitor..."
docker-compose up -d sip-notify-monitor

# Check status
echo ""
echo "Step 4: Checking service status..."
docker-compose ps | grep sip-notify-monitor

# Show logs
echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f sip-notify-monitor"
echo ""
echo "To restart if needed:"
echo "  docker-compose restart sip-notify-monitor"
echo ""
echo "Expected log output:"
echo "  🔍 Starting SIP NOTIFY Monitor..."
echo "  ✅ Bridge is running"
echo "  📩 NOTIFY detected"
echo "  ✅ Bridge notified: DN=1002, CallUUID=..."
echo ""

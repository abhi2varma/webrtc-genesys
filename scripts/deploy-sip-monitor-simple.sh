#!/bin/bash
# Simple deployment script for SIP NOTIFY Monitor
# Runs directly without Docker (easier for older Docker versions)

echo "========================================"
echo "WWE Call Notification Fix - Deployment"
echo "========================================"
echo ""

cd /root/webrtc-genesys/asterisk

# Check if bridge is running
echo "Checking if WebRTC bridge is running..."
if curl -k -s https://127.0.0.1:8000/Ping > /dev/null 2>&1; then
    echo "✅ Bridge is running"
else
    echo "⚠️  Warning: Bridge doesn't appear to be running on port 8000"
    echo "   The monitor will still start but won't be able to send notifications"
fi

echo ""
echo "Installing Python dependencies..."
pip3 install --quiet requests urllib3

echo ""
echo "Setting permissions..."
chmod +x sip-notify-parser.py start-notify-monitor.sh

echo ""
echo "Stopping any existing monitor..."
pkill -f sip-notify-parser.py
pkill -f start-notify-monitor.sh

echo ""
echo "Starting SIP NOTIFY Monitor..."
nohup bash start-notify-monitor.sh > /tmp/sip-notify-monitor.log 2>&1 &

sleep 2

# Check if it started
if pgrep -f sip-notify-parser.py > /dev/null; then
    echo "✅ SIP NOTIFY Monitor started successfully!"
    echo ""
    echo "Process ID:"
    pgrep -f sip-notify-parser.py
else
    echo "❌ Failed to start monitor"
    echo ""
    echo "Check logs for errors:"
    echo "  tail -f /tmp/sip-notify-monitor.log"
    exit 1
fi

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "To view logs:"
echo "  tail -f /tmp/sip-notify-monitor.log"
echo ""
echo "To stop the monitor:"
echo "  pkill -f sip-notify-parser.py"
echo ""
echo "Expected log output:"
echo "  🔍 Starting SIP NOTIFY Monitor..."
echo "  ✅ Bridge is running"
echo "  Starting tcpdump on port 5061..."
echo "  SIP NOTIFY Parser started"
echo ""
echo "When a call arrives, you should see:"
echo "  📩 NOTIFY detected"
echo "  ✅ Bridge notified: DN=1002, CallUUID=..."
echo ""

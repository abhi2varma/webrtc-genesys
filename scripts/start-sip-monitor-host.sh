#!/bin/bash
# Alternative: Run SIP NOTIFY Monitor Directly on Host
# This script runs the monitor without Docker

echo "========================================"
echo "Starting SIP NOTIFY Monitor (Host Mode)"
echo "========================================"
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Installing..."
    yum install -y python3 python3-pip
fi

# Check if tcpdump is installed
if ! command -v tcpdump &> /dev/null; then
    echo "❌ tcpdump not found. Installing..."
    yum install -y tcpdump
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install requests urllib3 2>/dev/null || python3 -m pip install requests urllib3

# Check if bridge is running
echo ""
echo "Checking if WebRTC Gateway Bridge is running..."
if curl -k -s https://127.0.0.1:8000/Ping > /dev/null 2>&1; then
    echo "✅ Bridge is running on port 8000"
else
    echo "❌ Bridge not running on port 8000"
    echo "   The bridge needs to be running for this to work"
    echo "   Start it from your local machine first"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Starting SIP NOTIFY Monitor..."
echo "Capturing NOTIFY messages on port 5061..."
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run tcpdump and pipe to parser
cd /root/webrtc-genesys
tcpdump -i any -n -A -l port 5061 2>/dev/null | python3 asterisk/sip-notify-parser.py

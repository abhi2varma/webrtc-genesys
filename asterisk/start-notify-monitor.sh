#!/bin/bash
# Start SIP NOTIFY monitor for extracting Genesys CallUUID
# This script captures NOTIFY messages on port 5061 and extracts X-Genesys-CallUUID

echo "🔍 Starting SIP NOTIFY Monitor..."
echo "   Listening on port 5061 for Genesys NOTIFY messages"
echo ""

# Check if bridge is running
if ! curl -k -s https://127.0.0.1:8000/Ping > /dev/null 2>&1; then
    echo "❌ WebRTC Gateway Bridge is not running on port 8000"
    echo "   Please start the bridge first"
    exit 1
fi

echo "✅ Bridge is running"
echo ""

# Make parser executable
chmod +x /usr/local/bin/sip-notify-parser.py 2>/dev/null || chmod +x ./sip-notify-parser.py

# Run tcpdump and pipe to parser
# -i any: listen on all interfaces
# -n: don't resolve hostnames
# -A: print packet content in ASCII
# -l: line buffered output
# port 5061: filter for Asterisk's DN registration port where NOTIFY messages arrive

if [ -x "/usr/local/bin/sip-notify-parser.py" ]; then
    PARSER="/usr/local/bin/sip-notify-parser.py"
else
    PARSER="./sip-notify-parser.py"
fi

echo "Starting tcpdump on port 5061..."
tcpdump -i any -n -A -l port 5061 2>/dev/null | python3 "$PARSER"

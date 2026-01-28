#!/bin/bash
# Test if TURN port forwarding is configured

PUBLIC_IP="103.167.180.166"
TURN_PORT="3478"
TURN_USER="webrtc"
TURN_PASS="Genesys2024!SecureTurn"

echo "========================================"
echo "Testing TURN Server Port Forwarding"
echo "========================================"
echo ""
echo "Public IP: $PUBLIC_IP"
echo "TURN Port: $TURN_PORT"
echo ""

# Test 1: Check if port is listening locally
echo "Test 1: Checking if TURN is running locally..."
if netstat -ulnp | grep -q ":$TURN_PORT"; then
    echo "✅ TURN server is running on port $TURN_PORT"
else
    echo "❌ TURN server is NOT running on port $TURN_PORT"
    exit 1
fi
echo ""

# Test 2: Test STUN from localhost
echo "Test 2: Testing STUN from localhost..."
if command -v stunclient &> /dev/null; then
    stunclient $PUBLIC_IP $TURN_PORT
    if [ $? -eq 0 ]; then
        echo "✅ STUN test passed"
    else
        echo "⚠️  STUN test failed (may be normal from localhost)"
    fi
else
    echo "⚠️  stunclient not installed (apt install stuntman-client)"
fi
echo ""

# Test 3: Check if TURN client tools available
echo "Test 3: Testing TURN allocation..."
if command -v turnutils_uclient &> /dev/null; then
    echo "Running TURN test..."
    timeout 10 turnutils_uclient -v -u $TURN_USER -w "$TURN_PASS" $PUBLIC_IP &> /tmp/turn_test.log
    
    if grep -q "tot_send_msgs" /tmp/turn_test.log; then
        echo "✅ TURN server is responding"
        grep "tot_send_msgs\|tot_recv_msgs" /tmp/turn_test.log
    else
        echo "⚠️  TURN test inconclusive"
        cat /tmp/turn_test.log
    fi
else
    echo "⚠️  turnutils_uclient not installed (apt install coturn-utils)"
fi
echo ""

# Test 4: Check external connectivity hint
echo "========================================"
echo "To test from OUTSIDE your network:"
echo "========================================"
echo ""
echo "1. Use mobile phone (not on same WiFi)"
echo "2. Visit: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "3. Add your TURN server:"
echo "   TURN URI: turn:$PUBLIC_IP:$TURN_PORT"
echo "   Username: $TURN_USER"
echo "   Password: $TURN_PASS"
echo "4. Click 'Gather candidates'"
echo "5. Look for 'relay' candidates with $PUBLIC_IP"
echo ""
echo "If you see relay candidates, port forwarding is working! ✅"
echo "If you only see host/srflx, port forwarding needs configuration ❌"
echo ""

# Test 5: Check router/firewall
echo "========================================"
echo "Port Forwarding Configuration Needed:"
echo "========================================"
echo ""
echo "On your router/firewall, configure:"
echo "  External IP: $PUBLIC_IP (your public IP)"
echo "  External Port: UDP $TURN_PORT → Internal IP: 192.168.210.54:$TURN_PORT"
echo "  External Ports: UDP 49152-49252 → Internal IP: 192.168.210.54:49152-49252"
echo ""

#!/bin/bash
# Genesys SIP Trunk Diagnostics

echo "=================================================="
echo "🔍 Genesys SIP Trunk Diagnostics"
echo "=================================================="
echo ""

echo "1️⃣  Checking PJSIP Endpoint Status..."
echo "---------------------------------------------------"
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"
echo ""

echo "2️⃣  Checking AOR (Address of Record)..."
echo "---------------------------------------------------"
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show aor genesys_sip_server"
echo ""

echo "3️⃣  Checking if Genesys SIP Server is reachable..."
echo "---------------------------------------------------"
sudo docker exec webrtc-asterisk asterisk -rx "pjsip qualify genesys_sip_server"
echo ""

echo "4️⃣  Checking recent Asterisk logs for Genesys..."
echo "---------------------------------------------------"
sudo docker logs webrtc-asterisk --tail 30 | grep -i "genesys\|1003\|not found\|404"
echo ""

echo "5️⃣  Testing network connectivity to Genesys SIP Server..."
echo "---------------------------------------------------"
echo "Pinging 192.168.210.81..."
ping -c 3 192.168.210.81
echo ""
echo "Checking if port 5060 is open..."
timeout 3 bash -c "cat < /dev/null > /dev/tcp/192.168.210.81/5060" && echo "✅ Port 5060 is open" || echo "❌ Port 5060 is closed/filtered"
echo ""

echo "6️⃣  Checking dialplan context 'genesys-agent'..."
echo "---------------------------------------------------"
sudo docker exec webrtc-asterisk asterisk -rx "dialplan show genesys-agent" | head -30
echo ""

echo "=================================================="
echo "💡 Troubleshooting Tips:"
echo "=================================================="
echo ""
echo "If endpoint status shows 'Unavailable':"
echo "  → Genesys SIP Server (192.168.210.81) may be down"
echo "  → Check firewall rules between Asterisk and Genesys"
echo ""
echo "If you see '404 Not Found' in logs:"
echo "  → Extension 1003 may not exist on Genesys"
echo "  → Try calling a known valid extension"
echo ""
echo "If ping fails:"
echo "  → Network issue between 192.168.210.54 and 192.168.210.81"
echo "  → Check routing and firewall rules"
echo ""


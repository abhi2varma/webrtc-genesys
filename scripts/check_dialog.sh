#!/bin/bash

echo "========================================="
echo "Dialog Module Diagnostic"
echo "========================================="
echo ""

echo "[1] Checking for dlg_manage in config:"
if grep -q "dlg_manage" kamailio/kamailio-proxy.cfg; then
    echo "✓ dlg_manage found at line:"
    grep -n "dlg_manage" kamailio/kamailio-proxy.cfg
else
    echo "✗ dlg_manage NOT FOUND in config!"
fi
echo ""

echo "[2] INVITE handling section:"
sed -n '/# Account only INVITEs/,/# Handle registrations/p' kamailio/kamailio-proxy.cfg
echo ""

echo "[3] Dialog module loaded?"
sudo docker logs webrtc-kamailio 2>&1 | grep -i "dialog.*loaded" | head -5
echo ""

echo "[4] Test dialog commands:"
echo "  - dlg.stats_active:"
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active
echo ""
echo "  - dlg.briefing:"
sudo docker exec webrtc-kamailio kamcmd dlg.briefing
echo ""

echo "[5] Make a call now..."
echo "Press Enter when call is ACTIVE..."
read

echo ""
echo "[6] Recent INVITE logs:"
sudo docker logs webrtc-kamailio 2>&1 | tail -200 | grep -iE "INVITE" | tail -10
echo ""

echo "[7] Dialog creation logs:"
sudo docker logs webrtc-kamailio 2>&1 | tail -200 | grep -iE "dlg_onreq|dialog.*creat" | tail -10
echo ""

echo "[8] Active dialogs NOW:"
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active
echo ""

echo "[9] Dialog details:"
sudo docker exec webrtc-kamailio kamcmd dlg.list
echo ""

echo "[10] Press Enter after HANGUP..."
read

echo ""
echo "[11] Active dialogs after hangup:"
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active
echo ""

echo "[12] Summary:"
sudo docker exec webrtc-kamailio kamcmd dlg.briefing
echo ""

echo "========================================="
echo "Diagnostic Complete!"
echo "========================================="


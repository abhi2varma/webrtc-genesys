#!/bin/bash

echo "========================================="
echo "Deploy Kamailio with Dialog Module"
echo "========================================="
echo ""

# Step 1: Backup current config
echo "[1/5] Backing up current config..."
BACKUP_FILE="kamailio-backup-$(date +%Y%m%d-%H%M%S).cfg"
sudo docker cp webrtc-kamailio:/etc/kamailio/kamailio.cfg "kamailio/$BACKUP_FILE" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Backup created: kamailio/$BACKUP_FILE"
else
    echo "⚠ Could not backup (container may not be running)"
fi
echo ""

# Step 2: Verify dialog module in config
echo "[2/5] Verifying dialog module in config..."
if grep -q "loadmodule \"dialog.so\"" kamailio/kamailio-proxy.cfg; then
    echo "✓ Dialog module found in config"
    if grep -q "dlg_manage" kamailio/kamailio-proxy.cfg; then
        echo "✓ Dialog tracking (dlg_manage) found"
    else
        echo "✗ Dialog tracking (dlg_manage) NOT found!"
        exit 1
    fi
else
    echo "✗ Dialog module NOT found in config!"
    exit 1
fi
echo ""

# Step 3: Deploy new config
echo "[3/5] Deploying config with dialog module..."
sudo docker cp kamailio/kamailio-proxy.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg
if [ $? -eq 0 ]; then
    echo "✓ Config deployed"
else
    echo "✗ Failed to deploy config!"
    exit 1
fi
echo ""

# Step 4: Restart Kamailio
echo "[4/5] Restarting Kamailio..."
sudo docker restart webrtc-kamailio
echo "✓ Kamailio restart initiated"
echo "  Waiting 5 seconds for startup..."
sleep 5
echo ""

# Step 5: Verify
echo "[5/5] Verifying dialog module..."
if sudo docker logs webrtc-kamailio 2>&1 | grep -q "loadmodule.*dialog"; then
    echo "✓ Dialog module loading detected in logs"
else
    echo "⚠ Dialog module not found in recent logs"
fi
echo ""

# Test commands
echo "Testing dialog commands..."
echo "----------------------------------------"
echo ""

echo "Available dialog commands:"
sudo docker exec webrtc-kamailio kamcmd help | grep "^dlg\." | head -10
echo ""

echo "Active dialogs:"
sudo docker exec webrtc-kamailio kamcmd dlg.stats_active
echo ""

echo "Dialog summary:"
sudo docker exec webrtc-kamailio kamcmd dlg.briefing
echo ""

echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Test with a call:"
echo "  1. Open: https://192.168.210.54:8443/index-minimal.html"
echo "  2. Register DN 5001"
echo "  3. Call 1003"
echo "  4. Run: sudo docker exec webrtc-kamailio kamcmd dlg.list"
echo ""
echo "Monitor live:"
echo "  ./scripts/monitor_dialogs.sh"
echo ""


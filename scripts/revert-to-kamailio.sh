#!/bin/bash
# Revert to Kamailio-based registration forwarding
# This script pulls the latest code and restarts services

echo "========================================"
echo "Reverting to Kamailio Registration Flow"
echo "========================================"
echo ""

# Navigate to project directory
cd /opt/gcti_apps/webrtc-genesys

echo "1. Pulling latest code from GitHub..."
sudo git fetch origin
sudo git reset --hard origin/main
echo "✅ Code updated"
echo ""

echo "2. Ensuring Kamailio is running..."
sudo docker-compose up -d kamailio
echo "✅ Kamailio started"
echo ""

echo "3. Restarting Nginx (to apply /ws proxy change)..."
sudo docker-compose restart nginx
echo "✅ Nginx restarted"
echo ""

echo "4. Restarting Asterisk (to disable static PJSIP registrations)..."
sudo docker-compose restart asterisk
echo "✅ Asterisk restarted"
echo ""

echo "========================================"
echo "Revert Complete!"
echo "========================================"
echo ""
echo "Now verifying the setup..."
echo ""

# Wait for services to fully start
sleep 5

echo "5. Checking Kamailio status:"
sudo docker-compose ps kamailio
echo ""

echo "6. Checking if Kamailio is listening on port 8080:"
sudo docker-compose exec kamailio netstat -tlnp 2>/dev/null | grep 8080 || echo "⚠️  Port 8080 check failed (service may still be starting)"
echo ""

echo "7. Checking PJSIP registrations (should be Unregistered):"
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"
echo ""

echo "========================================"
echo "Next Steps:"
echo "========================================"
echo "1. Register DN 1002 via Electron app"
echo "2. Check Kamailio logs:"
echo "   sudo docker-compose logs -f kamailio"
echo ""
echo "3. Look for:"
echo "   - 'REGISTER from sip:1002@...'"
echo "   - 'Sending REGISTER to Genesys for DN 1002'"
echo ""
echo "4. Check Genesys SIP logs for REGISTER from Kamailio"
echo ""

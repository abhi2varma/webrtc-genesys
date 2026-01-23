#!/bin/bash

# Kamailio Contact Header Fix Deployment Script
# This script applies the Contact header rewriting fix on the server

echo "=========================================="
echo "Kamailio Contact Header Fix Deployment"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Navigate to project directory
cd /opt/gcti_apps/webrtc-genesys || {
    echo -e "${RED}❌ Failed to navigate to project directory${NC}"
    exit 1
}

echo -e "${YELLOW}📥 Pulling latest code from repository...${NC}"
sudo git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to pull latest code${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Code pulled successfully${NC}"
echo ""

# Show the current Kamailio config Contact header section
echo -e "${YELLOW}📝 Current Kamailio Contact header configuration:${NC}"
grep -A 5 "Rewrite Contact to Asterisk" kamailio/kamailio-proxy.cfg || {
    echo -e "${RED}❌ Contact rewriting configuration not found${NC}"
    echo "Please verify that the latest code includes the Contact header fix."
    exit 1
}
echo ""

echo -e "${YELLOW}🔄 Restarting Kamailio...${NC}"
sudo docker-compose restart kamailio

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to restart Kamailio${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Kamailio restarted successfully${NC}"
echo ""

# Wait for Kamailio to be ready
echo -e "${YELLOW}⏳ Waiting for Kamailio to be ready...${NC}"
sleep 3

# Verify Kamailio is running
echo -e "${YELLOW}🔍 Verifying Kamailio status...${NC}"
KAMAILIO_STATUS=$(sudo docker-compose ps kamailio | grep -i "up")

if [ -z "$KAMAILIO_STATUS" ]; then
    echo -e "${RED}❌ Kamailio is not running${NC}"
    echo "Checking logs:"
    sudo docker-compose logs --tail=20 kamailio
    exit 1
fi

echo -e "${GREEN}✅ Kamailio is running${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}✅ Deployment Complete${NC}"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Test registration by logging in with the Electron app (DN 1002 or 1003)"
echo "2. Check the registration dashboard: http://192.168.210.81:5000"
echo "   - Verify Contact addresses now show: DN@192.168.210.54:5060"
echo "   - Before fix: 84jp7d1i@3tglb5esjoiv.invalid"
echo "   - After fix: 1002@192.168.210.54:5060"
echo "3. Test incoming calls: Call DN 1002 from DN 1003"
echo "4. Monitor Kamailio logs: sudo docker-compose logs -f kamailio"
echo ""
echo "To view real-time Kamailio logs with Contact rewriting:"
echo "  sudo docker-compose logs -f kamailio | grep -E '(REGISTER|Contact)'"
echo ""

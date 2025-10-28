#!/bin/bash

# Script to update system to SIP Endpoint Model
# For use with Genesys Workspace Web Edition

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Update to SIP Endpoint Model${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Backup current configuration
echo -e "${YELLOW}Step 1: Backing up current configuration...${NC}"
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
cp asterisk/etc/pjsip.conf backups/$(date +%Y%m%d_%H%M%S)/pjsip.conf.trunk-model
cp asterisk/etc/extensions.conf backups/$(date +%Y%m%d_%H%M%S)/extensions.conf.trunk-model
echo -e "${GREEN}✓ Backup complete${NC}"
echo ""

# Update Asterisk configuration
echo -e "${YELLOW}Step 2: Updating Asterisk configuration...${NC}"
cp asterisk/etc/pjsip-sip-endpoint.conf asterisk/etc/pjsip.conf
cp asterisk/etc/extensions-sip-endpoint.conf asterisk/etc/extensions.conf
echo -e "${GREEN}✓ Asterisk configuration updated${NC}"
echo ""

# Update WebRTC client
echo -e "${YELLOW}Step 3: Updating WebRTC client...${NC}"
cp nginx/html/index.html backups/$(date +%Y%m%d_%H%M%S)/index.html.old
cp nginx/html/app.js backups/$(date +%Y%m%d_%H%M%S)/app.js.old
cp nginx/html/index-agent-dn.html nginx/html/index.html
cp nginx/html/app-agent-dn.js nginx/html/app.js
echo -e "${GREEN}✓ WebRTC client updated${NC}"
echo ""

# Restart services
echo -e "${YELLOW}Step 4: Restarting services...${NC}"
docker-compose -f docker-compose-simple.yml restart
echo ""
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10
echo -e "${GREEN}✓ Services restarted${NC}"
echo ""

# Display status
echo -e "${YELLOW}Step 5: Checking service status...${NC}"
docker-compose -f docker-compose-simple.yml ps
echo ""

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Update Complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Configure Genesys:"
echo "   - Create Agent DNs (5001-5020) in Configuration Manager"
echo "   - Associate DNs with Asterisk Switch"
echo "   - Configure agents with DNs"
echo ""
echo "2. Update Genesys connection in .env:"
echo "   GENESYS_SIP_HOST=your-genesys-server"
echo "   GENESYS_SIP_PORT=5060"
echo "   GENESYS_USERNAME=asterisk-gateway"
echo "   GENESYS_PASSWORD=your-password"
echo ""
echo "3. Test with an agent:"
echo "   - Open: https://192.168.77.131"
echo "   - Register with DN: 5001"
echo "   - Password: GenesysAgent5001!"
echo "   - Open Genesys Workspace"
echo "   - Set Ready"
echo ""
echo -e "${GREEN}Configuration files saved in: backups/${NC}"
echo ""





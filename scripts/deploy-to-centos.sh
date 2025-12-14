#!/bin/bash
# WebRTC Genesys Deployment Script for CentOS
# Deploys from Windows/Linux to CentOS server at 192.168.210.54

# Configuration
SERVER_IP="${1:-192.168.210.54}"
PORT="${2:-69}"
USERNAME="${3:-Gencct}"
REMOTE_PATH="/opt/gcti_apps/webrtc-genesys"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================"
echo -e "WebRTC Genesys Deployment Script"
echo -e "========================================${NC}"
echo ""
echo -e "${YELLOW}Target Server: $USERNAME@$SERVER_IP:$PORT"
echo -e "Remote Path: $REMOTE_PATH${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}ERROR: Please run this script from the project root directory!${NC}"
    exit 1
fi

echo -e "${GREEN}[1/5] Creating remote directories...${NC}"

# Create directory structure on remote server
DIRECTORIES=(
    "$REMOTE_PATH"
    "$REMOTE_PATH/asterisk"
    "$REMOTE_PATH/asterisk/etc"
    "$REMOTE_PATH/asterisk/sounds"
    "$REMOTE_PATH/asterisk/keys"
    "$REMOTE_PATH/asterisk/logs"
    "$REMOTE_PATH/nginx"
    "$REMOTE_PATH/nginx/html"
    "$REMOTE_PATH/coturn"
    "$REMOTE_PATH/certs"
    "$REMOTE_PATH/scripts"
)

for dir in "${DIRECTORIES[@]}"; do
    echo -e "  ${GRAY}Creating: $dir${NC}"
    ssh -p $PORT "$USERNAME@$SERVER_IP" "mkdir -p $dir"
done

echo -e "  ${GREEN}✓ Directories created${NC}"
echo ""

# Copy Asterisk configuration files
echo -e "${GREEN}[2/5] Copying Asterisk configuration files...${NC}"
ASTERISK_FILES=(
    "asterisk/etc/pjsip.conf"
    "asterisk/etc/logger.conf"
    "asterisk/etc/asterisk.conf"
    "asterisk/etc/extensions-sip-endpoint.conf"
    "asterisk/etc/http.conf"
    "asterisk/etc/rtp.conf"
)

for file in "${ASTERISK_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GRAY}Copying: $file${NC}"
        scp -P $PORT "$file" "$USERNAME@$SERVER_IP:$REMOTE_PATH/$file"
    else
        echo -e "  ${YELLOW}Skipping: $file (not found)${NC}"
    fi
done
echo -e "  ${GREEN}✓ Asterisk files copied${NC}"
echo ""

# Copy Nginx files
echo -e "${GREEN}[3/5] Copying Nginx files...${NC}"
NGINX_FILES=(
    "nginx/nginx.conf"
    "nginx/html/index.html"
    "nginx/html/app.js"
    "nginx/html/style.css"
    "nginx/html/jssip.min.js"
)

for file in "${NGINX_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GRAY}Copying: $file${NC}"
        scp -P $PORT "$file" "$USERNAME@$SERVER_IP:$REMOTE_PATH/$file"
    else
        echo -e "  ${YELLOW}Skipping: $file (not found)${NC}"
    fi
done
echo -e "  ${GREEN}✓ Nginx files copied${NC}"
echo ""

# Copy certificates
echo -e "${GREEN}[4/5] Copying SSL certificates...${NC}"
if ls certs/*.pem 1> /dev/null 2>&1; then
    echo -e "  ${GRAY}Copying certificate files...${NC}"
    scp -P $PORT certs/*.pem "$USERNAME@$SERVER_IP:$REMOTE_PATH/certs/"
    echo -e "  ${GREEN}✓ Certificates copied${NC}"
else
    echo -e "  ${YELLOW}! No certificates found, will generate on server${NC}"
fi
echo ""

# Copy Docker and other files
echo -e "${GREEN}[5/5] Copying Docker and documentation files...${NC}"
OTHER_FILES=(
    "docker-compose.yml"
    "TEST_DN_REGISTRATION.md"
    "GENESYS_GWS_INTEGRATION.md"
    "README.md"
)

for file in "${OTHER_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GRAY}Copying: $file${NC}"
        scp -P $PORT "$file" "$USERNAME@$SERVER_IP:$REMOTE_PATH/$file"
    else
        echo -e "  ${YELLOW}Skipping: $file (not found)${NC}"
    fi
done
echo -e "  ${GREEN}✓ Files copied${NC}"
echo ""

# Generate certificates on server if needed
echo -e "${CYAN}[OPTIONAL] Generating SSL certificates on server...${NC}"
ssh -p $PORT "$USERNAME@$SERVER_IP" << 'ENDSSH'
cd /opt/gcti_apps/webrtc-genesys
if [ ! -f certs/cert.pem ]; then
    echo '  Generating self-signed certificates...'
    docker run --rm -v $(pwd)/certs:/certs alpine/openssl req -x509 -newkey rsa:2048 -keyout /certs/key.pem -out /certs/cert.pem -days 365 -nodes -subj '/CN=192.168.210.54'
    cp certs/cert.pem certs/ca.pem
    echo '  ✓ Certificates generated'
else
    echo '  ✓ Certificates already exist'
fi
ENDSSH
echo ""

# Summary
echo -e "${CYAN}========================================"
echo -e "Deployment Summary"
echo -e "========================================${NC}"
echo -e "${GREEN}✓ All files copied to $SERVER_IP:$REMOTE_PATH${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "${NC}1. SSH to server:"
echo -e "   ${GRAY}ssh -p $PORT $USERNAME@$SERVER_IP${NC}"
echo ""
echo -e "${NC}2. Navigate to project:"
echo -e "   ${GRAY}cd $REMOTE_PATH${NC}"
echo ""
echo -e "${NC}3. Start services:"
echo -e "   ${GRAY}docker-compose down"
echo -e "   docker-compose up -d${NC}"
echo ""
echo -e "${NC}4. Check status:"
echo -e "   ${GRAY}docker-compose ps${NC}"
echo ""
echo -e "${NC}5. Test WebRTC client:"
echo -e "   ${GRAY}http://$SERVER_IP/${NC}"
echo ""
echo -e "${CYAN}========================================${NC}"

# Ask if user wants to restart services automatically
echo ""
read -p "Do you want to restart services on the server now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${GREEN}Restarting services on server...${NC}"
    
    ssh -p $PORT "$USERNAME@$SERVER_IP" << 'ENDSSH'
cd /opt/gcti_apps/webrtc-genesys
echo 'Stopping services...'
docker-compose down
echo 'Starting services...'
docker-compose up -d
echo ''
echo 'Service Status:'
docker-compose ps
ENDSSH
    
    echo ""
    echo -e "${CYAN}========================================"
    echo -e "${GREEN}✓ Deployment Complete!"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo -e "${CYAN}WebRTC Client: http://$SERVER_IP/${NC}"
    echo ""
else
    echo ""
    echo -e "${YELLOW}Deployment files copied. Please restart services manually.${NC}"
    echo ""
fi

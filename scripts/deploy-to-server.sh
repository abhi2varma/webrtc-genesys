#!/bin/bash

# Remote Deployment Script
# Deploy WebRTC system to remote CentOS server from Windows/Linux

# Configuration
SERVER_USER=${1:-"user"}
SERVER_HOST=${2:-"localhost"}
SERVER_PORT=${3:-22}
REMOTE_DIR="/home/$SERVER_USER/WebRTC"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Remote WebRTC Deployment${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if SSH key exists
if [ -f ~/.ssh/id_rsa ]; then
    echo -e "${GREEN}✓ SSH key found${NC}"
else
    echo -e "${YELLOW}! No SSH key found${NC}"
    echo "Generating SSH key..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    echo ""
    echo -e "${YELLOW}Copy your SSH key to the server:${NC}"
    echo "ssh-copy-id -p $SERVER_PORT $SERVER_USER@$SERVER_HOST"
    echo ""
    read -p "Press Enter after copying the key..."
fi

echo ""
echo "Deployment Configuration:"
echo "  Server: $SERVER_USER@$SERVER_HOST:$SERVER_PORT"
echo "  Remote Directory: $REMOTE_DIR"
echo ""

read -p "Continue with deployment? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Testing SSH connection...${NC}"
if ssh -p $SERVER_PORT -o ConnectTimeout=5 $SERVER_USER@$SERVER_HOST "echo 'SSH connection successful'"; then
    echo -e "${GREEN}✓ SSH connection successful${NC}"
else
    echo -e "${RED}✗ SSH connection failed${NC}"
    echo "Check your credentials and network connection"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 2: Creating remote directory...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "mkdir -p $REMOTE_DIR"
echo -e "${GREEN}✓ Remote directory created${NC}"

echo ""
echo -e "${GREEN}Step 3: Transferring files...${NC}"
echo "This may take a few minutes..."

# Exclude unnecessary files
rsync -avz --progress \
    --exclude='.git' \
    --exclude='certs/' \
    --exclude='asterisk/logs/' \
    --exclude='asterisk/sounds/' \
    --exclude='asterisk/keys/' \
    --exclude='backups/' \
    --exclude='mysql-data/' \
    --exclude='.env' \
    -e "ssh -p $SERVER_PORT" \
    ./ $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/

echo -e "${GREEN}✓ Files transferred${NC}"

echo ""
echo -e "${GREEN}Step 4: Setting up permissions...${NC}"
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $REMOTE_DIR && chmod +x scripts/*.sh"
echo -e "${GREEN}✓ Permissions set${NC}"

echo ""
echo -e "${GREEN}Step 5: Running CentOS setup...${NC}"
echo "This will install Docker, configure firewall, etc."
echo ""

read -p "Run automated setup on server? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ssh -t -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $REMOTE_DIR && sudo ./scripts/centos-setup.sh"
    echo -e "${GREEN}✓ CentOS setup completed${NC}"
else
    echo -e "${YELLOW}! Skipped automated setup${NC}"
    echo "You can run it manually later:"
    echo "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST"
    echo "  cd $REMOTE_DIR"
    echo "  sudo ./scripts/centos-setup.sh"
fi

echo ""
echo -e "${GREEN}Step 6: Configuration${NC}"
echo ""

read -p "Do you want to configure the system now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter your configuration:"
    read -p "Domain name (or localhost for testing): " DOMAIN
    read -p "Public IP address: " PUBLIC_IP
    read -p "Genesys SIP Host: " GENESYS_HOST
    read -p "Genesys Username: " GENESYS_USER
    read -sp "Genesys Password: " GENESYS_PASS
    echo ""
    
    # Create .env file locally
    cat > /tmp/webrtc.env << EOF
DOMAIN=$DOMAIN
PUBLIC_IP=$PUBLIC_IP
PRIVATE_IP=$PUBLIC_IP
ASTERISK_SIP_PORT=5060
ASTERISK_PJSIP_PORT=5061
ASTERISK_WSS_PORT=8089
ASTERISK_HTTP_PORT=8088
ASTERISK_RTP_START=10000
ASTERISK_RTP_END=20000
KAMAILIO_SIP_PORT=5060
KAMAILIO_SIPS_PORT=5061
KAMAILIO_WS_PORT=8080
KAMAILIO_WSS_PORT=4443
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_REALM=$DOMAIN
TURN_SECRET=$(openssl rand -hex 32)
GENESYS_SIP_HOST=$GENESYS_HOST
GENESYS_SIP_PORT=5060
GENESYS_USERNAME=$GENESYS_USER
GENESYS_PASSWORD=$GENESYS_PASS
GENESYS_CONTEXT=genesys-context
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=kamailio
MYSQL_USER=kamailio
MYSQL_PASSWORD=kamailiopass
EOF
    
    # Transfer .env file
    scp -P $SERVER_PORT /tmp/webrtc.env $SERVER_USER@$SERVER_HOST:$REMOTE_DIR/.env
    rm /tmp/webrtc.env
    
    # Update configuration files
    ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST << ENDSSH
cd $REMOTE_DIR
sed -i 's/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g' asterisk/etc/pjsip.conf
sed -i 's/GENESYS_SIP_HOST/$GENESYS_HOST/g' asterisk/etc/pjsip.conf
sed -i 's/YOUR_GENESYS_USERNAME/$GENESYS_USER/g' asterisk/etc/pjsip.conf
sed -i 's/YOUR_GENESYS_PASSWORD/$GENESYS_PASS/g' asterisk/etc/pjsip.conf
sed -i 's/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g' kamailio/kamailio.cfg
sed -i 's/your-domain.com/$DOMAIN/g' kamailio/kamailio.cfg
sed -i 's/your-domain.com/$DOMAIN/g' nginx/nginx.conf
sed -i 's/your-domain.com/$DOMAIN/g' nginx/html/index.html
sed -i 's/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g' coturn/turnserver.conf
sed -i 's/your-domain.com/$DOMAIN/g' coturn/turnserver.conf
ENDSSH
    
    echo -e "${GREEN}✓ Configuration updated${NC}"
else
    echo -e "${YELLOW}! Configuration skipped${NC}"
    echo "You need to configure manually before starting services"
fi

echo ""
echo -e "${GREEN}Step 7: SSL Certificates${NC}"
echo ""

read -p "Generate SSL certificates? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "1) Self-signed (testing)"
    echo "2) Let's Encrypt (production)"
    read -p "Choose [1-2]: " cert_choice
    
    if [ "$cert_choice" = "1" ]; then
        ssh -t -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $REMOTE_DIR && ./scripts/generate-certs.sh development"
    else
        ssh -t -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $REMOTE_DIR && sudo ./scripts/generate-certs.sh production"
    fi
    
    echo -e "${GREEN}✓ Certificates generated${NC}"
fi

echo ""
echo -e "${GREEN}Step 8: Start Services${NC}"
echo ""

read -p "Start Docker services now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ssh -t -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $REMOTE_DIR && docker-compose up -d"
    
    echo ""
    echo "Waiting for services to start..."
    sleep 10
    
    echo ""
    echo "Service Status:"
    ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "cd $REMOTE_DIR && docker-compose ps"
    
    echo -e "${GREEN}✓ Services started${NC}"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

echo "Access your system:"
echo "  Web Client: https://$DOMAIN (or https://$PUBLIC_IP)"
echo "  WebSocket: wss://$DOMAIN/ws"
echo ""

echo "SSH to server:"
echo "  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_HOST"
echo ""

echo "Useful commands (run on server):"
echo "  cd $REMOTE_DIR"
echo "  docker-compose ps              # Check status"
echo "  docker-compose logs -f         # View logs"
echo "  ./scripts/monitor.sh           # Monitor system"
echo "  docker exec -it webrtc-asterisk asterisk -r  # Asterisk CLI"
echo ""

echo "Default WebRTC credentials:"
echo "  Username: 1000"
echo "  Password: webrtc1000pass"
echo ""

echo "Test extensions:"
echo "  600 - Echo test"
echo "  601 - Music on hold"
echo "  700 - Conference room"
echo ""

echo -e "${GREEN}Happy calling! 📞${NC}"
echo ""





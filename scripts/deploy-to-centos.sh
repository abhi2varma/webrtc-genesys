#!/bin/bash

# Deploy WebRTC System to CentOS Script
# This script automates the deployment process from Windows to CentOS

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}! $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root (will use sudo when needed)"
    exit 1
fi

print_header "CentOS Deployment Script for WebRTC System"

# Step 1: Collect deployment information
echo ""
print_warning "Please provide the following information:"
echo ""
read -p "CentOS Server IP: " CENTOS_IP
read -p "CentOS Username: " CENTOS_USER
read -p "Domain name (or IP): " DOMAIN
read -p "Public IP address: " PUBLIC_IP
read -p "Private IP address [${PUBLIC_IP}]: " PRIVATE_IP
PRIVATE_IP=${PRIVATE_IP:-$PUBLIC_IP}

echo ""
read -p "Genesys SIP Host: " GENESYS_HOST
read -p "Genesys SIP Port [5060]: " GENESYS_PORT
GENESYS_PORT=${GENESYS_PORT:-5060}
read -p "Genesys Username: " GENESYS_USER
read -sp "Genesys Password: " GENESYS_PASS
echo ""

# Step 2: Generate TURN secret
TURN_SECRET=$(openssl rand -hex 32)

echo ""
print_step "Testing SSH connection to CentOS server..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes ${CENTOS_USER}@${CENTOS_IP} exit 2>/dev/null; then
    print_success "SSH connection successful"
else
    print_error "Cannot connect to CentOS server"
    echo ""
    echo "Troubleshooting:"
    echo "1. Ensure SSH is enabled on CentOS"
    echo "2. Check firewall allows port 22"
    echo "3. Verify username and IP are correct"
    echo ""
    read -p "Do you want to continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 3: Transfer files to CentOS
print_step "Transferring files to CentOS server..."

# Create temporary directory for deployment
TEMP_DIR=$(mktemp -d)
cp -r . ${TEMP_DIR}/webrtc/

# Create .env file
cat > ${TEMP_DIR}/webrtc/.env << EOF
# Domain Configuration
DOMAIN=${DOMAIN}
PUBLIC_IP=${PUBLIC_IP}
PRIVATE_IP=${PRIVATE_IP}

# Genesys SIP Configuration
GENESYS_SIP_HOST=${GENESYS_HOST}
GENESYS_SIP_PORT=${GENESYS_PORT}
GENESYS_USERNAME=${GENESYS_USER}
GENESYS_PASSWORD=${GENESYS_PASS}

# TURN Server Configuration
TURN_SECRET=${TURN_SECRET}
TURN_REALM=${DOMAIN}

# Asterisk Configuration
ASTERISK_HTTP_PORT=8088
ASTERISK_HTTPS_PORT=8089

# Docker Configuration
COMPOSE_PROJECT_NAME=webrtc

# Security
ADMIN_USER=admin
ADMIN_PASSWORD=$(openssl rand -hex 16)
EOF

# Transfer files
scp -r ${TEMP_DIR}/webrtc ${CENTOS_USER}@${CENTOS_IP}:~/webrtc
rm -rf ${TEMP_DIR}

print_success "Files transferred"

# Step 4: Run setup on CentOS
print_step "Running setup on CentOS server..."

ssh ${CENTOS_USER}@${CENTOS_IP} << EOF
cd ~/webrtc

# Make scripts executable
chmod +x scripts/*.sh

# Run CentOS setup
print_step "Running CentOS system setup..."
sudo ./scripts/centos-setup.sh

# Generate self-signed certificates
print_step "Generating SSL certificates..."
DOMAIN="${DOMAIN}" ./scripts/generate-certs.sh development

# Update configuration files
print_step "Updating configuration files..."

# Update Asterisk pjsip.conf
sed -i "s/YOUR_PUBLIC_IP_HERE/${PUBLIC_IP}/g" asterisk/etc/pjsip.conf
sed -i "s/GENESYS_SIP_HOST/${GENESYS_HOST}/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_USERNAME/${GENESYS_USER}/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_PASSWORD/${GENESYS_PASS}/g" asterisk/etc/pjsip.conf

# Update Nginx configuration
sed -i "s/your-domain.com/${DOMAIN}/g" nginx/nginx.conf

# Update TURN server configuration
sed -i "s/YOUR_PUBLIC_IP_HERE/${PUBLIC_IP}/g" coturn/turnserver.conf
sed -i "s/your-domain.com/${DOMAIN}/g" coturn/turnserver.conf
sed -i "s/your-turn-secret-key/${TURN_SECRET}/g" coturn/turnserver.conf

# Update Kamailio configuration
if [ -f kamailio/kamailio.cfg ]; then
    sed -i "s/YOUR_PUBLIC_IP_HERE/${PUBLIC_IP}/g" kamailio/kamailio.cfg
    sed -i "s/your-domain.com/${DOMAIN}/g" kamailio/kamailio.cfg
fi

print_success "Configuration files updated"

# Start services
print_step "Starting Docker containers..."
docker-compose up -d

# Wait for services to start
sleep 10

# Check status
print_step "Service status:"
docker-compose ps

EOF

if [ $? -eq 0 ]; then
    print_success "Deployment completed successfully!"
else
    print_error "Deployment failed"
    exit 1
fi

# Summary
echo ""
print_header "Deployment Summary"

echo "✅ Files transferred to CentOS"
echo "✅ System setup completed"
echo "✅ SSL certificates generated"
echo "✅ Configuration files updated"
echo "✅ Services started"
echo ""
echo "📋 Access Information:"
echo ""
echo "  WebRTC Client URL:"
echo "    https://${DOMAIN}"
echo "    or"
echo "    https://${CENTOS_IP}"
echo ""
echo "  WebSocket URL:"
echo "    wss://${DOMAIN}/ws"
echo ""
echo "  Test Credentials:"
echo "    Username: 1000"
echo "    Password: webrtc1000pass"
echo ""
echo "📞 SSH to CentOS:"
echo "    ssh ${CENTOS_USER}@${CENTOS_IP}"
echo ""
echo "🔍 Useful Commands:"
echo ""
echo "    # View logs"
echo "    ssh ${CENTOS_USER}@${CENTOS_IP} 'cd ~/webrtc && docker-compose logs -f'"
echo ""
echo "    # Check service status"
echo "    ssh ${CENTOS_USER}@${CENTOS_IP} 'cd ~/webrtc && docker-compose ps'"
echo ""
echo "    # Restart services"
echo "    ssh ${CENTOS_USER}@${CENTOS_IP} 'cd ~/webrtc && docker-compose restart'"
echo ""
echo "    # Access Asterisk CLI"
echo "    ssh ${CENTOS_USER}@${CENTOS_IP} 'docker exec -it webrtc-asterisk asterisk -r'"
echo ""

print_warning "Next Steps:"
echo ""
echo "1. Access the WebRTC client at https://${DOMAIN}"
echo "2. Register as user 1000 with password webrtc1000pass"
echo "3. Test echo by dialing 600"
echo "4. Test internal call by calling 1001 from another browser"
echo "5. Test Genesys integration by making external call"
echo "6. Review and update default passwords"
echo "7. Configure your DIDs in asterisk/etc/extensions.conf"
echo "8. Set up monitoring and backups"
echo ""

print_success "Deployment completed!"
echo ""


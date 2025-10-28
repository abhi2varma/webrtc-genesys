#!/bin/bash

# WebRTC Setup Script
# Automates the initial setup process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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
    print_error "Please don't run this script as root"
    exit 1
fi

print_header "Asterisk WebRTC Setup"

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    echo "Install Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi
print_success "Docker found"

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    echo "Install: sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    echo "Then: sudo chmod +x /usr/local/bin/docker-compose"
    exit 1
fi
print_success "Docker Compose found"

echo ""

# Step 2: Environment configuration
print_step "Setting up environment configuration..."

if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env file"
else
    print_warning ".env file already exists, skipping"
fi

# Collect configuration
echo ""
print_warning "Please provide the following information:"
echo ""

read -p "Domain name (e.g., webrtc.example.com): " DOMAIN
read -p "Public IP address: " PUBLIC_IP
read -p "Private IP address (press Enter if same as public): " PRIVATE_IP
PRIVATE_IP=${PRIVATE_IP:-$PUBLIC_IP}

echo ""
read -p "Genesys SIP Host: " GENESYS_HOST
read -p "Genesys Username: " GENESYS_USER
read -sp "Genesys Password: " GENESYS_PASS
echo ""

# Generate TURN secret
TURN_SECRET=$(openssl rand -hex 32)

# Update .env file
print_step "Updating configuration files..."

sed -i "s/DOMAIN=.*/DOMAIN=$DOMAIN/" .env
sed -i "s/PUBLIC_IP=.*/PUBLIC_IP=$PUBLIC_IP/" .env
sed -i "s/PRIVATE_IP=.*/PRIVATE_IP=$PRIVATE_IP/" .env
sed -i "s/GENESYS_SIP_HOST=.*/GENESYS_SIP_HOST=$GENESYS_HOST/" .env
sed -i "s/GENESYS_USERNAME=.*/GENESYS_USERNAME=$GENESYS_USER/" .env
sed -i "s/GENESYS_PASSWORD=.*/GENESYS_PASSWORD=$GENESYS_PASS/" .env
sed -i "s/TURN_SECRET=.*/TURN_SECRET=$TURN_SECRET/" .env
sed -i "s/TURN_REALM=.*/TURN_REALM=$DOMAIN/" .env

print_success "Configuration updated"

# Update Asterisk pjsip.conf
print_step "Updating Asterisk configuration..."

sed -i "s/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g" asterisk/etc/pjsip.conf
sed -i "s/GENESYS_SIP_HOST/$GENESYS_HOST/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_USERNAME/$GENESYS_USER/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_PASSWORD/$GENESYS_PASS/g" asterisk/etc/pjsip.conf

print_success "Asterisk configuration updated"

# Update Kamailio configuration
print_step "Updating Kamailio configuration..."

sed -i "s/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g" kamailio/kamailio.cfg
sed -i "s/your-domain.com/$DOMAIN/g" kamailio/kamailio.cfg

print_success "Kamailio configuration updated"

# Update Coturn configuration
print_step "Updating TURN server configuration..."

sed -i "s/YOUR_PUBLIC_IP_HERE/$PUBLIC_IP/g" coturn/turnserver.conf
sed -i "s/your-domain.com/$DOMAIN/g" coturn/turnserver.conf
sed -i "s/your-turn-secret-key/$TURN_SECRET/g" coturn/turnserver.conf

print_success "TURN server configuration updated"

# Update Nginx configuration
print_step "Updating Nginx configuration..."

sed -i "s/your-domain.com/$DOMAIN/g" nginx/nginx.conf
sed -i "s/your-domain.com/$DOMAIN/g" nginx/html/index.html

print_success "Nginx configuration updated"

echo ""

# Step 3: SSL Certificates
print_step "Setting up SSL certificates..."

echo ""
echo "Choose certificate type:"
echo "1) Self-signed (for testing)"
echo "2) Let's Encrypt (for production)"
read -p "Enter choice [1-2]: " cert_choice

case $cert_choice in
    1)
        ./scripts/generate-certs.sh development
        ;;
    2)
        ./scripts/generate-certs.sh production
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""

# Step 4: Firewall setup
print_step "Configuring firewall..."

if command -v ufw &> /dev/null; then
    read -p "Configure firewall rules? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo ufw allow 22/tcp
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        sudo ufw allow 5060:5061/tcp
        sudo ufw allow 5060:5061/udp
        sudo ufw allow 8088:8089/tcp
        sudo ufw allow 10000:20000/udp
        sudo ufw allow 3478:3479/tcp
        sudo ufw allow 3478:3479/udp
        sudo ufw allow 5349/tcp
        sudo ufw allow 5349/udp
        
        print_success "Firewall rules configured"
    fi
else
    print_warning "UFW not found, skipping firewall configuration"
fi

echo ""

# Step 5: Create necessary directories
print_step "Creating directories..."

mkdir -p asterisk/logs
mkdir -p asterisk/sounds
mkdir -p asterisk/keys

print_success "Directories created"

echo ""

# Step 6: Start services
print_step "Starting services..."

read -p "Start services now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose up -d
    
    echo ""
    print_step "Waiting for services to start..."
    sleep 10
    
    # Check service status
    if docker-compose ps | grep -q "Up"; then
        print_success "Services started successfully"
    else
        print_error "Some services failed to start"
        echo "Check logs with: docker-compose logs"
    fi
else
    print_warning "Skipped starting services"
    echo "You can start them later with: docker-compose up -d"
fi

echo ""

# Summary
print_header "Setup Complete!"

echo "Your WebRTC system has been configured with:"
echo ""
echo "  Domain: $DOMAIN"
echo "  Public IP: $PUBLIC_IP"
echo "  Private IP: $PRIVATE_IP"
echo ""
echo "WebRTC Users:"
echo "  - Username: 1000, Password: webrtc1000pass"
echo "  - Username: 1001, Password: webrtc1001pass"
echo "  - Username: 1002, Password: webrtc1002pass"
echo ""
echo "Access your system:"
echo "  - Web Client: https://$DOMAIN"
echo "  - WebSocket: wss://$DOMAIN/ws"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Restart: docker-compose restart"
echo "  - Stop: docker-compose down"
echo "  - Asterisk CLI: docker exec -it webrtc-asterisk asterisk -r"
echo ""
echo "Next steps:"
echo "  1. Test WebRTC connection at https://$DOMAIN"
echo "  2. Make a test call to extension 600 (echo test)"
echo "  3. Configure additional extensions if needed"
echo "  4. Test Genesys integration"
echo ""
print_warning "Don't forget to:"
echo "  - Update default passwords in asterisk/etc/pjsip.conf"
echo "  - Set up monitoring and backups"
echo "  - Review security settings"
echo ""





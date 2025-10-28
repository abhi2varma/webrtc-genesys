#!/bin/bash

# CentOS Setup Script for WebRTC System
# Installs Docker, configures firewall, and prepares system

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root (use sudo)"
    exit 1
fi

print_header "CentOS WebRTC System Setup"

# Detect CentOS version
if [ -f /etc/centos-release ]; then
    CENTOS_VERSION=$(cat /etc/centos-release | grep -oP '\d+' | head -1)
    print_success "Detected CentOS $CENTOS_VERSION"
elif [ -f /etc/redhat-release ]; then
    CENTOS_VERSION=$(cat /etc/redhat-release | grep -oP '\d+' | head -1)
    print_success "Detected RHEL-based system version $CENTOS_VERSION"
else
    print_error "This script is designed for CentOS/RHEL"
    exit 1
fi

echo ""

# Step 1: Update system
print_step "Updating system packages..."
yum update -y
print_success "System updated"
echo ""

# Step 2: Install required packages
print_step "Installing required packages..."
yum install -y yum-utils device-mapper-persistent-data lvm2 curl wget git nano net-tools bind-utils
print_success "Required packages installed"
echo ""

# Step 3: Install Docker
print_step "Installing Docker..."

if command -v docker &> /dev/null; then
    print_warning "Docker is already installed"
    docker --version
else
    # Add Docker repository
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    
    # Install Docker
    yum install -y docker-ce docker-ce-cli containerd.io
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    print_success "Docker installed and started"
    docker --version
fi
echo ""

# Step 4: Install Docker Compose
print_step "Installing Docker Compose..."

if command -v docker-compose &> /dev/null; then
    print_warning "Docker Compose is already installed"
    docker-compose --version
else
    # Download and install Docker Compose
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    print_success "Docker Compose installed"
    docker-compose --version
fi
echo ""

# Step 5: Add current user to docker group
print_step "Configuring Docker permissions..."

if [ -n "$SUDO_USER" ]; then
    usermod -aG docker $SUDO_USER
    print_success "User $SUDO_USER added to docker group"
    print_warning "User needs to logout and login for group changes to take effect"
else
    print_warning "Could not detect non-root user. Run manually: sudo usermod -aG docker \$USER"
fi
echo ""

# Step 6: Configure firewall
print_step "Configuring firewalld..."

if systemctl is-active --quiet firewalld; then
    print_success "Firewalld is active"
    
    # Add ports
    print_step "Opening required ports..."
    
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --permanent --add-port=5060-5061/tcp
    firewall-cmd --permanent --add-port=5060-5061/udp
    firewall-cmd --permanent --add-port=8088-8089/tcp
    firewall-cmd --permanent --add-port=10000-20000/udp
    firewall-cmd --permanent --add-port=3478-3479/tcp
    firewall-cmd --permanent --add-port=3478-3479/udp
    firewall-cmd --permanent --add-port=5349/tcp
    firewall-cmd --permanent --add-port=5349/udp
    
    # Reload firewall
    firewall-cmd --reload
    
    print_success "Firewall configured"
    echo ""
    print_step "Open ports:"
    firewall-cmd --list-ports
else
    print_warning "Firewalld is not active"
    
    read -p "Do you want to enable and configure firewalld? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        systemctl start firewalld
        systemctl enable firewalld
        
        # Add ports (same as above)
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --permanent --add-port=5060-5061/tcp
        firewall-cmd --permanent --add-port=5060-5061/udp
        firewall-cmd --permanent --add-port=8088-8089/tcp
        firewall-cmd --permanent --add-port=10000-20000/udp
        firewall-cmd --permanent --add-port=3478-3479/tcp
        firewall-cmd --permanent --add-port=3478-3479/udp
        firewall-cmd --permanent --add-port=5349/tcp
        firewall-cmd --reload
        
        print_success "Firewalld enabled and configured"
    fi
fi
echo ""

# Step 7: Configure SELinux
print_step "Configuring SELinux..."

SELINUX_STATUS=$(getenforce)
echo "Current SELinux status: $SELINUX_STATUS"

if [ "$SELINUX_STATUS" = "Enforcing" ]; then
    print_warning "SELinux is enforcing. Configuring policies..."
    
    # Install SELinux tools
    yum install -y policycoreutils-python-utils 2>/dev/null || yum install -y policycoreutils-python 2>/dev/null
    
    # Allow HTTP connections
    setsebool -P httpd_can_network_connect on
    
    # Add custom ports
    semanage port -a -t http_port_t -p tcp 8088 2>/dev/null || semanage port -m -t http_port_t -p tcp 8088
    semanage port -a -t http_port_t -p tcp 8089 2>/dev/null || semanage port -m -t http_port_t -p tcp 8089
    
    print_success "SELinux configured for Docker and HTTP"
    print_warning "If you encounter permission issues, check: sudo ausearch -m avc -ts recent"
elif [ "$SELINUX_STATUS" = "Permissive" ]; then
    print_warning "SELinux is in permissive mode (logs but doesn't enforce)"
else
    print_success "SELinux is disabled"
fi
echo ""

# Step 8: Disable and stop conflicting services
print_step "Checking for conflicting services..."

# Check for Apache
if systemctl is-active --quiet httpd; then
    print_warning "Apache (httpd) is running and may conflict with Nginx on port 80/443"
    read -p "Do you want to stop and disable Apache? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        systemctl stop httpd
        systemctl disable httpd
        print_success "Apache stopped and disabled"
    fi
fi

# Check for Asterisk
if systemctl is-active --quiet asterisk; then
    print_warning "Asterisk service is running and may conflict with containerized Asterisk"
    read -p "Do you want to stop and disable system Asterisk? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        systemctl stop asterisk
        systemctl disable asterisk
        print_success "System Asterisk stopped and disabled"
    fi
fi
echo ""

# Step 9: Create necessary directories
print_step "Creating necessary directories..."

PROJECT_DIR=$(pwd)
mkdir -p "$PROJECT_DIR/certs"
mkdir -p "$PROJECT_DIR/asterisk/logs"
mkdir -p "$PROJECT_DIR/asterisk/sounds"
mkdir -p "$PROJECT_DIR/asterisk/keys"
mkdir -p "$PROJECT_DIR/backups"

# Set ownership
if [ -n "$SUDO_USER" ]; then
    chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR"
fi

print_success "Directories created"
echo ""

# Step 10: Install additional utilities
print_step "Installing additional utilities..."
yum install -y nc htop iotop iftop tcpdump wireshark sngrep 2>/dev/null || true
print_success "Additional utilities installed"
echo ""

# Step 11: Optimize system
print_step "Optimizing system settings..."

# Increase file descriptors
if ! grep -q "fs.file-max" /etc/sysctl.conf; then
    echo "fs.file-max = 100000" >> /etc/sysctl.conf
fi

if ! grep -q "net.ipv4.ip_local_port_range" /etc/sysctl.conf; then
    echo "net.ipv4.ip_local_port_range = 1024 65535" >> /etc/sysctl.conf
fi

sysctl -p > /dev/null 2>&1

print_success "System optimized"
echo ""

# Step 12: Create systemd service
print_step "Creating systemd service..."

cat > /etc/systemd/system/webrtc.service << EOF
[Unit]
Description=WebRTC Asterisk System
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=${SUDO_USER:-root}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
print_success "Systemd service created"
echo ""

# Summary
print_header "Setup Complete!"

echo "System is now ready for WebRTC deployment!"
echo ""
echo "✅ Docker installed and running"
echo "✅ Docker Compose installed"
echo "✅ Firewall configured"
echo "✅ SELinux configured"
echo "✅ System optimized"
echo "✅ Systemd service created"
echo ""

print_warning "Next Steps:"
echo ""
echo "1. Run the main setup script:"
echo "   cd $PROJECT_DIR"
echo "   ./scripts/setup.sh"
echo ""
echo "2. Or manually configure and start services:"
echo "   cp .env.example .env"
echo "   nano .env  # Update configuration"
echo "   docker-compose up -d"
echo ""
echo "3. Enable auto-start:"
echo "   sudo systemctl enable webrtc"
echo ""
echo "4. Monitor services:"
echo "   ./scripts/monitor.sh"
echo ""

if [ -n "$SUDO_USER" ]; then
    print_warning "IMPORTANT: User $SUDO_USER needs to logout and login for Docker group changes"
    echo "Or run: newgrp docker"
fi

echo ""
print_success "CentOS setup completed successfully!"
echo ""





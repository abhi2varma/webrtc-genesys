#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   WebRTC Gateway Bridge - Linux Installation           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Please run as root (use sudo)${NC}"
  exit 1
fi

echo -e "${YELLOW}📋 Installation Steps:${NC}"
echo "  1. Install dependencies"
echo "  2. Create service user"
echo "  3. Copy files"
echo "  4. Install systemd service"
echo "  5. Start service"
echo

# Step 1: Install dependencies
echo -e "${YELLOW}[1/5] Installing dependencies...${NC}"

if command -v yum &> /dev/null; then
  # CentOS/RHEL
  yum install -y nodejs npm
elif command -v apt-get &> /dev/null; then
  # Debian/Ubuntu
  apt-get update
  apt-get install -y nodejs npm
else
  echo -e "${RED}❌ Package manager not supported${NC}"
  exit 1
fi

# Install Chromium for Puppeteer
echo "Installing Chromium..."
if command -v yum &> /dev/null; then
  yum install -y chromium
elif command -v apt-get &> /dev/null; then
  apt-get install -y chromium-browser
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 2: Create service user
echo -e "${YELLOW}[2/5] Creating service user...${NC}"

if ! id "webrtc-bridge" &>/dev/null; then
  useradd --system --no-create-home --shell /bin/false webrtc-bridge
  echo -e "${GREEN}✅ User 'webrtc-bridge' created${NC}"
else
  echo -e "${GREEN}✅ User 'webrtc-bridge' already exists${NC}"
fi

# Step 3: Copy files
echo -e "${YELLOW}[3/5] Copying files...${NC}"

# Create directories
mkdir -p /opt/webrtc-gateway-bridge
mkdir -p /var/lib/webrtc-bridge
mkdir -p /var/log/webrtc-bridge

# Copy application files
cp -r ./* /opt/webrtc-gateway-bridge/

# Install Node.js dependencies
cd /opt/webrtc-gateway-bridge
echo "Installing Node.js packages..."
npm install --production

# Set permissions
chown -R webrtc-bridge:webrtc-bridge /opt/webrtc-gateway-bridge
chown -R webrtc-bridge:webrtc-bridge /var/lib/webrtc-bridge
chown -R webrtc-bridge:webrtc-bridge /var/log/webrtc-bridge

echo -e "${GREEN}✅ Files copied${NC}"

# Step 4: Install systemd service
echo -e "${YELLOW}[4/5] Installing systemd service...${NC}"

cp webrtc-bridge.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable webrtc-bridge

echo -e "${GREEN}✅ Service installed${NC}"

# Step 5: Start service
echo -e "${YELLOW}[5/5] Starting service...${NC}"

systemctl start webrtc-bridge

# Wait a bit for service to start
sleep 2

# Check status
if systemctl is-active --quiet webrtc-bridge; then
  echo -e "${GREEN}✅ Service started successfully${NC}"
else
  echo -e "${RED}❌ Service failed to start. Check logs: journalctl -u webrtc-bridge -n 50${NC}"
  exit 1
fi

echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Installation Complete! 🎉                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${YELLOW}📊 Service Status:${NC}"
systemctl status webrtc-bridge --no-pager -l
echo
echo -e "${YELLOW}🔗 Access Points:${NC}"
echo "  Dashboard:    https://192.168.210.54:8000/dashboard"
echo "  Health Check: https://192.168.210.54:8000/health"
echo "  Logs:         https://192.168.210.54:8000/logs"
echo
echo -e "${YELLOW}📝 Useful Commands:${NC}"
echo "  View logs:    sudo journalctl -u webrtc-bridge -f"
echo "  Restart:      sudo systemctl restart webrtc-bridge"
echo "  Stop:         sudo systemctl stop webrtc-bridge"
echo "  Status:       sudo systemctl status webrtc-bridge"
echo
echo -e "${YELLOW}⚙️  Configuration:${NC}"
echo "  Edit: sudo nano /etc/systemd/system/webrtc-bridge.service"
echo "  Then: sudo systemctl daemon-reload && sudo systemctl restart webrtc-bridge"
echo
echo -e "${GREEN}✅ Ready for WWE integration!${NC}"


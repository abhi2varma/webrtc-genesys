#!/bin/bash
#
# Update POC Server with Redis and Kamailio
# Run this on 192.168.210.54
#
# Usage: sudo ./update-poc-server.sh
#

set -e

echo "========================================"
echo "Updating POC Server"
echo "Adding Redis + Kamailio"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found"
    echo "Please run from /opt/gcti_apps/webrtc directory"
    exit 1
fi

# Step 1: Pull latest code from GitHub
echo "[1/6] Pulling latest code from GitHub..."
sudo git stash  # Save any local changes
sudo git pull origin main
echo "✓ Code updated"
echo ""

# Step 2: Create required directories
echo "[2/6] Creating directories for Redis and Kamailio..."
sudo mkdir -p redis/data redis/logs kamailio/logs
sudo chmod -R 755 redis/ kamailio/
echo "✓ Directories created"
echo ""

# Step 3: Verify config files exist
echo "[3/6] Verifying configuration files..."
if [ ! -f "kamailio/kamailio.cfg" ]; then
    echo "✗ Error: kamailio/kamailio.cfg not found"
    exit 1
fi
if [ ! -f "kamailio/dispatcher.list" ]; then
    echo "✗ Error: kamailio/dispatcher.list not found"
    exit 1
fi
echo "✓ Config files present"
echo ""

# Step 4: Stop existing services
echo "[4/6] Stopping existing services..."
sudo docker-compose down
echo "✓ Services stopped"
echo ""

# Step 5: Pull new images
echo "[5/6] Pulling Docker images..."
sudo docker-compose pull redis kamailio
echo "✓ Images pulled"
echo ""

# Step 6: Start all services (including new ones)
echo "[6/6] Starting all services..."
sudo docker-compose up -d
echo "✓ Services started"
echo ""

# Wait for services to be ready
echo "Waiting 15 seconds for services to initialize..."
sleep 15

# Verify all services are running
echo ""
echo "========================================"
echo "Verification"
echo "========================================"
echo ""

sudo docker-compose ps

echo ""
echo "Checking Redis..."
sudo docker exec webrtc-redis redis-cli ping || echo "✗ Redis not responding"

echo ""
echo "Checking Kamailio..."
sudo docker exec webrtc-kamailio pidof kamailio > /dev/null && echo "✓ Kamailio is running" || echo "✗ Kamailio not running"

echo ""
echo "========================================"
echo "Update Complete!"
echo "========================================"
echo ""
echo "Services now running:"
echo "  ✓ Asterisk"
echo "  ✓ Redis (NEW)"
echo "  ✓ Kamailio (NEW)"
echo "  ✓ Coturn"
echo "  ✓ Nginx"
echo "  ✓ Registration Monitor"
echo "  ✓ Dashboard API"
echo ""
echo "Test Redis:"
echo "  sudo docker exec webrtc-redis redis-cli ping"
echo ""
echo "Test Kamailio:"
echo "  sudo docker exec webrtc-kamailio kamailioctl dispatcher dump"
echo ""


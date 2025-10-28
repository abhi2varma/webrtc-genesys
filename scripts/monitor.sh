#!/bin/bash

# Monitoring Script for WebRTC System
# Displays status of all components

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

clear

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WebRTC System Monitor${NC}"
echo -e "${BLUE}  $(date)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Container Status
echo -e "${GREEN}=== Container Status ===${NC}"
docker-compose ps
echo ""

# Asterisk Status
echo -e "${GREEN}=== Asterisk Status ===${NC}"
if docker ps | grep -q webrtc-asterisk; then
    echo "Registered Endpoints:"
    docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints" | grep -E "Endpoint:|Contact:"
    echo ""
    
    echo "Active Calls:"
    docker exec webrtc-asterisk asterisk -rx "core show channels" | tail -1
    echo ""
    
    echo "System Load:"
    docker exec webrtc-asterisk asterisk -rx "core show sysinfo" | grep -E "System:|Load:"
else
    echo -e "${RED}Asterisk container not running${NC}"
fi
echo ""

# Kamailio Status
echo -e "${GREEN}=== Kamailio Status ===${NC}"
if docker ps | grep -q webrtc-kamailio; then
    echo "Active Dialogs:"
    docker exec webrtc-kamailio kamctl dialog show 2>/dev/null | grep -c "dialog::" || echo "0"
    echo ""
    
    echo "Recent errors (last 10):"
    docker logs --tail 10 webrtc-kamailio 2>&1 | grep -i error || echo "No recent errors"
else
    echo -e "${RED}Kamailio container not running${NC}"
fi
echo ""

# System Resources
echo -e "${GREEN}=== System Resources ===${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""

# Disk Usage
echo -e "${GREEN}=== Disk Usage ===${NC}"
echo "Docker volumes:"
docker system df -v | head -20
echo ""

# Network Connectivity
echo -e "${GREEN}=== Network Connectivity ===${NC}"
echo "Checking Genesys SIP connectivity..."
GENESYS_HOST=$(grep GENESYS_SIP_HOST .env 2>/dev/null | cut -d'=' -f2)
if [ -n "$GENESYS_HOST" ]; then
    if ping -c 1 -W 2 "$GENESYS_HOST" &>/dev/null; then
        echo -e "${GREEN}✓ Genesys SIP host reachable${NC}"
    else
        echo -e "${RED}✗ Cannot reach Genesys SIP host${NC}"
    fi
else
    echo "Genesys host not configured"
fi
echo ""

# Recent Logs
echo -e "${GREEN}=== Recent Error Logs ===${NC}"
echo "Asterisk errors (last 5):"
docker logs --tail 100 webrtc-asterisk 2>&1 | grep -i error | tail -5 || echo "No recent errors"
echo ""

# Service Health Check
echo -e "${GREEN}=== Service Health ===${NC}"

check_service() {
    SERVICE=$1
    PORT=$2
    if docker ps | grep -q "$SERVICE"; then
        if nc -z localhost "$PORT" 2>/dev/null; then
            echo -e "${GREEN}✓ $SERVICE (port $PORT)${NC}"
        else
            echo -e "${YELLOW}⚠ $SERVICE running but port $PORT not accessible${NC}"
        fi
    else
        echo -e "${RED}✗ $SERVICE not running${NC}"
    fi
}

check_service "webrtc-nginx" 443
check_service "webrtc-asterisk" 5060
check_service "webrtc-kamailio" 5060
check_service "webrtc-coturn" 3478
check_service "webrtc-mysql" 3306

echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

# Provide quick commands
echo -e "${YELLOW}Quick Commands:${NC}"
echo "  View logs: docker-compose logs -f [service]"
echo "  Restart service: docker-compose restart [service]"
echo "  Asterisk CLI: docker exec -it webrtc-asterisk asterisk -r"
echo "  Reload config: docker exec webrtc-asterisk asterisk -rx 'core reload'"
echo ""





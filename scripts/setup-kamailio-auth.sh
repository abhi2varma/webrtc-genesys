#!/bin/bash
#
# Setup Kamailio Authentication Database
# Creates subscriber entries in Redis for WebRTC clients
#

set -e

echo "========================================"
echo "Kamailio Authentication Setup"
echo "========================================"
echo ""

# Configuration
REDIS_CONTAINER="webrtc-redis"
REDIS_DB=2
SERVER_DOMAIN="192.168.210.54"

# DNs to create
DNS=(5001 5002 5003 5004 5005 5006 5007 5008 5009 5010 5011 5012 5013 5014 5015 5016 5017 5018 5019 5020)

# Check if Redis is running
if ! docker ps | grep -q $REDIS_CONTAINER; then
    echo "❌ Error: Redis container '$REDIS_CONTAINER' is not running"
    echo "Please start the containers first: sudo docker-compose up -d"
    exit 1
fi

echo "✅ Redis container found"
echo ""

# Function to generate HA1 hash
generate_ha1() {
    local username=$1
    local domain=$2
    local password=$3
    echo -n "${username}:${domain}:${password}" | md5sum | awk '{print $1}'
}

# Create subscribers
echo "Creating subscribers in Redis (database $REDIS_DB)..."
echo ""

for dn in "${DNS[@]}"; do
    PASSWORD="password${dn}"
    HA1=$(generate_ha1 "$dn" "$SERVER_DOMAIN" "$PASSWORD")
    
    echo "Creating subscriber: $dn"
    echo "  Domain: $SERVER_DOMAIN"
    echo "  Password: $PASSWORD"
    echo "  HA1: $HA1"
    
    # Add to Redis
    docker exec $REDIS_CONTAINER redis-cli -n $REDIS_DB HSET "subscriber:${dn}" \
        username "$dn" \
        domain "$SERVER_DOMAIN" \
        password "$PASSWORD" \
        ha1 "$HA1" \
        > /dev/null
    
    if [ $? -eq 0 ]; then
        echo "  ✅ Created"
    else
        echo "  ❌ Failed"
    fi
    echo ""
done

echo "========================================"
echo "Verification"
echo "========================================"
echo ""

# Verify entries
echo "Verifying created entries..."
for dn in "${DNS[@]}"; do
    EXISTS=$(docker exec $REDIS_CONTAINER redis-cli -n $REDIS_DB EXISTS "subscriber:${dn}")
    if [ "$EXISTS" = "1" ]; then
        echo "✅ subscriber:${dn} exists"
    else
        echo "❌ subscriber:${dn} NOT FOUND"
    fi
done

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "Created ${#DNS[@]} subscribers in Redis database $REDIS_DB"
echo ""
echo "Test credentials:"
echo "  Username: 5001"
echo "  Password: password5001"
echo "  Domain: $SERVER_DOMAIN"
echo ""
echo "WebRTC Client Settings:"
echo "  SIP Server: ws://$SERVER_DOMAIN/ws"
echo "  Username: 5001 (or 5002-5020)"
echo "  Password: password5001 (or password5002-5020)"
echo ""
echo "To verify manually:"
echo "  sudo docker exec -it $REDIS_CONTAINER redis-cli"
echo "  SELECT $REDIS_DB"
echo "  HGETALL subscriber:5001"
echo ""
echo "✅ Setup complete!"


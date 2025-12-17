#!/bin/bash
################################################################################
# Setup Kamailio Authentication in Redis
# Stores HA1 hashes for WebRTC users (5001-5020)
################################################################################

set -e

REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
REALM="192.168.210.54"
PASSWORD="Genesys2024!WebRTC"

echo "============================================"
echo "Kamailio Authentication Setup"
echo "============================================"
echo "Redis: $REDIS_HOST:$REDIS_PORT"
echo "Realm: $REALM"
echo "Users: 5001-5020"
echo "============================================"
echo

# Function to calculate HA1 (MD5 of username:realm:password)
calculate_ha1() {
    local username=$1
    local realm=$2
    local password=$3
    echo -n "$username:$realm:$password" | md5sum | awk '{print $1}'
}

# Function to add user to Redis
add_user() {
    local username=$1
    local ha1=$2
    
    echo "Adding user: $username"
    
    # Store in Redis as hash
    redis-cli -h $REDIS_HOST -p $REDIS_PORT <<EOF
HSET subscriber:$username username "$username"
HSET subscriber:$username domain "$REALM"
HSET subscriber:$username ha1 "$ha1"
HSET subscriber:$username ha1b ""
HSET subscriber:$username rpid ""
EOF
}

# Clear existing data
echo "Clearing existing subscriber data..."
for i in {5001..5020}; do
    redis-cli -h $REDIS_HOST -p $REDIS_PORT DEL "subscriber:$i" > /dev/null 2>&1 || true
done

echo
echo "Creating users..."
echo

# Create users 5001-5020
for i in {5001..5020}; do
    HA1=$(calculate_ha1 "$i" "$REALM" "$PASSWORD")
    add_user "$i" "$HA1"
done

echo
echo "============================================"
echo "✅ Successfully created 20 users"
echo "============================================"
echo
echo "Verify with:"
echo "  redis-cli -h $REDIS_HOST -p $REDIS_PORT HGETALL subscriber:5001"
echo
echo "Test credentials:"
echo "  Username: 5001"
echo "  Password: $PASSWORD"
echo "  Realm: $REALM"
echo "============================================"

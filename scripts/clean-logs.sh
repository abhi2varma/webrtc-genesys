#!/bin/bash
#
# Clean All Logs - WebRTC Genesys Project
# This script removes all log files from the project
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=================================================="
echo "  Cleaning All Logs - WebRTC Genesys Project"
echo "=================================================="
echo ""

# Function to clean a directory
clean_directory() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo "🧹 Cleaning $description ($dir)..."
        sudo rm -rf "$dir"/*
        echo "   ✅ Cleaned"
    else
        echo "⚠️  Directory not found: $dir"
    fi
}

# Asterisk logs
clean_directory "./asterisk/logs" "Asterisk logs"

# Coturn logs
clean_directory "./coturn/logs" "Coturn logs"

# Nginx logs
clean_directory "./nginx/logs" "Nginx logs"

# Kamailio logs
clean_directory "./kamailio/logs" "Kamailio logs"

# Registration Monitor logs
clean_directory "./registration-monitor/logs" "Registration Monitor logs"

# Dashboard API logs
clean_directory "./dashboard/logs" "Dashboard API logs"

# Signaling Server logs
clean_directory "./signaling-server/logs" "Signaling Server logs"

# Redis logs (if any)
clean_directory "./redis/logs" "Redis logs"

# Redis data (optional - uncomment if you want to clean Redis data too)
# clean_directory "./redis/data" "Redis data"

# Docker container logs (remove stopped containers)
echo ""
echo "🧹 Cleaning Docker container logs..."
docker system prune -f --volumes 2>/dev/null || true
echo "   ✅ Cleaned"

echo ""
echo "=================================================="
echo "  ✅ All logs cleaned successfully!"
echo "=================================================="
echo ""
echo "Note: Logs will be recreated when services start."
echo ""

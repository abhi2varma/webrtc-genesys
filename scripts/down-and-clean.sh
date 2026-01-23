#!/bin/bash
#
# Docker Compose Down with Log Cleanup
# This script stops all containers and cleans all logs
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "=================================================="
echo "  Stopping Docker Services & Cleaning Logs"
echo "=================================================="
echo ""

# Stop all services
echo "🛑 Stopping Docker services..."
sudo docker-compose down

if [ $? -eq 0 ]; then
    echo "   ✅ Services stopped"
else
    echo "   ❌ Failed to stop services"
    exit 1
fi

echo ""

# Clean all logs
echo "🧹 Cleaning all logs..."
bash "$SCRIPT_DIR/clean-logs.sh"

echo ""
echo "=================================================="
echo "  ✅ All done!"
echo "=================================================="
echo ""
echo "To start services again:"
echo "  sudo docker-compose up -d"
echo ""

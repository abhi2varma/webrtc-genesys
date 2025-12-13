#!/bin/bash

# Backup Script for WebRTC System
# Creates timestamped backups of configurations and database

set -e

# Configuration
BACKUP_BASE_DIR="/backups/webrtc"
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Create backup directory with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  WebRTC System Backup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Create backup directory
echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup Asterisk configuration
echo "Backing up Asterisk configuration..."
cp -r asterisk/etc "$BACKUP_DIR/asterisk-etc"
cp -r asterisk/sounds "$BACKUP_DIR/asterisk-sounds" 2>/dev/null || true

# Backup Nginx configuration
echo "Backing up Nginx configuration..."
cp -r nginx "$BACKUP_DIR/nginx"

# Backup Coturn configuration
echo "Backing up Coturn configuration..."
cp -r coturn "$BACKUP_DIR/coturn"

# Backup Docker Compose configuration
echo "Backing up Docker Compose configuration..."
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/" 2>/dev/null || true

# Backup SSL certificates
echo "Backing up SSL certificates..."
cp -r certs "$BACKUP_DIR/certs" 2>/dev/null || true

# Create archive
echo "Creating compressed archive..."
cd "$BACKUP_BASE_DIR"
tar -czf "${TIMESTAMP}.tar.gz" "$TIMESTAMP"
rm -rf "$TIMESTAMP"

# Calculate size
BACKUP_SIZE=$(du -h "${TIMESTAMP}.tar.gz" | cut -f1)

echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
echo "Location: $BACKUP_BASE_DIR/${TIMESTAMP}.tar.gz"
echo "Size: $BACKUP_SIZE"

# Clean up old backups
echo ""
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_BASE_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "Cleanup completed"

# List recent backups
echo ""
echo "Recent backups:"
ls -lh "$BACKUP_BASE_DIR"/*.tar.gz 2>/dev/null | tail -5 || echo "No backups found"

echo ""
echo -e "${GREEN}========================================${NC}"





#!/bin/bash

# SSL Certificate Generation Script
# Usage: ./generate-certs.sh [production|development]

set -e

MODE=${1:-development}
CERT_DIR="./certs"
DOMAIN=${DOMAIN:-"your-domain.com"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  SSL Certificate Generator${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Create certs directory
mkdir -p "$CERT_DIR"

if [ "$MODE" == "production" ]; then
    echo -e "${YELLOW}Production Mode: Let's Encrypt${NC}"
    echo ""
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${RED}Error: certbot is not installed${NC}"
        echo "Install it with: sudo apt install certbot"
        exit 1
    fi
    
    # Request domain name if not set
    if [ "$DOMAIN" == "your-domain.com" ]; then
        echo -e "${YELLOW}Enter your domain name:${NC}"
        read -r DOMAIN
    fi
    
    echo "Generating Let's Encrypt certificate for: $DOMAIN"
    echo ""
    
    # Generate certificate
    sudo certbot certonly --standalone \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "admin@$DOMAIN"
    
    # Copy certificates
    echo "Copying certificates..."
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/key.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" "$CERT_DIR/ca.pem"
    
    # Fix permissions
    sudo chown -R "$USER:$USER" "$CERT_DIR"
    chmod 644 "$CERT_DIR"/*
    
    echo ""
    echo -e "${GREEN}Production certificates generated successfully!${NC}"
    echo ""
    echo "Certificates are located in: $CERT_DIR"
    echo ""
    echo -e "${YELLOW}Set up auto-renewal:${NC}"
    echo "Add this to crontab (crontab -e):"
    echo "0 0 1 * * certbot renew --post-hook 'cp /etc/letsencrypt/live/$DOMAIN/*.pem $(pwd)/$CERT_DIR/ && docker-compose restart'"
    
elif [ "$MODE" == "development" ]; then
    echo -e "${YELLOW}Development Mode: Self-Signed Certificate${NC}"
    echo ""
    
    # Request domain name if not set
    if [ "$DOMAIN" == "your-domain.com" ]; then
        echo -e "${YELLOW}Enter domain name (or leave as localhost for testing):${NC}"
        read -r DOMAIN_INPUT
        if [ -n "$DOMAIN_INPUT" ]; then
            DOMAIN="$DOMAIN_INPUT"
        else
            DOMAIN="localhost"
        fi
    fi
    
    echo "Generating self-signed certificate for: $DOMAIN"
    echo ""
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/cert.pem" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN" \
        2>/dev/null
    
    # Copy cert as CA
    cp "$CERT_DIR/cert.pem" "$CERT_DIR/ca.pem"
    
    # Set permissions
    chmod 644 "$CERT_DIR"/*
    
    echo ""
    echo -e "${GREEN}Self-signed certificates generated successfully!${NC}"
    echo ""
    echo "Certificates are located in: $CERT_DIR"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Self-signed certificates${NC}"
    echo "- Browsers will show security warnings"
    echo "- You'll need to manually accept the certificate"
    echo "- Use only for development/testing"
    echo "- For production, use: ./generate-certs.sh production"
    
else
    echo -e "${RED}Error: Invalid mode '$MODE'${NC}"
    echo "Usage: $0 [production|development]"
    exit 1
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Certificate files:${NC}"
echo "  - cert.pem (Certificate)"
echo "  - key.pem (Private Key)"
echo "  - ca.pem (CA Chain)"
echo -e "${GREEN}======================================${NC}"
echo ""





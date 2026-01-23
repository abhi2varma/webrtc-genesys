# Quick Reference: Server Commands for Testing

## Deploy Contact Header Fix

```bash
cd /opt/gcti_apps/webrtc-genesys
sudo bash scripts/deploy-contact-header-fix.sh
```

## Check Service Status

```bash
# All services
sudo docker-compose ps

# Specific services
sudo docker-compose ps kamailio asterisk nginx
```

## View Logs

```bash
# Follow all logs
sudo docker-compose logs -f

# Specific service
sudo docker-compose logs -f kamailio
sudo docker-compose logs -f asterisk
sudo docker-compose logs -f registration-monitor

# Last N lines
sudo docker-compose logs --tail=50 kamailio

# Filter logs
sudo docker-compose logs -f kamailio | grep -E "REGISTER|Contact"
```

## Verify Registrations

```bash
# Check Asterisk contacts (should show DN as Avail)
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"

# Check Asterisk endpoints
sudo docker-compose exec asterisk asterisk -rx "pjsip show endpoints"

# Check outbound registrations to Genesys
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"

# Check AORs (Address of Record)
sudo docker-compose exec asterisk asterisk -rx "pjsip show aors"
```

## Debug SIP Messages

```bash
# Enable PJSIP logging in Asterisk
sudo docker-compose exec asterisk asterisk -rx "pjsip set logger on"

# View SIP messages in real-time
sudo docker-compose logs -f asterisk | grep -A 30 "REGISTER\|INVITE\|BYE"

# Disable PJSIP logging
sudo docker-compose exec asterisk asterisk -rx "pjsip set logger off"
```

## Check Active Calls

```bash
# Show all channels (active calls)
sudo docker-compose exec asterisk asterisk -rx "core show channels"

# Show detailed channel info
sudo docker-compose exec asterisk asterisk -rx "core show channels verbose"

# Show RTP statistics
sudo docker-compose exec asterisk asterisk -rx "rtp show stats"
```

## Restart Services

```bash
# Restart single service
sudo docker-compose restart kamailio
sudo docker-compose restart asterisk
sudo docker-compose restart nginx

# Restart all services
sudo docker-compose restart

# Stop and start (full restart)
sudo docker-compose down
sudo docker-compose up -d
```

## Check Network Connectivity

```bash
# Test Genesys SIP Server connectivity
telnet 192.168.210.81 5060

# Test Asterisk connectivity
telnet 192.168.210.54 5060

# Check if ports are listening
sudo netstat -tlnp | grep -E "5060|8080|8443"

# Check Docker network
sudo docker network inspect webrtc-genesys_default
```

## Kamailio Specific

```bash
# Check Kamailio config syntax
sudo docker-compose exec kamailio kamailio -c

# Reload Kamailio config (without restart)
sudo docker-compose exec kamailio kamailio -x

# View Kamailio version
sudo docker-compose exec kamailio kamailio -v
```

## Clean Up and Reset

```bash
# Remove all logs
sudo bash scripts/clean-logs.sh

# Stop and clean
sudo bash scripts/down-and-clean.sh

# Full reset (remove all data)
sudo docker-compose down -v
sudo docker-compose up -d
```

## Monitor Registration Status

```bash
# Watch Asterisk contacts in real-time (updates every 2 seconds)
watch -n 2 'sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"'

# Watch registration monitor logs
sudo docker-compose logs -f registration-monitor | grep -E "Registering|Unregistering"
```

## Test Call Flow

```bash
# Make a test call from Asterisk CLI
sudo docker-compose exec asterisk asterisk -rx "console dial 1003@genesys_sip_server"

# Originate a call
sudo docker-compose exec asterisk asterisk -rx "channel originate PJSIP/1003 application Playback demo-congrats"
```

## Database and Redis

```bash
# Connect to Redis
sudo docker-compose exec redis redis-cli

# Check Redis keys
sudo docker-compose exec redis redis-cli KEYS '*'

# Get specific key
sudo docker-compose exec redis redis-cli GET registration:1002
```

## Backup and Restore

```bash
# Create backup
sudo bash scripts/backup.sh

# View backups
ls -lh /opt/gcti_apps/webrtc-genesys/backups/

# Restore from backup (manual)
sudo tar -xzf backups/webrtc-genesys-backup-YYYYMMDD-HHMMSS.tar.gz
```

## Certificate Management

```bash
# Generate new certificates
sudo bash scripts/generate-certs.sh

# Check certificate expiration
openssl x509 -in certs/server.crt -noout -dates

# View certificate details
openssl x509 -in certs/server.crt -noout -text
```

## Performance Monitoring

```bash
# Docker stats
sudo docker stats

# Specific container CPU/Memory
sudo docker stats webrtc-asterisk webrtc-kamailio

# Check disk usage
sudo du -sh *

# Check Docker disk usage
sudo docker system df
```

## Common Troubleshooting Commands

```bash
# Problem: DN shows "Out of Service" in WWE
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"
sudo docker-compose logs --tail=100 kamailio | grep -i "1002"

# Problem: Calls not routing
sudo docker-compose exec asterisk asterisk -rx "pjsip set logger on"
sudo docker-compose logs -f asterisk | grep -A 20 "INVITE"

# Problem: No audio
sudo docker-compose logs -f coturn
sudo docker-compose exec asterisk asterisk -rx "rtp show settings"

# Problem: Registration keeps dropping
sudo docker-compose logs -f registration-monitor
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations" | grep -i expires
```

## Git Operations

```bash
# Pull latest changes
cd /opt/gcti_apps/webrtc-genesys
sudo git pull origin main

# Check current branch
sudo git branch

# View recent commits
sudo git log --oneline -10

# Show changes in a file
sudo git diff HEAD kamailio/kamailio-proxy.cfg
```

## One-Liner Diagnostics

```bash
# Complete status check
echo "=== Services ===" && sudo docker-compose ps && \
echo -e "\n=== Contacts ===" && sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts" && \
echo -e "\n=== Registrations ===" && sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"

# Registration verification for specific DN
DN=1002 && \
echo "Checking DN: $DN" && \
echo "=== Asterisk Contact ===" && \
sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts" | grep -i $DN && \
echo "=== Registration Monitor ===" && \
sudo docker-compose logs --tail=20 registration-monitor | grep -i $DN && \
echo "=== Kamailio Logs ===" && \
sudo docker-compose logs --tail=20 kamailio | grep -i $DN
```

## Useful Aliases (add to ~/.bashrc)

```bash
# Add these to your .bashrc for faster debugging
alias wdc='cd /opt/gcti_apps/webrtc-genesys'
alias wlog='sudo docker-compose logs -f'
alias wps='sudo docker-compose ps'
alias wup='sudo docker-compose up -d'
alias wdown='sudo docker-compose down'
alias wrestart='sudo docker-compose restart'
alias wcontacts='sudo docker-compose exec asterisk asterisk -rx "pjsip show contacts"'
alias wregs='sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"'
alias wchannels='sudo docker-compose exec asterisk asterisk -rx "core show channels"'

# Usage after adding aliases and running 'source ~/.bashrc':
# wdc              # Navigate to project
# wcontacts        # Check contacts
# wregs            # Check registrations
# wlog kamailio    # View Kamailio logs
```

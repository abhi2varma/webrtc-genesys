# Log Rotation Configuration

## Overview
Log rotation has been configured for all services to prevent disk space issues and keep logs manageable.

## Docker Container Logs

All Docker containers are configured with automatic log rotation:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "5m"     # Rotate when log file reaches 5MB
    max-file: "3"      # Keep only 3 rotated files
```

**Result:** Each container will have maximum ~15MB of Docker logs (5MB x 3 files).

### Affected Containers:
- `webrtc-asterisk`
- `webrtc-coturn`
- `webrtc-nginx`
- `webrtc-registration-monitor`
- `webrtc-dashboard-api`

## Service Log Files

All services write their own log files to mounted directories on the host:

### Asterisk Logs
**Location:** `/opt/gcti_apps/webrtc/asterisk/logs/` (on host)

**Configuration in `logger.conf`:**
```ini
[general]
rotatestrategy=rotate
exec_after_rotate=size 10M
```

**Log Files:**
- `messages` - General notices, warnings, errors
- `full` - Full debug log with verbose level 5
- `pjsip` - SIP-specific logs
- `security` - Authentication and security events
- `cdr-csv` - Call Detail Records

**Result:** Each Asterisk log file rotates when it reaches 10MB, keeping 3 rotated copies (~30MB per log type).

### Coturn Logs
**Location:** `/opt/gcti_apps/webrtc/coturn/logs/`

**Log File:** `turnserver.log`

**Rotation:** Coturn automatically rotates logs at 10MB.

### Nginx Logs
**Location:** `/opt/gcti_apps/webrtc/nginx/logs/`

**Log Files:**
- `access.log` - HTTP access logs
- `error.log` - HTTP error logs

**Rotation:** Nginx logs are rotated by Docker at 5MB.

### Registration Monitor Logs
**Location:** `/opt/gcti_apps/webrtc/registration-monitor/logs/`

**Log File:** `registration_monitor.log`

**Rotation:** Python RotatingFileHandler - 10MB max, 3 backup files.

### Dashboard API Logs
**Location:** `/opt/gcti_apps/webrtc/dashboard/logs/`

**Log File:** `dashboard_api.log`

**Rotation:** Python RotatingFileHandler - 10MB max, 3 backup files.

## Viewing Logs

All logs are accessible both via Docker logs and as files on the host.

### View All Service Logs:
```bash
cd /opt/gcti_apps/webrtc

# Asterisk logs
tail -f asterisk/logs/full
tail -f asterisk/logs/pjsip

# Coturn logs
tail -f coturn/logs/turnserver.log

# Nginx logs
tail -f nginx/logs/access.log
tail -f nginx/logs/error.log

# Registration Monitor logs
tail -f registration-monitor/logs/registration_monitor.log

# Dashboard API logs
tail -f dashboard/logs/dashboard_api.log
```

### Docker Container Logs (still available):
```bash
# View last 50 lines
sudo docker logs webrtc-asterisk --tail 50

# Follow logs in real-time
sudo docker logs -f webrtc-registration-monitor

# View with timestamps
sudo docker logs -t webrtc-dashboard-api
```

## Manual Log Cleanup (if needed)

### Clear Docker Container Logs:
```bash
# Truncate logs for a specific container
sudo truncate -s 0 $(docker inspect --format='{{.LogPath}}' webrtc-asterisk)

# Or restart containers (logs reset on restart)
sudo docker-compose restart
```

### Clear Service Log Files:
```bash
cd /opt/gcti_apps/webrtc

# Clear Asterisk logs
sudo truncate -s 0 asterisk/logs/full asterisk/logs/messages asterisk/logs/pjsip asterisk/logs/security

# Clear Coturn logs
sudo truncate -s 0 coturn/logs/turnserver.log

# Clear Nginx logs
sudo truncate -s 0 nginx/logs/access.log nginx/logs/error.log

# Clear Registration Monitor logs
sudo truncate -s 0 registration-monitor/logs/registration_monitor.log

# Clear Dashboard API logs
sudo truncate -s 0 dashboard/logs/dashboard_api.log
```

## Log Retention Summary

| Component | Max Size per File | Files Kept | Total Max Size | Location |
|-----------|------------------|------------|----------------|----------|
| **Docker Container Logs** |
| All Containers | 5 MB | 3 | ~15 MB each | `/var/lib/docker/containers/` |
| **Service Log Files** |
| Asterisk `full` | 10 MB | 3 | ~30 MB | `asterisk/logs/` |
| Asterisk `messages` | 10 MB | 3 | ~30 MB | `asterisk/logs/` |
| Asterisk `pjsip` | 10 MB | 3 | ~30 MB | `asterisk/logs/` |
| Asterisk `security` | 10 MB | 3 | ~30 MB | `asterisk/logs/` |
| Asterisk `cdr-csv` | 10 MB | 3 | ~30 MB | `asterisk/logs/` |
| Coturn `turnserver.log` | 10 MB | auto | ~10 MB | `coturn/logs/` |
| Nginx `access.log` | varies | auto | ~20 MB | `nginx/logs/` |
| Nginx `error.log` | varies | auto | ~10 MB | `nginx/logs/` |
| Monitor `registration_monitor.log` | 10 MB | 3 | ~30 MB | `registration-monitor/logs/` |
| Dashboard `dashboard_api.log` | 10 MB | 3 | ~30 MB | `dashboard/logs/` |

**Total Estimated Maximum:** 
- Docker logs: ~75 MB (5 containers × 15 MB)
- Service logs: ~250 MB
- **Grand Total: ~325 MB for all logs combined**

## Adjusting Retention

To change log retention settings:

1. **Docker logs:** Edit `docker-compose.yml` logging section
2. **Asterisk logs:** Edit `asterisk/etc/logger.conf`
3. Apply changes:
   ```bash
   cd /opt/gcti_apps/webrtc
   sudo git pull origin main
   sudo docker-compose down
   sudo docker-compose up -d
   ```

## Monitoring Disk Usage

```bash
cd /opt/gcti_apps/webrtc

# Check all service log sizes
du -sh */logs/

# Detailed view of all log files
find */logs/ -name "*.log*" -exec du -sh {} \;

# Check Docker container log sizes
sudo du -sh /var/lib/docker/containers/*/

# Check total project disk usage
du -sh .

# Check total disk usage
df -h
```

## Notes

- Docker logs rotate automatically based on size
- Asterisk logs rotate when size limit is reached
- Older rotated files are automatically deleted when max-file count is exceeded
- Log rotation happens in the background without service interruption
- No manual intervention required for normal operation


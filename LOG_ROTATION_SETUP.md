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

## Asterisk Internal Logs

Asterisk's internal log files are configured to rotate separately:

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

## Viewing Logs

### Docker Container Logs:
```bash
# View last 50 lines
sudo docker logs webrtc-asterisk --tail 50

# Follow logs in real-time
sudo docker logs -f webrtc-asterisk

# View logs with timestamps
sudo docker logs -t webrtc-asterisk
```

### Asterisk Internal Logs:
```bash
# View full debug log
tail -f /opt/gcti_apps/webrtc/asterisk/logs/full

# View PJSIP logs
tail -f /opt/gcti_apps/webrtc/asterisk/logs/pjsip

# View security logs
tail -f /opt/gcti_apps/webrtc/asterisk/logs/security
```

### Registration Monitor Logs:
```bash
sudo docker logs webrtc-registration-monitor --tail 50
```

### Dashboard API Logs:
```bash
sudo docker logs webrtc-dashboard-api --tail 50
```

## Manual Log Cleanup (if needed)

### Clear Docker Container Logs:
```bash
# Truncate logs for a specific container
sudo truncate -s 0 $(docker inspect --format='{{.LogPath}}' webrtc-asterisk)

# Or restart containers (logs reset on restart)
sudo docker-compose restart
```

### Clear Asterisk Internal Logs:
```bash
cd /opt/gcti_apps/webrtc/asterisk/logs
sudo truncate -s 0 full messages pjsip security
```

## Log Retention Summary

| Component | Max Size per File | Files Kept | Total Max Size |
|-----------|------------------|------------|----------------|
| Docker Container Logs | 5 MB | 3 | ~15 MB each |
| Asterisk `full` | 10 MB | 3 | ~30 MB |
| Asterisk `messages` | 10 MB | 3 | ~30 MB |
| Asterisk `pjsip` | 10 MB | 3 | ~30 MB |
| Asterisk `security` | 10 MB | 3 | ~30 MB |
| Asterisk `cdr-csv` | 10 MB | 3 | ~30 MB |

**Total Estimated Maximum:** ~225 MB for all logs combined

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
# Check Docker container log sizes
sudo du -sh /var/lib/docker/containers/*/

# Check Asterisk log sizes
sudo du -sh /opt/gcti_apps/webrtc/asterisk/logs/*

# Check total disk usage
df -h
```

## Notes

- Docker logs rotate automatically based on size
- Asterisk logs rotate when size limit is reached
- Older rotated files are automatically deleted when max-file count is exceeded
- Log rotation happens in the background without service interruption
- No manual intervention required for normal operation


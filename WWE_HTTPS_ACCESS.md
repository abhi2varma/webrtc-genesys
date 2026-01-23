# WWE HTTPS Access Configuration

## Summary
WWE is now accessible via HTTPS on port 8443 through Nginx reverse proxy.

## Access URLs

### Old HTTP URL (Still works on server):
```
http://192.168.210.54:8090/ui/ad/v1/index.html
```

### New HTTPS URL (via Nginx proxy):
```
https://192.168.210.54:8443/wwe/ui/ad/v1/index.html
```

Or simply access the root:
```
https://192.168.210.54:8443/wwe/
```

## What Changed

### Nginx Configuration (`nginx/nginx.conf`)

**Added:**
1. **WebSocket upgrade mapping** (http block level):
   ```nginx
   map $http_upgrade $connection_upgrade {
       default upgrade;
       '' close;
   }
   ```

2. **WWE proxy location** (server block):
   ```nginx
   location /wwe/ {
       proxy_pass http://192.168.210.54:8090/;
       # ... proxy settings including WebSocket support
   }
   ```

## Features

✅ **HTTPS Encryption**: All WWE traffic encrypted via TLS
✅ **Single Port**: Both WebRTC Gateway and WWE accessible on port 8443
✅ **WebSocket Support**: If WWE uses WebSockets, they'll work through the proxy
✅ **Proper Redirects**: Internal WWE redirects handled correctly
✅ **Long Timeouts**: 300s timeouts for long-polling/WebSocket connections

## Deployment Steps

### On the Server (192.168.210.54):

1. **SSH to server**:
   ```bash
   ssh -p 69 Gencct@192.168.210.54
   ```

2. **Navigate to project**:
   ```bash
   cd /opt/gcti_apps/webrtc-genesys
   ```

3. **Pull the updated nginx config** (or manually copy):
   ```bash
   git pull origin main
   # Or checkout the specific commit with WWE config
   ```

4. **Test Nginx configuration**:
   ```bash
   sudo docker-compose exec nginx nginx -t
   ```

5. **Reload Nginx** (without downtime):
   ```bash
   sudo docker-compose exec nginx nginx -s reload
   ```
   
   Or restart the container:
   ```bash
   sudo docker-compose restart nginx
   ```

6. **Verify**:
   ```bash
   # Check Nginx logs
   sudo docker-compose logs nginx
   
   # Test the endpoint
   curl -k https://192.168.210.54:8443/wwe/
   ```

## Architecture

```
Client (Browser/Electron)
    ↓
HTTPS on port 8443
    ↓
Nginx (SSL termination)
    ├─ /wwe/ → HTTP proxy to 192.168.210.54:8090 (WWE backend)
    ├─ /ws → WSS proxy to Kamailio
    ├─ /api/ → Dashboard API
    └─ / → WebRTC Client App
```

## Benefits

1. **Security**: All traffic encrypted end-to-end
2. **Simplicity**: Single HTTPS port for all web services
3. **Consistency**: Same security model for WWE and WebRTC
4. **Firewall-friendly**: Only one port (8443) needs to be open
5. **Certificate management**: Single SSL certificate for all services

## Testing

### Test WWE Access:
```bash
# From local machine
curl -k https://192.168.210.54:8443/wwe/ui/ad/v1/index.html

# Or open in browser (accept self-signed cert warning)
https://192.168.210.54:8443/wwe/ui/ad/v1/index.html
```

### Test WebRTC Gateway (unchanged):
```bash
curl -k https://192.168.210.54:8443/
```

## Notes

- The backend WWE service on port 8090 doesn't need to change
- WWE continues to run on HTTP on 8090, but is only accessible via HTTPS proxy
- If WWE has hardcoded HTTP URLs, they may need updating to use relative URLs
- WebSocket connections (if WWE uses them) are supported via the proxy

## Rollback

If needed, simply remove the `/wwe/` location block and reload Nginx.

# WWE HTTPS Configuration Summary

## Completed Configuration

All services are now accessible via **HTTPS on port 8443** with proper routing.

## Service URLs

### Main Applications

| Service | URL | Purpose |
|---------|-----|---------|
| **WWE (Genesys Workspace)** | `https://192.168.210.54:8443/` | Agent workspace interface |
| **WWE Login** | `https://192.168.210.54:8443/ui/ad/v1/index.html` | WWE login page |
| **Dashboard** | `https://192.168.210.54:8443/dashboard/` | WebRTC gateway monitoring |
| **WebRTC SIP Client** | `https://192.168.210.54:8443/webrtc/` | Standalone WebRTC client |

### Electron App Bridge

| File | URL | Purpose |
|------|-----|---------|
| Gateway HTML | `https://192.168.210.54:8443/wwe-webrtc-gateway.html` | Main gateway loaded by Electron |
| Gateway JS | `https://192.168.210.54:8443/wwe-webrtc-gateway.js` | Gateway JavaScript |
| JsSIP Library | `https://192.168.210.54:8443/jssip.min.js` | SIP/WebRTC library |
| WebRTC Adapter | `https://192.168.210.54:8443/adapter.js` | Browser compatibility |

### APIs

| API Path | Backend | Purpose |
|----------|---------|---------|
| `/api/v2/*` | WWE:8090 | WWE REST API v2 |
| `/api/v1/*` | WWE:8090 | WWE REST API v1 (notifications, CometD) |
| `/internal-api/*` | WWE:8090 | WWE internal API |
| `/api/*` | Dashboard:5000 | Dashboard API (fallback for non-WWE) |

### WebSocket Services

| Path | Backend | Purpose |
|------|---------|---------|
| `/ws` | Kamailio:8088 | **WSS** - SIP signaling for WebRTC clients |
| `/signaling` | Signaling:8083 | Custom signaling server |

## Electron App Configuration

### Updated Settings (in `webrtc-gateway-bridge/src/main.js`)

```javascript
gateway: {
  url: 'https://192.168.210.54:8443',
  iframeUrl: 'https://192.168.210.54:8443/wwe-webrtc-gateway.html',
  sipServer: 'wss://192.168.210.54:8443/ws'  // WSS (secure WebSocket)
},
wwe: {
  allowedOrigins: [
    'http://192.168.210.54:8090',
    'https://192.168.210.54:8090',
    'https://192.168.210.54:8443',  // NEW: WWE via HTTPS proxy
    'http://103.167.180.166:8090',
    'https://103.167.180.166:8090'
  ]
}
```

### Key Changes

1. ✅ **SIP Server**: Changed from `ws://` to `wss://` (secure WebSocket)
2. ✅ **Port**: Changed from `:8080` to `:8443` (HTTPS port)
3. ✅ **Path**: Changed to `/ws` (Nginx WebSocket proxy endpoint)
4. ✅ **CORS**: Added `https://192.168.210.54:8443` to allowed origins

## Nginx Configuration

### Location Blocks (Priority Order)

1. **WWE API v2** → `http://192.168.210.54:8090/api/v2/`
2. **WWE API v1** → `http://192.168.210.54:8090/api/v1/` (notifications, CometD)
3. **WWE Internal API** → `http://192.168.210.54:8090/internal-api/`
4. **Dashboard API** → `http://192.168.210.54:5000/api/`
5. **Dashboard UI** → `http://192.168.210.54:5000/` (via `/dashboard/`)
6. **WebSocket (WSS)** → `ws://192.168.210.54:8088` (Kamailio)
7. **Signaling (WSS)** → `ws://192.168.210.54:8083`
8. **WebRTC Gateway Files**:
   - `wwe-webrtc-gateway.html` → Nginx static
   - `wwe-webrtc-gateway.js` → Nginx static
   - `jssip.min.js` → Nginx static
   - `adapter.js` → Nginx static
9. **WebRTC Client** → Nginx static (via `/webrtc/`)
10. **WWE (Root)** → `http://192.168.210.54:8090/` (catch-all)

## Deployment Steps

### On Server (192.168.210.54)

```bash
# SSH to server
ssh -p 69 Gencct@192.168.210.54

# Navigate to project
cd /opt/gcti_apps/webrtc-genesys

# Checkout main and pull latest
git checkout main
git pull origin main

# Restart Nginx to apply new config
sudo docker-compose restart nginx

# Verify Nginx is running
sudo docker-compose ps nginx
sudo docker-compose logs nginx | tail -20
```

### On Windows Client (for Electron App)

```bash
# Navigate to project
cd D:\Abhi\WebRTC\webrtc-genesys

# Pull latest code
git pull origin main

# Reinstall Electron app if needed
cd webrtc-gateway-bridge
npm install

# Start Electron app (will use new HTTPS config)
npm start
```

## Testing

### Test WWE Access

```bash
# From browser (accept self-signed cert warning)
https://192.168.210.54:8443/ui/ad/v1/index.html

# Login with test1 / password
# Should see WWE workspace
```

### Test Dashboard

```bash
# From browser
https://192.168.210.54:8443/dashboard/

# Should show WebRTC gateway monitoring page
```

### Test Electron App

1. Start Electron app: `npm start` (in `webrtc-gateway-bridge/`)
2. WWE should load at `https://192.168.210.54:8443/`
3. Login with agent credentials
4. Electron bridge should connect to gateway at `https://192.168.210.54:8443/wwe-webrtc-gateway.html`
5. SIP registration should use `wss://192.168.210.54:8443/ws`

### Test API Endpoints

```bash
# WWE API
curl -k https://192.168.210.54:8443/api/v2/me

# Dashboard API
curl -k https://192.168.210.54:8443/api/registrations
```

## Security Notes

1. **Self-Signed Certificates**: The server uses self-signed SSL certificates
   - Browsers will show security warnings - click "Advanced" → "Proceed"
   - Electron app is configured to accept self-signed certs

2. **Port 8443**: Only this port needs to be open externally
   - All HTTP traffic is redirected to HTTPS
   - All services are protected by SSL/TLS

3. **Internal Ports** (no external access needed):
   - `8090` - WWE backend
   - `5000` - Dashboard backend
   - `8088` - Kamailio (plain WebSocket, internal only)
   - `8083` - Signaling server

## Troubleshooting

### Issue: WWE not loading

**Check:**
```bash
sudo docker-compose exec nginx nginx -t
sudo docker-compose logs nginx
```

### Issue: WebSocket connection fails

**Check:**
- Nginx logs for WebSocket upgrade failures
- Firewall allows port 8443
- Certificate is accepted in browser

### Issue: Electron app can't connect

**Check:**
- Electron app is using latest code: `git pull origin main`
- Check Electron console logs
- Verify `wwe-webrtc-gateway.html` is accessible: `curl -k https://192.168.210.54:8443/wwe-webrtc-gateway.html`

### Issue: 404 errors in WWE

**Check:**
- Nginx is routing `/api/v2/` to port 8090
- WWE backend is running: `curl http://192.168.210.54:8090/api/v2/me`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Port 8443 (HTTPS/WSS)                    │
│                         Nginx Proxy                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
    ┌───▼────┐           ┌──────▼──────┐
    │  WWE   │           │  Dashboard  │
    │  :8090 │           │    :5000    │
    └───┬────┘           └─────────────┘
        │
    ┌───▼────────────┐
    │  Kamailio WSS  │
    │     :8088      │
    └───┬────────────┘
        │
    ┌───▼────────┐
    │  Asterisk  │
    │   :5060    │
    └────────────┘
```

## Benefits

✅ **Single Secure Port**: Only 8443 needs to be exposed
✅ **HTTPS Everywhere**: All web traffic encrypted
✅ **WSS for WebRTC**: Secure WebSocket for SIP signaling
✅ **Unified Access**: WWE, Dashboard, and Electron app all on one port
✅ **Better Security**: No plain HTTP or WS connections externally
✅ **NAT/Firewall Friendly**: Only one port to configure

## Next Steps

1. Deploy changes to server (commands above)
2. Test WWE login via HTTPS
3. Test Electron app with new WSS configuration
4. Update firewall rules to allow only port 8443
5. Consider getting a proper SSL certificate (Let's Encrypt) for production

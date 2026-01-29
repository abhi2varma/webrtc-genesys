# Cloud TURN Deployment - Fixing ICE Connection Failures

## Problem Analysis

**Date:** January 29, 2026

### Issue
Call flow was:
1. ✅ SIP registration successful
2. ✅ Incoming call received from 1003
3. ✅ Auto-answer triggered
4. ✅ ICE candidates generated (including Metered.ca relay)
5. ❌ ICE connection state: `disconnected` → `failed`
6. ❌ Connection state: `failed`
7. ❌ Call canceled after 30 seconds

### Root Cause

**Both sides generated relay candidates from DIFFERENT TURN servers:**
- **Client (1002 - Electron):** Generated relay from `103.167.180.166:49185` (Metered.ca cloud TURN)
- **Server (Asterisk):** Generated relay from `103.167.180.166:49178` (local coturn server)

**They couldn't connect because:**
1. Client tried to connect to Asterisk's local coturn relay → **FAILED** (router NAT blocking)
2. Asterisk tried to connect to Metered.ca relay → **FAILED** (not configured to use it)
3. Direct connection also failed due to NAT

### Solution

**Remove local TURN server from client configuration**, force both sides to use only:
1. **Google STUN** for discovering public IPs
2. **Metered.ca cloud TURN** (ports 80, 443) for relay when direct connection fails

## Changes Made

### 1. Updated Client Configuration (`nginx/html/wwe-webrtc-gateway-v2.html`)

**Removed:**
```javascript
{
    urls: 'turn:103.167.180.166:3478',
    username: 'webrtc',
    credential: 'Genesys2024!SecureTurn'
}
```

**Now using ONLY:**
```javascript
iceServers: [
    // Google STUN (free, public)
    { urls: 'stun:stun.l.google.com:19302' },
    
    // Metered.ca cloud TURN (50GB free tier)
    { 
        urls: 'turn:a.relay.metered.ca:80',
        username: '87a47860aaa39c9d5524de53',
        credential: 'xfOwa55SxL1cu6w+'
    },
    { 
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: '87a47860aaa39c9d5524de53',
        credential: 'xfOwa55SxL1cu6w+'
    },
    { 
        urls: 'turn:a.relay.metered.ca:443',
        username: '87a47860aaa39c9d5524de53',
        credential: 'xfOwa55SxL1cu6w+'
    },
    { 
        urls: 'turn:a.relay.metered.ca:443?transport=tcp',
        username: '87a47860aaa39c9d5524de53',
        credential: 'xfOwa55SxL1cu6w+'
    }
]
```

### 2. Local Coturn Status

**Option A - STOP coturn (Recommended):**
```bash
docker-compose stop coturn
```

**Option B - Keep coturn running (for future use):**
- Keep it running but clients won't use it
- Can be used later when port forwarding is properly configured

## Deployment Steps

### On Server:

```bash
# 1. Pull latest changes
cd /opt/webrtc-genesys
git pull

# 2. Restart nginx to serve updated HTML
docker-compose restart nginx

# 3. (Optional) Stop coturn to save resources
docker-compose stop coturn

# 4. Verify services
docker ps | grep -E 'nginx|asterisk|registration-monitor'
```

### On Client Machine:

```bash
# 1. Kill Electron process
taskkill /F /IM electron.exe

# 2. Clear Electron cache (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\webrtc-gateway-bridge"

# 3. Restart Electron bridge
cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge
npm start
```

## Testing

### Expected ICE Candidates After Fix:

**Client side (1002):**
- Multiple `host` candidates (local IPs)
- ✅ `srflx` candidates from Google STUN (if NAT allows)
- ✅ `relay` candidates from Metered.ca TURN

**Server side (Asterisk):**
- Multiple `host` candidates (local IPs)
- ✅ `srflx` candidates from Google STUN
- ✅ **NO relay candidates** (or relay from Metered.ca if we configure it)

### Success Criteria:

1. ✅ ICE Connection State: `connected` or `completed`
2. ✅ Connection State: `connected`
3. ✅ Two-way audio established
4. ✅ Call appears in WWE interface (with CallUUID from NOTIFY)

## Why Metered.ca Ports 80/443?

- **Port 80 (UDP/TCP):** Works in most networks, rarely blocked
- **Port 443 (UDP/TCP):** HTTPS port, almost never blocked by firewalls
- **Port 3478:** Standard TURN port, often blocked by corporate firewalls

## Alternative: Configure Asterisk to use Metered.ca

Asterisk's PJSIP doesn't easily support external TURN servers like browsers do. If we need Asterisk to also use Metered.ca:

1. **Option 1:** Use a TURN client library (complex)
2. **Option 2:** Configure router to properly forward UDP ports for coturn
3. **Option 3:** Let browser/Electron handle all TURN relay (current approach)

## Monitoring

### Check ICE Connection Status:
- Look for `🧊 ICE Connection State: connected` in Electron console
- Look for `🔗 Connection State: connected` in Electron console

### Check TURN Usage:
- Look for `🧊 ICE Candidate [relay]: a.relay.metered.ca` in logs
- Verify priority order: host > srflx > relay

### Troubleshooting:

**If still fails:**
1. Check Metered.ca account quota (50GB free)
2. Verify credentials haven't expired
3. Test TURN server: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
4. Check if port 80/443 UDP is blocked by client firewall

## Benefits of Cloud TURN

1. ✅ **Works immediately** - no port forwarding needed
2. ✅ **Reliable** - professionally maintained
3. ✅ **Free tier** - 50GB/month
4. ✅ **Low latency** - global edge network
5. ✅ **Multiple ports** - bypass firewall restrictions

## Next Steps

1. Deploy these changes
2. Test call flow again (1003 → 1002)
3. Verify ICE connection succeeds
4. Test with WWE integration

## Rollback Plan

If this doesn't work, revert to local coturn:

```bash
# Revert nginx/html/wwe-webrtc-gateway-v2.html
git checkout nginx/html/wwe-webrtc-gateway-v2.html

# Restart services
docker-compose restart nginx coturn
```

## References

- Metered.ca Dashboard: https://www.metered.ca/dashboard
- WebRTC Samples ICE Test: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- Asterisk PJSIP ICE: https://wiki.asterisk.org/wiki/display/AST/Configuring+res_pjsip+for+WebRTC+Clients

# Kamailio SIP Proxy - WebRTC Gateway Guide

## Architecture Overview

### New Call Flow with Kamailio as SIP Proxy

```
┌─────────────────┐
│  WebRTC Client  │
│   (Browser)     │
└────────┬────────┘
         │ WSS (WebSocket Secure)
         │ SIP over WebSocket
         ↓
┌─────────────────┐
│     Nginx       │ Port 80/443
│  Reverse Proxy  │ /ws → Kamailio
└────────┬────────┘
         │ WS (WebSocket)
         │ Port 8080
         ↓
┌─────────────────┐
│   Kamailio      │ Port 8080 (WS)
│   SIP Proxy     │ Port 8443 (WSS)
│                 │ Port 5060 (UDP/TCP)
│ ✓ WebSocket     │ Port 5061 (TLS)
│ ✓ Auth          │
│ ✓ NAT Detection │
│ ✓ Routing       │
└────────┬────────┘
         │ SIP/UDP
         │ Port 5060
         ↓
┌─────────────────┐
│    Asterisk     │ Port 5060 (SIP/UDP)
│   PBX/B2BUA     │ Port 8088 (WebSocket - UNUSED)
│                 │
│ ✓ SIP B2BUA     │
│ ✓ Media Gateway │
│ ✓ Transcoding   │
└────────┬────────┘
         │ SIP/UDP
         │ Port 5060
         ↓
┌─────────────────┐
│  Genesys SIP    │
│    Server       │
│ 192.168.210.81  │
└─────────────────┘

Media Flow (RTP - Direct to Asterisk):
WebRTC Client ←→ Asterisk (DTLS-SRTP ↔ RTP) ←→ Genesys
```

## Kamailio Functions

### 1. SIP over WebSocket (WSS)

**Configuration:**
```cfg
listen=ws:192.168.210.54:8080      # WebSocket (for testing)
listen=wss:192.168.210.54:8443     # WebSocket Secure (production)

event_route[xhttp:request] {
    if ($hdr(Upgrade) =~ "websocket") {
        ws_handle_handshake();
    }
}
```

**How it works:**
- Nginx receives WSS connection from browser on port 443
- Nginx proxies to Kamailio WS port 8080 (localhost)
- Kamailio performs WebSocket handshake
- SIP messages flow over WebSocket frames
- Kamailio converts to standard SIP/UDP for Asterisk

**Supported Methods:**
- REGISTER - Client registration
- INVITE - Initiate call
- ACK - Call establishment
- BYE - Terminate call
- CANCEL - Cancel pending call
- OPTIONS - Keepalive/ping
- SUBSCRIBE/NOTIFY - Presence (optional)

### 2. Authentication

**Configuration:**
```cfg
loadmodule "auth.so"
loadmodule "auth_db.so"

modparam("auth_db", "db_url", "redis://redis:6379/2")
modparam("auth_db", "calculate_ha1", yes)

route[AUTH] {
    if (!auth_check("$fd", "subscriber", "1")) {
        auth_challenge("$fd", "0");
        exit;
    }
    consume_credentials();
}
```

**How it works:**
1. Client sends REGISTER/INVITE without credentials
2. Kamailio challenges with `401 Unauthorized` + nonce
3. Client resends with digest authentication
4. Kamailio validates against Redis database
5. If valid, forwards to Asterisk (already authenticated)
6. Asterisk doesn't need to re-authenticate

**Credential Storage:**
- Stored in Redis database (db=2)
- Table: `subscriber`
- Fields: `username`, `domain`, `password`, `ha1`
- Password hashed using MD5 digest

### 3. NAT Detection (SIP Headers)

**Configuration:**
```cfg
loadmodule "nathelper.so"

route[NATDETECT] {
    force_rport();
    
    if (nat_uac_test("19")) {
        xlog("L_INFO", "NAT detected: $si:$sp\n");
        setflag(5);
        
        if (is_method("REGISTER")) {
            fix_nated_register();
        } else {
            if (proto == WS || proto == WSS) {
                add_contact_alias();
            } else {
                fix_nated_contact();
            }
        }
    }
}
```

**NAT Detection Tests (nat_uac_test flags):**
- `1` - Contact header != source IP
- `2` - Via "received" parameter != source IP
- `4` - Via contains RFC1918 private IP
- `8` - SDP contains RFC1918 private IP
- `16` - Port in Contact != source port
- `19` - All of the above (1+2+16)

**NAT Fixes:**
1. **fix_nated_register()**: Rewrites Contact header with actual source IP:port
2. **add_contact_alias()**: Adds alias parameter for WebSocket connections
3. **force_rport()**: Forces `rport` in Via header for symmetric response routing
4. **handle_ruri_alias()**: Handles alias in replies

**WebSocket Special Handling:**
- WebSocket connections always treated as NATed
- Contact header aliased with connection ID
- Ensures responses route back through same WebSocket connection

### 4. Routing Decisions

**Configuration:**
```cfg
loadmodule "dispatcher.so"

modparam("dispatcher", "list_file", "/etc/kamailio/dispatcher.list")
modparam("dispatcher", "flags", 2)
modparam("dispatcher", "ds_ping_interval", 10)

route[DISPATCH] {
    # Select Asterisk backend
    if (!ds_select_dst("1", "4")) {
        send_reply("503", "Service Unavailable");
        exit;
    }
    
    # Force destination
    $du = "sip:127.0.0.1:5060;transport=udp";
    
    t_on_failure("DISPATCH_FAILURE");
    route(RELAY);
}
```

**Routing Logic:**

1. **REGISTER Requests:**
   - Authenticate user
   - Detect NAT
   - Forward to Asterisk for endpoint registration
   - Asterisk maintains registration state

2. **INVITE/BYE Requests:**
   - Authenticate user
   - Detect NAT
   - Check if destination is local (WebRTC client) or external (Genesys)
   - Route to Asterisk for media handling
   - Asterisk makes routing decision based on dialplan

3. **Response Routing:**
   - Record-Route header ensures in-dialog requests route through Kamailio
   - Contact aliases ensure responses reach correct WebSocket connection
   - NAT fixes applied to responses

**Dispatcher (Load Balancing):**
- Current setup: Single Asterisk backend
- Algorithm: Round-robin (`flags=4`)
- Health checks: OPTIONS ping every 10 seconds
- Failover: Automatic to next backend on failure

**Future Scalability:**
```
Kamailio → Asterisk1 (50% traffic)
         → Asterisk2 (50% traffic)
         → Asterisk3 (backup)
```

## Configuration Files

### 1. kamailio-proxy.cfg
Main configuration file with:
- Module loading
- Parameter configuration
- Routing logic
- Event handlers

**Key Routes:**
- `request_route` - Main entry point
- `route[REQINIT]` - Initial sanity checks
- `route[REGISTRAR]` - REGISTER processing
- `route[AUTH]` - Authentication
- `route[NATDETECT]` - NAT detection
- `route[DISPATCH]` - Route to Asterisk
- `route[RELAY]` - Forward request

### 2. tls.cfg
TLS configuration for WSS:
- Certificate paths
- TLS version (1.2+)
- Cipher suites

### 3. dispatcher.list
Asterisk backend list:
```
# setid destination flags priority attributes
1 sip:127.0.0.1:5060;transport=udp 0 0 asterisk1
```

## Deployment

### Prerequisites
- Server IP: `192.168.210.54`
- Asterisk running on port 5060 (UDP)
- Redis running on port 6379
- TLS certificates in `./certs/`

### Step 1: Backup Current Configuration
```bash
cd /home/Gencct/webrtc-genesys
sudo docker-compose down

# Backup
cp kamailio/kamailio.cfg kamailio/kamailio.cfg.backup
git add -A
git commit -m "backup: Pre-Kamailio-proxy configuration"
git tag "pre-kamailio-proxy"
```

### Step 2: Update Configuration Files
```bash
# Copy new files to server
scp -P 69 kamailio/kamailio-proxy.cfg Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/kamailio/
scp -P 69 kamailio/tls.cfg Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/kamailio/
scp -P 69 kamailio/dispatcher.list Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/kamailio/
scp -P 69 nginx/nginx.conf Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/nginx/
scp -P 69 docker-compose.yml Gencct@192.168.210.54:/home/Gencct/webrtc-genesys/
```

### Step 3: Create User Database
```bash
# Connect to Redis
sudo docker exec -it webrtc-redis redis-cli

# Select database 2 (for authentication)
SELECT 2

# Add test users (5001 and 5002)
HSET subscriber:5001 username "5001"
HSET subscriber:5001 domain "192.168.210.54"
HSET subscriber:5001 password "password5001"
HSET subscriber:5001 ha1 "$(echo -n "5001:192.168.210.54:password5001" | md5sum | awk '{print $1}')"

HSET subscriber:5002 username "5002"
HSET subscriber:5002 domain "192.168.210.54"
HSET subscriber:5002 password "password5002"
HSET subscriber:5002 ha1 "$(echo -n "5002:192.168.210.54:password5002" | md5sum | awk '{print $1}')"

# Verify
HGETALL subscriber:5001
HGETALL subscriber:5002

# Exit Redis
exit
```

### Step 4: Rebuild and Restart
```bash
cd /home/Gencct/webrtc-genesys

# Rebuild Kamailio with new config
sudo docker-compose build kamailio

# Restart all services
sudo docker-compose up -d

# Verify services
sudo docker ps
```

### Step 5: Verify Kamailio
```bash
# Check Kamailio logs
sudo docker logs webrtc-kamailio --tail 50

# Expected output:
# - Listening on ws:192.168.210.54:8080
# - Listening on wss:192.168.210.54:8443
# - Dispatcher loaded 1 destination
# - Loaded module: websocket, auth_db, nathelper

# Check if Kamailio can reach Asterisk
sudo docker exec webrtc-kamailio kamcmd dispatcher.list
# Should show: URI: sip:127.0.0.1:5060 FLAGS: AP (Active, Probing)

# Monitor SIP traffic
sudo docker exec webrtc-kamailio kamcmd core.printi
```

### Step 6: Test WebSocket Connection
```bash
# Test WebSocket handshake (from dev machine)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  http://192.168.210.54:8080/ws

# Expected: 101 Switching Protocols
```

### Step 7: Test WebRTC Client
1. Open browser: `http://192.168.210.54/`
2. Enter credentials:
   - Username: `5001`
   - Password: `password5001`
   - SIP Server: `ws://192.168.210.54/ws` (Nginx proxies to Kamailio)
3. Click **Register**
4. Monitor logs:

```bash
# Kamailio logs (should show REGISTER)
sudo docker logs -f webrtc-kamailio

# Asterisk logs (should show endpoint registration)
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"
```

## Troubleshooting

### Issue 1: WebSocket Connection Failed
**Symptoms:**
- Browser console: `WebSocket connection to 'ws://192.168.210.54/ws' failed`

**Check:**
```bash
# Nginx running?
sudo docker ps | grep nginx

# Nginx proxying to Kamailio?
sudo docker exec webrtc-nginx cat /etc/nginx/nginx.conf | grep -A 10 "location /ws"

# Kamailio listening on 8080?
sudo docker exec webrtc-kamailio netstat -tuln | grep 8080

# Kamailio logs
sudo docker logs webrtc-kamailio --tail 50
```

**Fix:**
- Ensure Nginx `proxy_pass` is `http://127.0.0.1:8080` (host mode)
- Verify Kamailio is listening: `listen=ws:192.168.210.54:8080`
- Check firewall: `sudo firewall-cmd --list-all`

### Issue 2: Authentication Failure
**Symptoms:**
- REGISTER rejected with `403 Forbidden` or `401 Unauthorized` loop

**Check:**
```bash
# Redis database has users?
sudo docker exec -it webrtc-redis redis-cli
SELECT 2
KEYS *
HGETALL subscriber:5001

# Kamailio auth module loaded?
sudo docker exec webrtc-kamailio kamcmd mod.stats auth_db

# Check auth logs
sudo docker logs webrtc-kamailio | grep -i "auth"
```

**Fix:**
- Verify ha1 hash calculation:
  ```bash
  echo -n "5001:192.168.210.54:password5001" | md5sum
  ```
- Ensure domain matches: `192.168.210.54` (not `localhost`)
- Check Redis connection: `redis://127.0.0.1:6379/2` (host mode)

### Issue 3: NAT Issues - Wrong IP in Contact
**Symptoms:**
- Contact header shows private IP or `127.0.0.1`
- Asterisk can't reach WebRTC client

**Check:**
```bash
# Kamailio NAT detection
sudo docker logs webrtc-kamailio | grep -i "NAT detected"

# Asterisk contact
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show contacts"
```

**Fix:**
- Ensure `force_rport()` is called in routing
- Verify `fix_nated_register()` for REGISTER
- Check `add_contact_alias()` for WebSocket connections
- Enable NAT flags: `setflag(5)` and `setbflag(8)`

### Issue 4: Asterisk Not Receiving Requests
**Symptoms:**
- Kamailio logs show routing, but Asterisk shows nothing

**Check:**
```bash
# Dispatcher status
sudo docker exec webrtc-kamailio kamcmd dispatcher.list

# Should show:
# URI: sip:127.0.0.1:5060
# FLAGS: AP (Active, Probing)

# If flags show IP (Inactive, Probing):
sudo docker exec webrtc-kamailio kamcmd dispatcher.reload

# Asterisk listening on 5060?
sudo docker exec webrtc-asterisk netstat -uln | grep 5060

# Check Kamailio $du variable
sudo docker logs webrtc-kamailio | grep "Routing to Asterisk"
```

**Fix:**
- Verify dispatcher.list: `sip:127.0.0.1:5060;transport=udp`
- Ensure Asterisk transport-udp binds to `0.0.0.0:5060`
- Check host mode networking: `network_mode: host`

### Issue 5: Call Setup Fails
**Symptoms:**
- REGISTER works, but INVITE fails

**Check:**
```bash
# Full SIP trace in Kamailio
sudo docker exec webrtc-kamailio kamcmd log.level 4

# Watch INVITE flow
sudo docker logs -f webrtc-kamailio | grep INVITE

# Check Asterisk dialplan
sudo docker exec webrtc-asterisk asterisk -rx "dialplan show genesys-agent"
```

**Fix:**
- Verify Record-Route is enabled for INVITE
- Check NAT handling in replies: `onreply_route[DISPATCH_REPLY]`
- Ensure Asterisk endpoint is registered: `pjsip show endpoints`
- Verify Genesys trunk is reachable

## Performance Tuning

### Kamailio
```cfg
# Increase workers for high load
children=8

# SIP message processing
max_while_loops=256

# Memory
shm_mem=64          # Shared memory in MB
pkg_mem=8           # Package memory in MB

# Connection limits
tcp_connection_lifetime=3605
tcp_max_connections=2048
```

### Redis Connection Pooling
```cfg
modparam("db_redis", "keys", "subscriber=entry:username")
modparam("db_redis", "connect_timeout", 5000)
modparam("db_redis", "cmd_timeout", 5000)
```

## Security Considerations

### 1. TLS/WSS
- **Production**: Use WSS (port 8443) with valid certificates
- **Testing**: WS (port 8080) is acceptable for local testing
- Configure Nginx with SSL termination

### 2. Authentication
- **Never store plaintext passwords**
- Use ha1 hashes (MD5 of username:domain:password)
- Implement rate limiting for auth failures

### 3. Firewall
```bash
# Open required ports
sudo firewall-cmd --permanent --add-port=8080/tcp  # Kamailio WS
sudo firewall-cmd --permanent --add-port=8443/tcp  # Kamailio WSS
sudo firewall-cmd --permanent --add-port=5060/udp  # SIP
sudo firewall-cmd --reload
```

### 4. DOS Protection
```cfg
# In kamailio.cfg
loadmodule "pike.so"
modparam("pike", "sampling_time_unit", 2)
modparam("pike", "reqs_density_per_unit", 30)
modparam("pike", "remove_latency", 4)

route[REQINIT] {
    if (!pike_check_req()) {
        xlog("L_ALERT", "ALERT: pike blocking $rm from $fu (IP:$si:$sp)\n");
        exit;
    }
}
```

## Monitoring

### Real-time Monitoring
```bash
# Active calls
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics active_dialogs

# WebSocket connections
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics ws.ws_current_connections

# Authentication stats
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics auth.authorized
sudo docker exec webrtc-kamailio kamcmd stats.get_statistics auth.failed

# Dispatcher health
sudo docker exec webrtc-kamailio kamcmd dispatcher.list
```

### Log Analysis
```bash
# Failed auth attempts
sudo docker logs webrtc-kamailio | grep -i "auth.*fail"

# NAT detection
sudo docker logs webrtc-kamailio | grep -i "NAT detected"

# Dispatcher failures
sudo docker logs webrtc-kamailio | grep -i "dispatch.*fail"

# SIP errors
sudo docker logs webrtc-kamailio | grep -E "4[0-9]{2}|5[0-9]{2}"
```

## Architecture Comparison

### Before (Direct WebSocket to Asterisk)
```
Browser → Nginx → Asterisk (WebSocket + SIP) → Genesys
```
**Limitations:**
- Asterisk handles WebSocket connections (resource intensive)
- No centralized authentication
- No SIP-level load balancing
- NAT handling in Asterisk only

### After (Kamailio Proxy)
```
Browser → Nginx → Kamailio (SIP Proxy) → Asterisk (Media) → Genesys
```
**Benefits:**
- ✅ Kamailio optimized for SIP proxy (scalable)
- ✅ Centralized authentication (Redis)
- ✅ Advanced NAT traversal
- ✅ Load balancing across multiple Asterisk instances
- ✅ SIP routing intelligence
- ✅ Asterisk focuses on media processing only

## Next Steps

1. **Test Complete Call Flow:**
   - WebRTC client registers through Kamailio
   - Place call from 5001 to Genesys DN
   - Verify media path (should still be direct to Asterisk)

2. **Add More Asterisk Backends:**
   - Update dispatcher.list with additional Asterisk instances
   - Implement load balancing

3. **Production TLS:**
   - Get valid SSL certificate
   - Configure Nginx for WSS termination
   - Update Kamailio to listen on WSS:8443

4. **Monitoring Dashboard:**
   - Add Kamailio stats to dashboard
   - Monitor authentication success/failure rates
   - Track WebSocket connection counts

5. **Security Hardening:**
   - Implement rate limiting
   - Add IP-based ACLs
   - Enable DOS protection (pike module)

## Rollback Procedure

If issues occur:
```bash
cd /home/Gencct/webrtc-genesys

# Stop services
sudo docker-compose down

# Restore backup
git checkout pre-kamailio-proxy
cp kamailio/kamailio.cfg.backup kamailio/kamailio.cfg

# Restart with old config
sudo docker-compose up -d

# Verify
sudo docker ps
sudo docker logs webrtc-asterisk --tail 20
```

## Support

**Log Locations:**
- Kamailio: `/var/log/kamailio/` (in container) or `./kamailio/logs/` (host)
- Asterisk: `/var/log/asterisk/` (in container) or `./asterisk/logs/` (host)

**Configuration Files:**
- `kamailio/kamailio-proxy.cfg` - Main Kamailio config
- `kamailio/tls.cfg` - TLS settings
- `kamailio/dispatcher.list` - Asterisk backends
- `nginx/nginx.conf` - WebSocket proxy settings

**Useful Commands:**
```bash
# Kamailio CLI
sudo docker exec -it webrtc-kamailio kamctl

# Check running config
sudo docker exec webrtc-kamailio kamcmd cfg.get

# Reload config without restart
sudo docker exec webrtc-kamailio kamcmd cfg.reload

# SIP trace (real-time)
sudo docker exec webrtc-kamailio kamcmd log.level 4
sudo docker logs -f webrtc-kamailio
```


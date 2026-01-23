# Revert to Kamailio-Based Registration Forwarding

## Overview

This guide explains how to revert from the current **static PJSIP registration** approach back to the original **Kamailio-based registration forwarding** approach.

## Current Architecture (Static PJSIP)

```
Electron App → Nginx (/ws) → Asterisk (port 8088)
                                  ↓
                        Static PJSIP Registration
                                  ↓
                              Genesys
```

## Original Architecture (Kamailio)

```
Electron App → Nginx (/ws) → Kamailio (port 8080)
                                  ↓
                            ┌─────┴─────┐
                            ↓           ↓
                       Asterisk    Genesys
                     (auth only)  (registration)
```

## How Kamailio Worked

### Registration Flow:

1. **WebRTC client sends REGISTER** → Nginx WSS → Kamailio port 8080
2. **Kamailio forwards to Asterisk** (for authentication challenge)
3. **Asterisk sends 401 Unauthorized** with challenge
4. **Client re-sends REGISTER with auth** → Kamailio
5. **Kamailio validates with Asterisk** → Asterisk returns 200 OK
6. **Kamailio then forwards REGISTER to Genesys** using `uac_req_send()`
7. **Result:** Both Asterisk and Genesys have the registration

### Key Code in Kamailio (`kamailio-proxy.cfg`):

```
onreply_route[ASTERISK_REGISTER_REPLY] {
    if (status == "200") {
        # Asterisk accepted REGISTER - now forward to Genesys
        $var(dn) = $fU;
        $var(genesys_uri) = "sip:" + $var(dn) + "@192.168.210.81";
        
        $uac_req(method) = "REGISTER";
        $uac_req(ruri) = $var(genesys_uri);
        
        uac_req_send();  # Send REGISTER to Genesys
    }
}
```

---

## Steps to Revert Back to Kamailio

### 1. Update Nginx Configuration

**Change:** Proxy `/ws` to Kamailio instead of Asterisk

**File:** `nginx/nginx.conf`

**Current (Direct to Asterisk):**
```nginx
location /ws {
    proxy_pass http://192.168.210.54:8088;  # Asterisk WebSocket
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ...
}
```

**Change to (Via Kamailio):**
```nginx
location /ws {
    proxy_pass http://192.168.210.54:8080;  # Kamailio (WebSocket to TCP)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 86400;
    proxy_connect_timeout 60;
    proxy_send_timeout 60;
}
```

### 2. Disable Static PJSIP Registrations

**File:** `asterisk/etc/pjsip.conf`

**Change:**
```ini
[genesys_reg_1002]
type=registration
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81
client_uri=sip:1002@192.168.210.81
contact_user=1002
endpoint=1002
line=yes
retry_interval=0           # Change back to 0 (disable)
forbidden_retry_interval=10
expiration=0               # Change back to 0 (disable)
max_retries=0

[genesys_reg_1003]
type=registration
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81
client_uri=sip:1003@192.168.210.81
contact_user=1003
endpoint=1003
line=yes
retry_interval=0           # Change back to 0 (disable)
forbidden_retry_interval=10
expiration=0               # Change back to 0 (disable)
max_retries=0
```

### 3. Keep Registration Monitor Disabled

**File:** `registration-monitor/registration_monitor.py`

The simplified version is fine - it just logs events. Kamailio handles the actual forwarding.

### 4. Ensure Kamailio is Running

**Check:**
```bash
sudo docker-compose ps kamailio
```

**Start if not running:**
```bash
sudo docker-compose up -d kamailio
```

### 5. Restart Services

```bash
cd /opt/gcti_apps/webrtc-genesys

# Restart Nginx (to apply /ws proxy change)
sudo docker-compose restart nginx

# Restart Asterisk (to disable static PJSIP registrations)
sudo docker-compose restart asterisk

# Ensure Kamailio is running
sudo docker-compose up -d kamailio
```

---

## Verification

### 1. Check Kamailio is Listening on Port 8080
```bash
sudo docker-compose exec kamailio netstat -tlnp | grep 8080
```

Expected: `tcp 0.0.0.0:8080 LISTEN`

### 2. Check Kamailio Logs
```bash
sudo docker-compose logs -f kamailio
```

Expected when Electron app registers:
```
Kamailio: REGISTER from sip:1002@...
Kamailio: Initial REGISTER - forwarding to Asterisk for auth challenge
Kamailio: Asterisk REGISTER reply: 401 Unauthorized
Kamailio: Authenticated REGISTER - validating with Asterisk then forwarding to Genesys
Kamailio: Asterisk REGISTER reply: 200 OK
Kamailio: Asterisk accepted REGISTER - now forwarding to Genesys
Kamailio: Sending REGISTER to Genesys for DN 1002
```

### 3. Check Asterisk Logs
```bash
sudo docker-compose logs asterisk | grep REGISTER
```

Expected: Only authentication messages, NO outbound REGISTER to Genesys

### 4. Check Static PJSIP Registrations are Disabled
```bash
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"
```

Expected: No registrations shown (or shows "Unregistered")

### 5. Test Registration Flow
1. Register DN 1002 via Electron app
2. Check Kamailio logs - should show forwarding to Genesys
3. Check Genesys SIP logs - should show REGISTER from Kamailio (source IP 192.168.210.54)

---

## Advantages of Kamailio Approach

### ✅ Pros:
1. **Dynamic registration forwarding** - Works for ANY DN, no need to pre-configure each DN
2. **Single source of truth** - Kamailio handles all registration logic
3. **Centralized control** - Easy to modify registration behavior without touching Asterisk config
4. **Scalable** - Works for hundreds of DNs without config changes

### ❌ Cons:
1. **Extra component** - One more service to maintain (Kamailio)
2. **Complexity** - More moving parts in the architecture

## Advantages of Static PJSIP Approach (Current)

### ✅ Pros:
1. **Simpler architecture** - One less component (no Kamailio)
2. **Native Asterisk feature** - Uses built-in PJSIP functionality
3. **Reliable** - Asterisk handles re-registration automatically

### ❌ Cons:
1. **Manual configuration** - Each DN needs to be pre-configured in `pjsip.conf`
2. **Not scalable** - Need to add config for each new DN
3. **Static** - Can't dynamically add DNs without restarting Asterisk

---

## Recommendation

### Use **Kamailio** if:
- You need dynamic registration forwarding for many DNs (100+)
- DNs are created/deleted frequently
- You want centralized control over registration logic

### Use **Static PJSIP** if:
- You have a fixed, small number of DNs (< 50)
- DNs rarely change
- You want to minimize complexity (fewer components)

---

## Files to Modify for Revert

1. ✅ `nginx/nginx.conf` - Change `/ws` proxy from port 8088 to 8080
2. ✅ `asterisk/etc/pjsip.conf` - Disable static registrations (expiration=0)
3. ✅ Restart services

That's it! The `registration-monitor` can stay as-is (simplified version) since it's just logging.

---

## Rollback if Issues

If reverting to Kamailio causes problems, you can easily roll back:

```bash
# In nginx/nginx.conf, change back to:
location /ws {
    proxy_pass http://192.168.210.54:8088;  # Back to Asterisk direct
}

# In asterisk/etc/pjsip.conf, re-enable static registrations:
expiration=600
retry_interval=10

# Restart services
sudo docker-compose restart nginx asterisk
```

The changes are minimal and reversible! 🔄

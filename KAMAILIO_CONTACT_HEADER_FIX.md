# Kamailio Contact Header Rewriting Fix

## Problem

After reverting to Kamailio-based registration forwarding, calls were failing with errors like:
- "403 Forbidden" when accessing WWE APIs
- "an error occurred on channel voice" when making calls
- Registration dashboard showed invalid Contact addresses like `84jp7d1i@3tglb5esjoiv.invalid` instead of proper Asterisk addresses

## Root Cause

When WebRTC clients (Electron app) register via JsSIP, they use randomly generated Contact addresses with `.invalid` domains (e.g., `sip:84jp7d1i@3tglb5esjoiv.invalid`). This is normal for WebRTC clients.

**The issue:** Kamailio was **preserving** these invalid Contact addresses when forwarding REGISTER messages to Genesys T-Server. When Genesys tried to route an incoming call to DN 1003, it would try to reach `84jp7d1i@3tglb5esjoiv.invalid`, which is not routable.

### Expected vs Actual Behavior

| Scenario | Expected Contact | Actual (Before Fix) | Result |
|----------|-----------------|---------------------|--------|
| DN 1003 registers via Electron app | `<sip:1003@192.168.210.54:5060>` | `<sip:6cfmsers@cu6so260g0k3.invalid>` | ❌ Calls fail |
| DN 1002 registers via Electron app | `<sip:1002@192.168.210.54:5060>` | `<sip:84jp7d1i@3tglb5esjoiv.invalid>` | ❌ Calls fail |

## Solution

Modified `kamailio/kamailio-proxy.cfg` to **rewrite the Contact header** when forwarding REGISTER messages to Genesys.

### Code Change

**File:** `kamailio/kamailio-proxy.cfg` (lines 463-487)

**Before:**
```kamailio
# Preserve the Contact header from the original REGISTER
$uac_req(hdrs) = "Contact: " + $ct + "\r\n";
```

**After:**
```kamailio
# IMPORTANT: Rewrite Contact to Asterisk server address
# This ensures Genesys routes calls back to Asterisk, not to the invalid WebRTC client address
$var(asterisk_contact) = "<sip:" + $var(dn) + "@192.168.210.54:5060>";

# Use rewritten Contact header pointing to Asterisk
$uac_req(hdrs) = "Contact: " + $var(asterisk_contact) + "\r\n";
```

### How It Works

1. **WebRTC client registers** to Kamailio with Contact: `<sip:84jp7d1i@3tglb5esjoiv.invalid>`
2. **Kamailio validates** the registration with Asterisk (gets 200 OK)
3. **Kamailio rewrites** the Contact header to `<sip:1002@192.168.210.54:5060>`
4. **Kamailio forwards** the modified REGISTER to Genesys T-Server
5. **Genesys stores** the Asterisk address as the Contact
6. **When a call comes in**, Genesys routes it to `192.168.210.54:5060` (Asterisk)
7. **Asterisk knows** where the WebRTC client is (via its own registration table)
8. **Asterisk delivers** the call to the WebRTC client

## Call Flow

### Registration Flow
```
WebRTC Client (Electron)
    |
    | REGISTER (Contact: sip:xyz@invalid)
    v
Nginx (WSS → WS)
    |
    v
Kamailio (Port 8080)
    |
    | 1. Forward to Asterisk for auth
    v
Asterisk (Port 5060)
    |
    | 200 OK (authenticated)
    v
Kamailio
    |
    | 2. Rewrite Contact to sip:1002@192.168.210.54:5060
    | 3. Forward to Genesys
    v
Genesys T-Server (Port 5060)
    |
    | 200 OK (registered)
    v
Stored in Genesys: DN 1002 → Contact: <sip:1002@192.168.210.54:5060>
```

### Incoming Call Flow
```
Genesys T-Server
    |
    | INVITE sip:1003@192.168.210.54:5060 (from Genesys DB)
    v
Asterisk
    |
    | Looks up DN 1003 in local registration table
    | Finds: sip:xyz@192.168.210.54:12345;transport=ws
    |
    | INVITE to WebRTC client via WebSocket
    v
Kamailio (reverse path)
    |
    v
Nginx
    |
    v
WebRTC Client (Electron)
    |
    | Ring! WWE notification appears
    v
```

## Deployment

### On the Server

```bash
# SSH to the server
ssh Gencct@103.167.180.166

# Navigate to project directory
cd /opt/gcti_apps/webrtc-genesys

# Pull the latest code
sudo git pull origin main

# Restart Kamailio to load the new configuration
sudo docker-compose restart kamailio

# Verify Kamailio is running
sudo docker-compose ps kamailio

# Monitor Kamailio logs to see Contact rewriting in action
sudo docker-compose logs -f kamailio
```

### Expected Log Output

When a WebRTC client registers, you should see logs like:

```
kamailio  | REGISTER from "1002" <sip:1002@192.168.210.54> (contact: <sip:84jp7d1i@3tglb5esjoiv.invalid;transport=ws>)
kamailio  | Authenticated REGISTER - validating with Asterisk then forwarding to Genesys
kamailio  | Asterisk accepted REGISTER - now forwarding to Genesys
kamailio  | Sending REGISTER to Genesys for DN 1002 with Contact: <sip:1002@192.168.210.54:5060>
```

### Verify Registration

Check the registration dashboard: http://192.168.210.81:5000

You should now see:
- DN 1002: Contact = `84jp7d1i@3tglb5esjoiv.invalid` ✅ (should now show proper address)
- DN 1003: Contact = `6cfmsers@cu6so260g0k3.invalid` ✅ (should now show proper address)

**Expected after fix:**
- DN 1002: Contact = `1002@192.168.210.54:5060` ✅
- DN 1003: Contact = `1003@192.168.210.54:5060` ✅

## Testing

### Test Registration
1. Open Electron app
2. Login with DN 1002
3. Check dashboard - should show Contact: `1002@192.168.210.54:5060`

### Test Incoming Calls
1. Register DN 1002 via Electron app
2. Register DN 1003 via WWE (browser)
3. From DN 1003, call 1002
4. **Expected:** DN 1002 should receive the call and WWE should show the incoming call notification

### Test Outgoing Calls
1. Register DN 1002 via Electron app
2. Register DN 1003 via Electron app
3. From DN 1002, call 1003
4. **Expected:** Call should be established, both sides can hear each other

## Troubleshooting

### Contact addresses still showing invalid domains

**Check:**
```bash
# Verify Kamailio restarted with new config
sudo docker-compose ps kamailio

# Check Kamailio logs for Contact rewriting
sudo docker-compose logs kamailio | grep "Contact:"
```

**Solution:** Restart Kamailio:
```bash
sudo docker-compose restart kamailio
```

### Calls still failing

**Check:**
1. Verify Asterisk can reach Genesys:
```bash
sudo docker-compose exec asterisk asterisk -rx "pjsip send notify"
```

2. Check Asterisk logs for incoming INVITE:
```bash
sudo docker-compose logs asterisk | grep INVITE
```

3. Verify WWE is receiving call notifications:
   - Open browser DevTools → Network tab
   - Look for `/api/v1/notifications` WebSocket messages

### 403 Forbidden on WWE login

This is likely a Genesys permission issue, not related to Contact header rewriting. The user needs proper WWE access permissions configured in Genesys Administrator.

## Related Files

- `kamailio/kamailio-proxy.cfg` - Main Kamailio configuration with Contact rewriting
- `nginx/nginx.conf` - Nginx reverse proxy (WSS → WS)
- `asterisk/etc/pjsip.conf` - Asterisk SIP endpoints
- `REVERT_TO_KAMAILIO_REGISTRATION.md` - Guide for reverting to Kamailio registration
- `scripts/revert-to-kamailio.sh` - Automated revert script

## Technical Details

### Why WebRTC Clients Use Invalid Contact Addresses

JsSIP (and most WebRTC libraries) generate random Contact addresses with `.invalid` TLD because:
1. WebRTC clients don't have static IP addresses
2. They connect via WebSocket, which is not a SIP transport
3. The Contact address is meant to be opaque - only the proxy (Kamailio/Asterisk) knows how to reach the client

### Why We Need to Rewrite Contact

In a typical WebRTC setup:
- **SIP Proxy** maintains the mapping: Client ID → WebSocket connection
- **Backend SIP Server** (Genesys) doesn't need to know about WebSocket
- **Contact header** should point to a routable SIP address (Asterisk)

Without Contact rewriting:
- Genesys stores: DN 1002 → `sip:xyz@invalid`
- When calling 1002, Genesys tries to reach `sip:xyz@invalid` → **FAILS**

With Contact rewriting:
- Genesys stores: DN 1002 → `sip:1002@192.168.210.54:5060`
- When calling 1002, Genesys reaches Asterisk → Asterisk forwards to WebSocket → **SUCCESS**

## Version History

- **2026-01-23**: Initial fix - Contact header rewriting for Kamailio registration forwarding
- **Commit**: `1f9f30b` - Fix Contact header rewriting in Kamailio registration forwarding

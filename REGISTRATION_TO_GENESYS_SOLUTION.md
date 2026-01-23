# Registration to Genesys Solution

## Problem
DNs registered via the Electron app to Asterisk were not being forwarded to Genesys SIP Server, causing "Invalid Called DN" errors when trying to make calls.

## Root Cause Analysis
1. **Nginx `/ws` proxy bypasses Kamailio**: The Nginx configuration was proxying WebSocket traffic directly to Asterisk (port 8088), bypassing Kamailio, so Kamailio-based registration forwarding wasn't working.

2. **`registration-monitor` issues**:
   - Was explicitly disabled from forwarding registrations to Genesys
   - DN range was set to `5001-5020`, excluding DNs `1002` and `1003`
   - Used incorrect AMI action (`PJSIPOutboundRegistration` doesn't exist)
   - Later used `ModuleReload` which caused unstable unregister/re-register cycles

3. **Static PJSIP registrations disabled**: The PJSIP registrations for DNs 1002 and 1003 in `pjsip.conf` had `expiration=0`, which disabled them.

## Solution

### 1. Enable Static PJSIP Registrations (`asterisk/etc/pjsip.conf`)
```ini
[genesys_reg_1002]
type=registration
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81
client_uri=sip:1002@192.168.210.81
contact_user=1002
endpoint=1002
line=yes
retry_interval=10      # Changed from 0
forbidden_retry_interval=10
expiration=600         # Changed from 0 (disabled) to 600 seconds
max_retries=0

[genesys_reg_1003]
type=registration
outbound_auth=genesys_auth
server_uri=sip:192.168.210.81
client_uri=sip:1003@192.168.210.81
contact_user=1003
endpoint=1003
line=yes
retry_interval=10      # Changed from 0
forbidden_retry_interval=10
expiration=600         # Changed from 0 (disabled) to 600 seconds
max_retries=0
```

**What this does:**
- Asterisk automatically sends REGISTER messages to Genesys SIP Server for DNs 1002 and 1003
- Re-registers every 600 seconds (10 minutes) to keep the registration alive
- Retries every 10 seconds if registration fails

### 2. Expand DN Range in `registration-monitor` (`docker-compose.yml`)
```yaml
registration-monitor:
  environment:
    - DN_RANGE_START=1000  # Changed from 5001
    - DN_RANGE_END=5020    # Unchanged
```

**What this does:**
- Monitors all DNs from 1000-5020, including 1002 and 1003

### 3. Simplify `registration-monitor` (`registration-monitor/registration_monitor.py`)

**Changes:**
- Removed `ModuleReload` logic that was causing unregister/re-register cycles
- Removed startup unregistration that interfered with static registrations
- Monitor now just tracks registration state for logging purposes

**What this does:**
- The monitor passively observes registration events
- Static PJSIP registrations in `pjsip.conf` handle the actual REGISTER messages to Genesys
- No more unstable registration cycles

### 4. Route Calls Through Genesys T-Server (`asterisk/etc/extensions-sip-endpoint.conf`)
```
[genesys-agent]
; All calls from agents go through Genesys T-Server
exten => _1XXX,1,NoOp(Agent ${CALLERID(num)} calling ${EXTEN} via Genesys)
 same => n,Set(CALLERID(name)=Agent ${CALLERID(num)})
 same => n,Dial(PJSIP/${EXTEN}@genesys_sip_server,300)
 same => n,Hangup()

exten => _5XXX,1,NoOp(Agent ${CALLERID(num)} calling ${EXTEN} via Genesys)
 same => n,Set(CALLERID(name)=Agent ${CALLERID(num)})
 same => n,Dial(PJSIP/${EXTEN}@genesys_sip_server,300)
 same => n,Hangup()
```

**What this does:**
- Forces all calls to go through Genesys T-Server
- Allows WWE to receive incoming call notifications
- Enables full call control and monitoring

## How It Works

```
┌─────────────────┐
│  Electron App   │
│  (DN 1002)      │
└────────┬────────┘
         │ WSS (wss://103.167.180.166:8443/ws)
         │
         ▼
┌─────────────────┐
│     Nginx       │
│   (Port 8443)   │
└────────┬────────┘
         │ Proxy to http://192.168.210.54:8088
         │
         ▼
┌─────────────────┐
│    Asterisk     │◄─────────────┐
│  (PJSIP Server) │              │
└────────┬────────┘              │
         │                        │
         │ Static PJSIP           │ AMI Events
         │ Registration           │
         │                        │
         ▼                        │
┌─────────────────┐      ┌───────┴──────┐
│ Genesys SIP     │      │ registration-│
│ Server (T-Server)│      │   monitor    │
└─────────────────┘      └──────────────┘
         │
         │ Route call back to Asterisk
         │
         ▼
┌─────────────────┐
│    Asterisk     │
│ (DN 1003 rings) │
└─────────────────┘
```

## Testing on Server

### 1. Pull Latest Code
```bash
cd /opt/gcti_apps/webrtc-genesys
sudo git fetch origin
sudo git reset --hard origin/main
```

### 2. Restart Services
```bash
# Restart Asterisk to apply pjsip.conf changes
sudo docker-compose restart asterisk

# Restart registration-monitor to apply DN range and code changes
sudo docker-compose restart registration-monitor
```

### 3. Verify Static PJSIP Registrations
```bash
# Check if outbound registrations are configured
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"

# Expected output should show:
# genesys_reg_1002 - Registered (or Registered/Authenticating)
# genesys_reg_1003 - Registered (or Registered/Authenticating)
```

### 4. Check Registration Monitor Logs
```bash
sudo docker-compose logs -f registration-monitor

# Expected output:
# - No more "Connect call failed" errors
# - Should show "Connected to Asterisk AMI"
# - Should show registration events for DNs 1002/1003
# - No more duplicate unregistration messages
```

### 5. Check Asterisk Logs
```bash
sudo docker-compose logs -f asterisk | grep -i register

# Expected output:
# - REGISTER messages being sent to 192.168.210.81 (Genesys)
# - 200 OK responses from Genesys
```

### 6. Test Call Flow
1. **Register DN 1002** via Electron app
2. **Register DN 1003** via Electron app
3. **From DN 1002**, call **1003**
4. **Expected behavior**:
   - Call routes through Genesys T-Server
   - DN 1003 receives incoming call notification in WWE
   - DN 1003 can answer the call
   - Call establishes successfully

### 7. Verify in Genesys SIP Logs
Check the Genesys SIP log file for:
```
REGISTER sip:192.168.210.81 SIP/2.0
From: <sip:1002@192.168.210.81>
Contact: <sip:1002@192.168.210.54:5060>

SIP/2.0 200 OK
```

This confirms Asterisk is successfully registering DNs to Genesys.

## Expected Results

### ✅ Registrations Working
- DNs 1002 and 1003 register to Asterisk via Electron app (WebSocket)
- Asterisk automatically forwards registrations to Genesys via static PJSIP registrations
- Genesys shows DNs as "Active" with `deviceState: "Active"`

### ✅ Calls Working
- Agent on DN 1002 can call DN 1003
- Call routes through Genesys T-Server
- WWE receives incoming call notification for DN 1003
- Agent on DN 1003 can answer and establish the call

### ✅ No More Errors
- No "Invalid Called DN" errors
- No AMI connection failures in `registration-monitor`
- No unstable registration cycles (unregister/re-register)
- No "Device not registered" messages in WWE

## Key Takeaways

1. **Static PJSIP registrations** in `pjsip.conf` are the correct way to forward registrations to Genesys
2. **`registration-monitor`** should passively observe, not actively interfere
3. **Routing through Genesys T-Server** is essential for WWE to receive call notifications
4. **DN range configuration** must include all monitored DNs

## Files Modified

1. `asterisk/etc/pjsip.conf` - Enabled static registrations for DNs 1002 and 1003
2. `docker-compose.yml` - Expanded DN range to 1000-5020
3. `registration-monitor/registration_monitor.py` - Simplified to passive monitoring
4. `asterisk/etc/extensions-sip-endpoint.conf` - Route all calls through Genesys T-Server

## Git Commits

1. `ff3d6e2` - Enable static PJSIP outbound registrations for DNs 1002 and 1003
2. `18c9801` - Expand registration-monitor DN range to 1000-5020
3. `377cd15` - Simplify registration-monitor to rely on static PJSIP registrations

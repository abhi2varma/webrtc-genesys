# How Asterisk Connects to Genesys SIP Server

## Overview

**Yes, Asterisk will connect to your Genesys SIP Server** at `10.78.3.90:5060`. Here's how it works:

---

## Connection Methods

Asterisk uses **TWO** connection methods to Genesys:

### 1. **Direct SIP Endpoint** (For Call Signaling)
- **Purpose**: Send/receive SIP messages for calls
- **Type**: SIP Endpoint (not registration)
- **Protocol**: UDP on port 5060
- **Configuration**: `[genesys_sip_server]` in `pjsip.conf`

### 2. **Registration** (Optional - For Gateway Registration)
- **Purpose**: Register Asterisk itself as a gateway endpoint
- **Type**: SIP Registration
- **Configuration**: `[registration]` block in `pjsip.conf`

---

## Current Configuration Analysis

### ✅ What's Configured:

#### 1. Genesys SIP Server Endpoint (Lines 38-71)
```ini
[genesys_sip_server]
type=endpoint
context=from-genesys
transport=transport-udp
aors=genesys_sip_server
outbound_auth=genesys_auth
...
```

**This creates a SIP trunk to Genesys:**
- **Outbound calls**: Agent → Asterisk → Genesys SIP Server
- **Inbound calls**: Genesys SIP Server → Asterisk → Agent
- **Authentication**: Uses `genesys_auth` (username/password)

#### 2. Agent DNs with Outbound Proxy (Line 102)
```ini
[agent_dn](!)
...
outbound_proxy=sip:${GENESYS_SIP_HOST}:${GENESYS_SIP_PORT}
```

**This means:**
- When Agent 5001 makes a call, Asterisk forwards it to Genesys
- All agent calls go through Genesys SIP Server

#### 3. Registration Block (Lines 369-376)
```ini
[registration]
type=registration
transport=transport-udp
outbound_proxy=sip:${GENESYS_SIP_HOST}:${GENESYS_SIP_PORT}
server_uri=sip:${GENESYS_SIP_HOST}
client_uri=sip:asterisk-gateway@${GENESYS_SIP_HOST}
outbound_auth=genesys_auth
retry_interval=60
```

**This registers Asterisk as a gateway:**
- Asterisk identifies itself as `asterisk-gateway@10.78.3.90`
- Uses the same credentials as the endpoint
- Retries every 60 seconds if registration fails

---

## Connection Flow

### Scenario 1: Agent Makes Outbound Call

```
1. Agent (Browser) 
   └─> WSS → Asterisk (port 8089)
   
2. Asterisk receives SIP INVITE from Agent 5001
   
3. Asterisk forwards to Genesys:
   └─> SIP INVITE → 10.78.3.90:5060 (UDP)
   └─> Uses: outbound_proxy + genesys_auth
   
4. Genesys SIP Server processes call
   └─> Routes to PSTN or internal destination
   
5. RTP Media flows:
   Agent ←→ Asterisk ←→ Genesys ←→ Destination
```

### Scenario 2: Inbound Call to Agent

```
1. Genesys SIP Server receives call
   
2. Genesys sends SIP INVITE to Asterisk:
   └─> SIP INVITE → Asterisk:5060
   └─> To: Agent DN (e.g., 5001)
   
3. Asterisk receives on context "from-genesys"
   
4. Asterisk forwards to Agent:
   └─> WSS → Agent Browser
   
5. RTP Media flows:
   Caller ←→ Genesys ←→ Asterisk ←→ Agent
```

### Scenario 3: Registration (If Enabled)

```
1. Asterisk starts up
   
2. Asterisk sends SIP REGISTER:
   └─> REGISTER sip:10.78.3.90
   └─> From: asterisk-gateway@10.78.3.90
   └─> Auth: genesys_auth credentials
   
3. Genesys SIP Server responds:
   └─> 200 OK (if credentials valid)
   └─> 401/403 (if invalid)
   
4. Asterisk refreshes registration every 60 seconds
```

---

## What Needs to be Configured

### ⚠️ Current Status: Placeholders Need Replacement

Your `pjsip.conf` has these placeholders that **MUST** be replaced:

| Placeholder | Replace With | Location |
|------------|--------------|----------|
| `${GENESYS_SIP_HOST}` | `10.78.3.90` | Lines 59, 71, 102, 372, 373, 374 |
| `${GENESYS_SIP_PORT}` | `5060` | Lines 59, 102, 372 |
| `${GENESYS_USERNAME}` | Your Genesys username | Line 65 |
| `${GENESYS_PASSWORD}` | Your Genesys password | Line 66 |
| `${PUBLIC_IP}` | Your Asterisk server IP | Lines 31, 32 |

### Example After Replacement:

```ini
; Line 31-32
external_media_address=192.168.18.192
external_signaling_address=192.168.18.192

; Line 59
contact=sip:10.78.3.90:5060

; Line 65-66
username=your-genesys-username
password=your-genesys-password

; Line 71
match=10.78.3.90

; Line 102
outbound_proxy=sip:10.78.3.90:5060

; Lines 372-374
outbound_proxy=sip:10.78.3.90:5060
server_uri=sip:10.78.3.90
client_uri=sip:asterisk-gateway@10.78.3.90
```

---

## Will It Connect?

### ✅ YES, if:

1. **Placeholders are replaced** with actual values
2. **Network connectivity** exists:
   - Asterisk can reach `10.78.3.90:5060` (UDP)
   - Firewall allows outbound SIP (port 5060)
   - Firewall allows RTP (ports 10000-20000)
3. **Credentials are correct**:
   - Genesys username/password are valid
   - Genesys SIP Server accepts connections from your Asterisk IP
4. **Genesys is configured** to accept:
   - SIP connections from your Asterisk IP
   - The agent DNs (5001-5020) as valid endpoints

### ❌ NO, if:

- Placeholders not replaced (Asterisk won't know where to connect)
- Network blocked (firewall, routing issues)
- Wrong credentials (401/403 errors)
- Genesys not configured to accept your Asterisk as a SIP endpoint

---

## Testing the Connection

### Step 1: Check Configuration
```bash
# After replacing placeholders, verify:
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_sip_server"
```

### Step 2: Check Registration Status
```bash
# If registration is enabled:
docker exec -it webrtc-asterisk asterisk -rx "pjsip show registrations"
```

### Step 3: Monitor SIP Traffic
```bash
# Enable SIP logging:
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"

# Watch logs:
docker logs -f webrtc-asterisk
```

### Step 4: Test Connectivity
```bash
# From Asterisk server, test network:
ping 10.78.3.90

# Test SIP port (if telnet/nc available):
telnet 10.78.3.90 5060
```

---

## Important Notes

### Registration vs. Direct Connection

**Option A: With Registration** (Current config)
- Asterisk registers itself as `asterisk-gateway@10.78.3.90`
- Genesys knows Asterisk as a registered endpoint
- Useful if Genesys requires registration

**Option B: Without Registration** (Just endpoint)
- Asterisk connects directly for calls only
- No registration needed
- Genesys must allow connections from your IP

**Your configuration supports BOTH**, but registration is optional. The endpoint connection is what matters for calls.

### Authentication

The `genesys_auth` block provides:
- **Username**: For SIP authentication
- **Password**: For SIP authentication
- Used for both endpoint and registration

**Make sure these match your Genesys SIP Server credentials!**

---

## Summary

**Yes, Asterisk will connect to your SIP server** (`10.78.3.90:5060`) once:

1. ✅ Replace `${GENESYS_SIP_HOST}` → `10.78.3.90`
2. ✅ Replace `${GENESYS_SIP_PORT}` → `5060`
3. ✅ Replace `${GENESYS_USERNAME}` → Your username
4. ✅ Replace `${GENESYS_PASSWORD}` → Your password
5. ✅ Replace `${PUBLIC_IP}` → Your Asterisk server IP
6. ✅ Network allows connection
7. ✅ Genesys accepts your Asterisk as a SIP endpoint

The connection will be:
- **For calls**: Always active (endpoint-based)
- **For registration**: Active if registration succeeds (optional)

---

## Next Steps

1. **Replace placeholders** in `pjsip.conf`
2. **Start Asterisk** and check logs
3. **Verify connection** using the test commands above
4. **Test a call** from an agent to verify end-to-end flow


# Genesys Static Routing Configuration for Asterisk Gateway

## 🎯 Overview

Since Asterisk doesn't support **dynamic outbound registration** (registering DNs only when WebRTC clients connect), we use **static routing** instead.

### Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│  WebRTC Client  │        │     Asterisk     │        │  Genesys SIP    │
│   (DN 5001)     │◄──────►│     Gateway      │◄──────►│     Server      │
└─────────────────┘        └──────────────────┘        └─────────────────┘
        │                          │                            │
        │ 1. REGISTER              │                            │
        │    (WebSocket)           │                            │
        │─────────────────────────►│                            │
        │                          │                            │
        │    200 OK                │                            │
        │◄─────────────────────────│                            │
        │                          │                            │
        │                          │                            │
        │                      2. Genesys routes call to       │
        │                         DN 5001 (static config)      │
        │                          │                            │
        │                   INVITE sip:5001@192.168.210.54     │
        │                          │◄───────────────────────────│
        │                          │                            │
        │                   3. Check: Is 5001 registered?      │
        │                      ✅ Yes → Forward to WebSocket   │
        │                      ❌ No → Return 480               │
        │                          │                            │
        │    INVITE                │        200 OK / 480        │
        │◄─────────────────────────│───────────────────────────►│
        │                          │                            │
```

---

## 🔧 Configuration Steps

### Step 1: Configure Genesys SIP Trunk

In **Genesys Configuration Manager (GAX/CME)**:

#### 1.1 Create Switch Object

```yaml
Switch Configuration:
  Name: Asterisk_WebRTC_Gateway
  Type: SIP Switch
  State: Enabled
  
Connection Tab:
  SIP Server:
    - Host: 192.168.210.54
    - Port: 5060
    - Transport: UDP
  
Advanced Tab:
  Contact: sip:192.168.210.54:5060;transport=udp
  Capacity: 480
  OOS Check: 60
  Recovery Timeout: 5
  
SIP Options:
  ☑ reuse-sdp-on-reinvite=true
  ☑ refer-enabled=false
  ☑ make-call-rfc3725-flow=1
```

#### 1.2 Create DN Objects

For **each DN** (5001-5020), create a DN object:

```yaml
DN Configuration:
  Number: 5001
  Switch: Asterisk_WebRTC_Gateway
  Type: Extension
  State: Enabled
  
Advanced:
  DN Type: WebRTC_Agent
  Login Code: 5001 (for agent login)
```

**Repeat for DNs 5002-5020.**

---

### Step 2: Configure Routing Rules

#### 2.1 Create DN Group (Optional but Recommended)

```yaml
DN Group:
  Name: WebRTC_Agents
  Description: Asterisk WebRTC Gateway Agents
  Members: 5001, 5002, 5003, ..., 5020
```

#### 2.2 Configure Routing

In **Routing Strategy**:

```yaml
Routing Rule:
  Description: Route to WebRTC Agents via Asterisk
  
  Condition:
    Target DN: 5001-5020
    
  Action:
    Route to: Asterisk_WebRTC_Gateway
    DN: ${TargetDN}
```

---

### Step 3: Configure Asterisk Dialplan

The dialplan in `extensions-sip-endpoint.conf` already handles this:

```ini
[from-genesys]
; Incoming calls from Genesys to agent DNs

; Route to agent DN (5001-5020)
exten => _50XX,1,NoOp(Incoming call from Genesys to DN ${EXTEN})
same => n,Set(PJSIP_DIAL_CONTACTS=1)
same => n,Dial(PJSIP/${EXTEN},30)
same => n,Hangup()
```

**What happens:**

1. **Call from Genesys:** `INVITE sip:5001@192.168.210.54`
2. **Asterisk receives:** Routes to context `from-genesys`
3. **Extension matched:** `_50XX` matches DN 5001
4. **Check registration:** `Dial(PJSIP/5001)` checks if DN 5001 is registered
5. **Outcomes:**
   - ✅ **DN registered:** Forwards call to WebRTC client via WebSocket
   - ❌ **DN not registered:** Returns `480 Temporarily Unavailable` to Genesys

---

## 📋 Call Flow Examples

### Scenario 1: WebRTC Client Registered

```
1. WebRTC Client (DN 5001) → Asterisk
   REGISTER sip:5001@192.168.210.54:8088 (WebSocket)
   ✅ Asterisk stores: "5001 is available at WebSocket connection ABC"

2. Customer calls contact center → Genesys routes to DN 5001

3. Genesys → Asterisk
   INVITE sip:5001@192.168.210.54:5060
   
4. Asterisk checks: "Is 5001 registered?"
   ✅ Yes → Forwards INVITE to WebSocket connection ABC
   
5. WebRTC client rings
   
6. Agent answers → Call established
```

### Scenario 2: WebRTC Client NOT Registered

```
1. WebRTC Client (DN 5001) is offline/disconnected

2. Customer calls contact center → Genesys routes to DN 5001

3. Genesys → Asterisk
   INVITE sip:5001@192.168.210.54:5060
   
4. Asterisk checks: "Is 5001 registered?"
   ❌ No → Cannot forward
   
5. Asterisk → Genesys
   SIP/2.0 480 Temporarily Unavailable
   
6. Genesys routing:
   - Overflow to next available agent
   - Or play busy tone
   - Or route to voicemail
```

---

## ✅ Verification Steps

### 1. Verify Asterisk Gateway from Genesys

From Genesys SIP Server logs:

```bash
# Send OPTIONS ping to Asterisk
OPTIONS sip:192.168.210.54:5060 SIP/2.0

# Expected response:
SIP/2.0 200 OK
User-Agent: Asterisk-Genesys-Gateway
```

**Verify:**
```bash
# On CentOS (Asterisk)
docker logs webrtc-asterisk | grep "OPTIONS from 192.168.210.81"

# Should see:
# [Dec 15 10:30:45] Received OPTIONS from 192.168.210.81:5060
# [Dec 15 10:30:45] Sending 200 OK
```

---

### 2. Test DN Registration (WebRTC Client → Asterisk)

```bash
# On CentOS (Asterisk)
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints" | grep 5001

# Expected (when registered):
5001/5001      Not in use     0 of inf
     InAuth:  5001-auth/5001
     Aor:  5001            1
     Contact:  5001/sip:xyz@10.81.0.4:62095  Unknown   nan

# Expected (when NOT registered):
5001/5001      Unavailable    0 of inf
     InAuth:  5001-auth/5001
     Aor:  5001            0
```

**Key indicator:** `Aor: 5001            1` ← This "1" means DN 5001 is registered!

---

### 3. Test Call from Genesys to DN 5001

#### Preparation:
1. **Register WebRTC client** (DN 5001) to Asterisk
2. **Verify registration** using command above

#### Test Call:
```bash
# From any Genesys phone or SIP client, dial: 5001
```

**Expected:**
```
1. Genesys routes call to Asterisk trunk
2. Asterisk receives: INVITE sip:5001@192.168.210.54
3. Asterisk checks: Is 5001 registered? ✅ Yes
4. Asterisk forwards to WebSocket
5. WebRTC client rings
6. Agent answers → Call connected
```

**Check Asterisk logs:**
```bash
docker logs -f webrtc-asterisk | grep "5001"

# Should see:
# [Dec 15 10:35:12] Received INVITE from 192.168.210.81 for sip:5001@192.168.210.54
# [Dec 15 10:35:12] Forwarding to endpoint 5001 (WebSocket)
# [Dec 15 10:35:15] Call answered by 5001
```

---

### 4. Test Call When DN is Offline

#### Preparation:
1. **Disconnect WebRTC client** (DN 5001)
2. **Verify NOT registered:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints" | grep 5001
   # Should show: Aor: 5001            0  ← Zero contacts
   ```

#### Test Call:
```bash
# From any Genesys phone, dial: 5001
```

**Expected:**
```
1. Genesys routes call to Asterisk trunk
2. Asterisk receives: INVITE sip:5001@192.168.210.54
3. Asterisk checks: Is 5001 registered? ❌ No
4. Asterisk responds: 480 Temporarily Unavailable
5. Genesys: "The number you dialed is not available"
```

**Check Asterisk logs:**
```bash
docker logs -f webrtc-asterisk | grep "5001"

# Should see:
# [Dec 15 10:40:12] Received INVITE from 192.168.210.81 for sip:5001@192.168.210.54
# [Dec 15 10:40:12] No contacts for endpoint 5001
# [Dec 15 10:40:12] Sending 480 Temporarily Unavailable to 192.168.210.81
```

---

## 🎯 Why This Approach Works

### Traditional (Not Possible with Asterisk):
```
❌ Dynamic Registration:
   WebRTC → Asterisk: REGISTER 5001
   Asterisk → Genesys: REGISTER 5001 (automatically)
   
Problem: Asterisk doesn't support this natively
```

### Our Approach (Static Routing):
```
✅ Static Routing + Local Registration Check:
   1. WebRTC → Asterisk: REGISTER 5001
      (Asterisk stores: "5001 is online")
   
   2. Genesys: Call to 5001 always routes to Asterisk (static config)
   
   3. Asterisk: Checks local registration status
      - If online → Forward
      - If offline → Reject (480)
```

**Benefits:**
- ✅ **Simple configuration:** No dynamic SIP registration needed
- ✅ **Reliable:** Genesys always knows where to route (Asterisk trunk)
- ✅ **Scalable:** Asterisk handles availability (registered/not registered)
- ✅ **Fast failover:** If DN offline, Asterisk rejects immediately
- ✅ **No registration delays:** Call routing instant

---

## 🐛 Troubleshooting

### Issue 1: Calls Not Reaching Asterisk

**Symptoms:**
- Call to DN 5001 fails at Genesys
- No INVITE seen in Asterisk logs

**Check:**
1. **Verify trunk status in Genesys:**
   ```
   GAX → Configuration → Switches → Asterisk_WebRTC_Gateway
   Status: Should be "In Service"
   ```

2. **Test OPTIONS ping:**
   ```bash
   # From Genesys SIP Server
   sip-send OPTIONS 192.168.210.54:5060
   ```

3. **Check Asterisk reachability:**
   ```bash
   # From Genesys server
   telnet 192.168.210.54 5060
   ```

**Fix:**
- Check firewall on CentOS (port 5060/UDP)
- Verify Asterisk is running: `docker ps | grep asterisk`

---

### Issue 2: Asterisk Rejects All Calls (403 Forbidden)

**Symptoms:**
- Asterisk receives INVITE
- Responds with 403 Forbidden

**Check:**
```bash
# Check pjsip.conf identify section
docker exec -it webrtc-asterisk grep -A 5 "genesys-identify" /etc/asterisk/pjsip.conf
```

**Should show:**
```ini
[genesys-identify]
type=identify
endpoint=genesys_sip_server
match=192.168.210.81
```

**Fix:** Verify `match=` IP matches Genesys SIP Server IP exactly.

---

### Issue 3: Calls Forwarded but WebRTC Client Doesn't Ring

**Symptoms:**
- Asterisk receives INVITE from Genesys ✅
- Asterisk forwards to DN 5001 ✅
- WebRTC client doesn't ring ❌

**Check:**
1. **Verify DN is registered:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "pjsip show contacts"
   # Should show: 5001/sip:xxx@10.81.0.4:xxxx
   ```

2. **Check WebSocket connection:**
   ```bash
   docker exec -it webrtc-asterisk asterisk -rx "http show status"
   # Should show active WebSocket sessions
   ```

3. **Check browser console:** Should show `Incoming call from...`

**Fix:**
- Verify WebRTC client is registered (not disconnected)
- Check browser WebSocket connection: `ws://192.168.210.54:8088/ws`
- Check audio permissions in browser

---

## 📊 Summary Comparison

| Feature | Dynamic Registration | Static Routing (Our Approach) |
|---------|---------------------|--------------------------------|
| Asterisk registers DNs to Genesys | ✅ Yes | ❌ No |
| Genesys sees DN status in real-time | ✅ Yes | ❌ No (always routes to Asterisk) |
| Asterisk checks DN availability | N/A | ✅ Yes (locally) |
| Configuration complexity | High | Low |
| Asterisk support | ❌ No native support | ✅ Fully supported |
| Call routing speed | Fast | Fast |
| Failover handling | Genesys-level | Asterisk-level (immediate) |
| Scalability | Good | Excellent |

**Verdict:** **Static Routing is the recommended approach** for Asterisk-Genesys integration.

---

## 🚀 Deployment

### Current Configuration Status:

✅ **Asterisk:** Configured for static routing  
✅ **DNs 5001-5020:** Configured in `pjsip.conf`  
✅ **Dialplan:** Routes incoming calls to registered DNs  
✅ **Genesys trunk:** Defined (`Asterisk_WebRTC_Gateway`)  

### Pending Configuration:

⏳ **Genesys Configuration Manager (GAX/CME):**
   1. Create Switch: `Asterisk_WebRTC_Gateway` (192.168.210.54:5060)
   2. Create DNs: 5001-5020 pointing to this switch
   3. Create routing rule: Route calls to these DNs via the switch

---

## 📞 Contact

For Genesys Configuration Manager setup, you'll need:
- Access to GAX/CME web interface
- Configuration Server admin credentials
- Permission to create Switch and DN objects

If you need assistance with Genesys configuration, please provide:
1. GAX/CME URL
2. Current switch configuration (if any)
3. Existing DN range

---

**Next Step:** Configure Genesys Configuration Manager with the settings above! 🎯


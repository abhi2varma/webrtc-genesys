# Corrected Auto-Answer Mechanism Analysis

## User's Insight: Auto-Answer is Agent/Call-Specific, Not SIP Endpoint Setting

You are **absolutely correct**! The auto-answer functionality is **NOT** configured in the SIP endpoint's SetOptions. Instead, it's controlled by:

1. **Agent-level configuration** in Genesys
2. **Call-specific attached data** (specifically the `BusinessCall` flag)

## Evidence from Logs

### SIP Endpoint Configuration Shows auto_answer = "0"

```javascript
// From SetOptions call
"policy.session.auto_answer": "0"  // ← Disabled at SIP endpoint level

// From Genesys Softphone config
auto_answer = "0"                  // ← Disabled in endpoint config
auto_answer_delay = "0"
```

### But WWE Still Auto-Answers!

```javascript
// Line 5947 in logs.txt
2026-01-27 04:45:54.538 [DEBUG] [WWE.Voice.MediaVoiceExtension] 'voice.auto-answer' is true
2026-01-27 04:45:54.539 [DEBUG] [WWE.Voice.InteractionVoice] answer()
```

**Question**: If `auto_answer = "0"` in the endpoint config, why does WWE auto-answer?

## The Real Trigger: BusinessCall Flag in Call Extensions

### Call Data from T-Server (Line 5920-5928)

```json
{
  "phoneNumber": "1002",
  "extensions": {
    "NO_ANSWER_ACTION": "notready",
    "BusinessCall": 1,              ← THIS IS THE KEY!
    "OriginationDN": "1003",
    "OriginationDN_location": "SIP_Switch",
    "NO_ANSWER_TIMEOUT": 15,
    "NO_ANSWER_OVERFLOW": "recall"
  }
}
```

### Pattern in Logs

- **`"BusinessCall": 1`** → WWE auto-answers (lines 5923, 6109, 8812, 14200, 15077)
- **`"BusinessCall": 0`** → WWE does NOT auto-answer (lines 8483, 13871)

## How It Works: Agent-Based Auto-Answer

### Step 1: Agent Configuration in Genesys

In Genesys Administrator (GAX) or Configuration Manager, agents have settings:

```
Agent Properties → Voice → Auto-Answer Settings
├─ Auto-Answer for Business Calls: Enabled/Disabled
├─ Auto-Answer for Internal Calls: Enabled/Disabled
├─ Auto-Answer Delay: X seconds
└─ Auto-Answer Conditions: Based on call type
```

### Step 2: T-Server Sends Call with BusinessCall Flag

When a call is routed to an agent:

1. T-Server checks the agent's configuration
2. T-Server determines if this is a "business call" (routed call, not direct dial)
3. T-Server sets `BusinessCall: 1` in the call's attached data/extensions
4. This data is sent to WWE via Workspace API

### Step 3: WWE Interprets BusinessCall Flag

```javascript
// WWE's logic (pseudo-code based on log behavior)
function onCallReceived(call) {
  const isBusinessCall = call.extensions.BusinessCall === 1;
  const agentHasAutoAnswer = getAgentSetting('voice.auto-answer');
  
  if (isBusinessCall && agentHasAutoAnswer) {
    // Auto-answer the call
    this.answer();
  } else {
    // Just ring
    this.ring();
  }
}
```

### Step 4: WWE Sends Answer to T-Server

```javascript
// Line 5966 in logs.txt
$.ajax({
  "type": "POST",
  "url": "/api/v2/me/calls/UIVB8J6JE91C53UIM3VI59VHQ4000001",
  "data": "{\"operationName\":\"Answer\"}"
})
```

## Why This Matters for Our Asterisk Setup

### The Issue: WWE Doesn't Receive Call Data Through Asterisk

When calls come through Asterisk:

```
Call Flow:
1. Agent 1003 → Makes call to 1000 (WebRTC client)
2. T-Server → Asterisk: INVITE with call context
3. Asterisk → WebRTC Client: INVITE (possibly without full context)
4. ❌ WWE doesn't receive call notification from Workspace API
5. ❌ No BusinessCall flag received
6. ❌ No interaction created in WWE
7. ❌ Call rings but is "invisible"
```

### Root Cause: Two Separate Issues

#### Issue 1: WWE Not Getting T-Server Events (Primary Issue)

**Problem**: WWE connects to Workspace API (192.168.210.54:8090) for call events, not to SIP endpoint.

**Call Flow with Direct Genesys Registration**:
```
Genesys SIP Endpoint → Registers to T-Server
                    ↓
WWE (Browser) ← WebSocket ← Workspace API ← T-Server
                    ↑
              Call events with BusinessCall flag
```

**Call Flow Through Asterisk**:
```
WebRTC Client → Registers to Asterisk → Registers DN to T-Server
                                    ↓
WWE (Browser) ← WebSocket ← Workspace API ← T-Server
                    ↑
                    ❌ No call events because WebRTC client ≠ Registered DN?
```

#### Issue 2: DN Association Problem

**Hypothesis**: T-Server doesn't know that the WebRTC client at Asterisk is associated with the agent's DN (e.g., 1002).

**Evidence**:
- Direct registration: Genesys Softphone registers as DN 1002 → T-Server knows 1002 = this endpoint
- Through Asterisk: Asterisk registers DN 1002 to T-Server, but WebRTC client registers to Asterisk with different identity?

## Configuration to Check

### 1. Agent Configuration in Genesys GAX

**Location**: Configuration Manager → Persons → [Agent] → Annex Tab

Look for:
```
Section: voice
  - auto-answer = true/false
  - auto-answer-business-calls = true/false
  - auto-answer-delay = 0
```

### 2. DN Configuration in Genesys

**Location**: Configuration Manager → DNs → [DN Number] → Options Tab

Check:
```
- switch-specific-type: Extension or Agent DN
- register: true
- use-register-bc-for-voice-calls: true
```

### 3. Workspace API Configuration

**Check**: Is the WebRTC client's DN properly associated with the agent in Workspace?

```bash
# Query Workspace API to see devices
curl -X GET "http://192.168.210.54:8090/api/v2/me/devices" \
  -H "Cookie: WORKSPACE-SESSIONID=..."
```

Should show:
```json
{
  "devices": [{
    "phoneNumber": "1000",
    "deviceState": "Active",
    "userState": {"state": "Ready"}
  }]
}
```

### 4. Check DN Registration in T-Server

**Location**: T-Server logs or SIP Server logs

Verify:
```
- DN 1000 is registered
- DN 1000 is associated with agent's place/device
- DN 1000 has correct Contact address (should point to WebRTC client via Asterisk)
```

## The Real Problem: DN Registration vs Call Routing

### Scenario 1: Direct Registration (Working)

```
1. Agent logs into WWE at DN 1002
2. Genesys SIP Endpoint registers to T-Server as 1002
   Contact: sip:1002@10.81.64.2:5060
3. T-Server knows: DN 1002 = Agent abhishek.varma = Device 3cb9ad32-e019-4fe8-ba15-a8d9e2d66c52
4. Call arrives for 1002 → T-Server routes to registered contact
5. T-Server sends call event to WWE via Workspace API (DN 1002 = logged in agent)
6. WWE receives event with BusinessCall: 1
7. WWE auto-answers
```

### Scenario 2: Through Asterisk (Not Working)

```
1. Agent logs into WWE at DN 1000
2. registration-monitor triggers Asterisk to register DN 1000 to T-Server
   Contact: sip:1000@192.168.210.74:5060 (Asterisk's IP)
3. T-Server knows: DN 1000 = registered at Asterisk
4. ❌ T-Server doesn't know: DN 1000 = Agent's device in Workspace
5. Call arrives for 1000 → T-Server routes to Asterisk
6. Asterisk forwards INVITE to WebRTC client
7. ❌ T-Server DOESN'T send call event to WWE (DN not associated with agent's device)
8. ❌ WWE never receives the call notification
9. ❌ No BusinessCall flag, no auto-answer, no Call Manager interaction
```

## Solution: Proper DN-to-Agent Association

### Option 1: Register DN with Agent Association (Recommended)

When registering DN 1000 to T-Server, include agent/device information:

**Current registration** (from registration-monitor):
```
Action: PJSIPRegister
Endpoint: genesys_1000
```

**Should include device association**:
```ini
# In DN configuration (Genesys Configuration Manager)
DN: 1000
  switch: SIP_Switch
  switch-specific-type: Extension
  register: true
  
  # Link to Place/Device
  place-link: [Agent's Place]
  device-link: [Agent's Device DBID]
```

### Option 2: Use Workspace API to Set Device

After login, set the DN as the agent's active device:

```javascript
// In webrtc-gateway-bridge
async function setAgentDevice(dn) {
  await fetch('http://192.168.210.54:8090/api/v2/me/devices', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber: dn,
      operation: 'SetActive'
    })
  });
}
```

### Option 3: Configure Asterisk as SIP Server in Genesys

Register Asterisk as a SIP Server in Genesys:

**Steps**:
1. Add Asterisk as SIP Server object in Genesys
2. Configure DNs to use Asterisk as their switch
3. T-Server will then properly track calls through Asterisk

## Next Steps to Verify

### 1. Check Agent's Device Association

```bash
# On your Windows machine, check WWE console
# Look for device information after login
```

Expected: WWE should show device DN 1000 is active

### 2. Check T-Server Call Routing

```bash
# On Genesys server, check SIP logs
grep "INVITE.*1000" /path/to/SIP_P*.log
```

Look for: Does T-Server send EventRinging, EventEstablished for DN 1000?

### 3. Check Workspace API Events

**In browser console while call is incoming**:

```javascript
// WWE should log incoming call events
// Search for: "Message received from /v2/me/calls"
```

If this is missing → DN is not associated with agent's device in Workspace

### 4. Verify DN Configuration in Genesys

**In Configuration Manager**:
- DNs → 1000 → Check if it has a Place association
- Places → [Agent's Place] → Check if DN 1000 is assigned
- Persons → [Agent] → Check default Place/Device

## Conclusion

You were absolutely right! The auto-answer is **not** controlled by SIP endpoint settings but by:

1. **Agent configuration** (voice.auto-answer preference)
2. **Call type** (BusinessCall flag in attached data)
3. **Proper DN-to-Agent association** in Genesys

The issue is that when calls come through Asterisk, **Workspace API doesn't receive the call events** because the DN registration doesn't properly associate with the agent's device in Workspace.

The fix is to ensure DN 1000 (or other WebRTC DNs) are properly linked to agent Places/Devices in Genesys Configuration, so T-Server knows to send call events to WWE via Workspace API.

# WWE Call Notification Solution via AMI NOTIFY Monitoring

## Date: 2026-01-28

## Problem Recap

Calls from DN 1003 to DN 1002:
- ✅ Arrive at Asterisk and get forwarded to WebRTC client  
- ✅ Auto-answered by WebRTC bridge (500ms delay)
- ❌ **NOT appearing in WWE interface**

## Root Cause

From the Asterisk logs, we can see that Genesys SIP Server IS sending NOTIFY messages with the CallUUID:

```
NOTIFY sip:192.168.210.54:5061 SIP/2.0
From: sip:1003@192.168.210.81:5060
To: <sip:1002@192.168.210.81>
Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-82@192.168.210.81
Event: talk
X-Genesys-CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001R
```

**Asterisk is receiving these NOTIFY messages but NOT forwarding them to the WebRTC client!**

## Solution Implemented

### 1. AMI NOTIFY Handler (Updated)
File: `asterisk/ami-notify-handler.py`

- Monitors Asterisk AMI for incoming NOTIFY messages
- Extracts `X-Genesys-CallUUID` from the SIP headers
- Sends the CallUUID to the WebRTC bridge via new API endpoint

### 2. WebRTC Bridge API Endpoint (New)
File: `webrtc-gateway-bridge/src/main.js`

Added new endpoint: `POST /genesys-call-notify`

```javascript
{
  dn: "1002",
  call_id: "D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-82@192.168.210.81",
  call_uuid: "UIVB8J6JE91C53UIM3VI59VHQ400001R",
  event: "talk"
}
```

This endpoint:
- Stores the CallUUID with the incoming call
- Triggers auto-answer if event is "talk"
- Makes CallUUID available for WWE queries

### 3. Flow Diagram

```
1. Genesys detects call 1003 → 1002
2. Genesys sends INVITE to Asterisk
3. Asterisk forwards INVITE to WebRTC client (DN 1002)
4. WebRTC client rings
5. Genesys sends NOTIFY with Event: talk, X-Genesys-CallUUID: XXX
6. Asterisk receives NOTIFY (but doesn't forward it)
7. 🆕 AMI handler detects NOTIFY message
8. 🆕 AMI handler extracts CallUUID and sends to Bridge
9. 🆕 Bridge stores CallUUID
10. 🆕 Bridge auto-answers call
11. 🆕 WWE can now query Bridge for CallUUID
12. 🆕 WWE displays call with proper Genesys context
```

## Challenge: AMI Event Detection

The problem is that Asterisk's AMI doesn't generate events for in-dialog NOTIFY messages by default.

### Options:

#### Option A: Enable SIP Packet Capture in AMI
Add to `manager.conf`:
```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

# Enable packet capture events
displayconnects = yes

[admin]
secret = admin123
read = all
write = all
```

Then monitor `RTCPReceived` or raw packet events.

#### Option B: Parse Asterisk SIP Debug Log
- Enable `sip set debug on` in Asterisk
- Parse the log file for NOTIFY messages
- Extract X-Genesys-CallUUID from log lines

#### Option C: Use tcpdump/tshark
- Capture SIP packets on port 5061
- Parse NOTIFY messages in real-time
- Extract CallUUID and send to bridge

## Recommended: Option C (tcpdump)

Most reliable and doesn't depend on Asterisk internals.

### Implementation:

```bash
# In the AMI handler container or host
tcpdump -i any -n -A port 5061 2>/dev/null | \
  python3 sip-notify-parser.py
```

`sip-notify-parser.py`:
```python
import re
import requests

while True:
    line = input()
    
    # Detect NOTIFY messages
    if 'NOTIFY' in line:
        # Read next ~20 lines to capture full message
        message = [line]
        for _ in range(20):
            try:
                message.append(input())
            except:
                break
        
        full_message = '\n'.join(message)
        
        # Extract CallUUID
        match = re.search(r'X-Genesys-CallUUID:\s*(\S+)', full_message)
        if match:
            call_uuid = match.group(1)
            
            # Extract To header for DN
            to_match = re.search(r'To:.*<sip:(\d+)@', full_message)
            if to_match:
                dn = to_match.group(1)
                
                # Extract Call-ID
                call_id_match = re.search(r'Call-ID:\s*(\S+)', full_message)
                call_id = call_id_match.group(1) if call_id_match else 'unknown'
                
                # Send to bridge
                requests.post('https://127.0.0.1:8000/genesys-call-notify', 
                    json={
                        'dn': dn,
                        'call_id': call_id,
                        'call_uuid': call_uuid,
                        'event': 'talk'
                    },
                    verify=False
                )
```

## Next Steps

1. ✅ Update AMI handler to extract CallUUID
2. ✅ Add `/genesys-call-notify` endpoint to bridge
3. ⏳ Implement tcpdump-based SIP parser
4. ⏳ Test call flow with CallUUID extraction
5. ⏳ Verify WWE receives and displays calls correctly

## Alternative: Direct Genesys Integration (Future)

Long-term solution: Register WebRTC clients directly to Genesys SIP Server instead of Asterisk. This would make T-Server aware of all calls naturally, eliminating the need for this workaround.


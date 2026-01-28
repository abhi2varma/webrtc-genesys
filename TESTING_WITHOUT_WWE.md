# Testing SIP NOTIFY Without WWE

This guide shows how to test the SIP NOTIFY signaling extraction **without WWE**, to verify the core functionality.

## What We're Testing

1. ✅ **NOTIFY message extraction** - Can we capture and parse `X-Genesys-CallUUID`?
2. ✅ **Bridge endpoint** - Does the bridge receive the CallUUID?
3. ✅ **Auto-answer** - Does the call get answered automatically?

**WWE integration comes after these work.**

---

## Test 1: Parse Sample NOTIFY (Local)

Test the extraction logic with a sample NOTIFY message from your logs:

```bash
cd asterisk
python3 test-notify-extraction.py
```

**Expected Output:**
```
📋 Parsing NOTIFY message...
  ✓ Found NOTIFY request
  ✓ Event: talk
  ✓ CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001T
  ✓ To (DN): 1002
  ✓ From (Caller): 1003

✅ NOTIFY parsing successful!
  DN (called):  1002
  CallUUID:     UIVB8J6JE91C53UIM3VI59VHQ400001T

Testing Bridge Endpoint
  URL:      https://127.0.0.1:8000/genesys-call-notify
  Payload:  {'dn': '1002', 'call_uuid': 'UIVB8J6JE91C53UIM3VI59VHQ400001T'}
  
  Status:   200
  Response: OK
  
✅ Bridge accepted the CallUUID!
```

---

## Test 2: Live NOTIFY Capture (Server)

Deploy and test the live monitor on the server:

### Step 1: Deploy
```bash
cd /root/webrtc-genesys
git pull origin main
bash scripts/deploy-sip-monitor-simple.sh
```

### Step 2: Watch Logs
```bash
tail -f /tmp/sip-notify-monitor.log
```

### Step 3: Make Test Call
From Genesys or a softphone: **Call 1003 → 1002**

### Expected Log Output
```
[10:30:15.123] SIP NOTIFY Parser started
[10:30:15.124] Listening for NOTIFY messages on stdin (from tcpdump)...

[10:30:45.678] 📩 NOTIFY detected
[10:30:45.679]   DN: 1002
[10:30:45.680]   Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-84@192.168.210.81
[10:30:45.681]   CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001T
[10:30:45.682]   Event: talk
[10:30:45.683] ✅ Bridge notified: DN=1002, CallUUID=UIVB8J6JE91C53UIM3VI59VHQ400001T
```

---

## Test 3: Verify Bridge Received CallUUID

Check the bridge logs to confirm it received the notification:

```bash
# If bridge logs to stdout
pm2 logs webrtc-bridge

# Or check the electron console
```

**Expected Bridge Log:**
```
[Bridge] Received Genesys NOTIFY: DN=1002, CallUUID=UIVB8J6JE91C53UIM3VI59VHQ400001T
[Bridge] Call auto-answered for DN 1002
```

---

## Test 4: Verify Call Auto-Answers

After the NOTIFY is received:

1. **Call should auto-answer** within 500ms
2. **SIP 200 OK** should be sent
3. **Call connects** (you should hear audio)

Check Asterisk CLI:
```bash
docker exec -it webrtc-asterisk asterisk -rvvv
```

Look for:
```
<--- Received SIP request (542 bytes) from UDP:192.168.210.81:5060 --->
NOTIFY sip:192.168.210.54:5061 SIP/2.0
...
X-Genesys-CallUUID: UIVB8J6JE91C53UIM3VI59VHQ400001T

[Auto-answer triggered for DN 1002]
<--- Transmitting SIP response (200 OK) --->
```

---

## Troubleshooting

### Monitor not capturing NOTIFY
```bash
# Check if tcpdump is running
ps aux | grep tcpdump

# Check network interface
ip addr show

# Test tcpdump manually
tcpdump -i any -n port 5061
```

### Bridge not receiving
```bash
# Test bridge endpoint manually
curl -k -X POST https://127.0.0.1:8000/genesys-call-notify \
  -H "Content-Type: application/json" \
  -d '{"dn":"1002","call_uuid":"TEST123"}'

# Should return: 200 OK
```

### Call not auto-answering
```bash
# Check bridge is running
curl -k https://127.0.0.1:8000/Ping

# Check WebRTC client is registered
# Asterisk CLI:
pjsip show endpoints
# Should show 1002 as online
```

---

## What's Working vs Not Working

### ✅ Should Work (Without WWE)
- NOTIFY message capture
- CallUUID extraction
- Bridge receiving notification
- Call auto-answering
- Audio working

### ❌ Won't Work (Without WWE)
- Call appearing in WWE UI
- WWE call controls
- Call disposition codes
- Genesys-specific features

---

## Next: Add WWE Integration

Once the above tests pass, WWE integration is straightforward:

1. Bridge stores CallUUID per DN
2. WWE queries bridge: "Do you have a CallUUID for DN 1002?"
3. Bridge responds with CallUUID
4. WWE uses CallUUID to fetch call details from Workspace API
5. WWE displays call in UI

But **test the signaling first** without WWE to isolate issues.

---

## Quick Commands Reference

```bash
# Deploy monitor
bash scripts/deploy-sip-monitor-simple.sh

# Watch logs
tail -f /tmp/sip-notify-monitor.log

# Stop monitor
pkill -f sip-notify-parser.py

# Test bridge endpoint
python3 asterisk/test-notify-extraction.py

# Check bridge health
curl -k https://127.0.0.1:8000/Ping

# View Asterisk logs
docker exec -it webrtc-asterisk asterisk -rvvv
```

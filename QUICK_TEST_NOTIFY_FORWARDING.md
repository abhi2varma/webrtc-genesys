# Quick Test: NOTIFY Forwarding in Asterisk

## Issue
WWE doesn't show calls when they come through Asterisk because the `NOTIFY` message with `Event: talk` from Genesys T-Server isn't reaching the WebRTC client.

## Quick Test on Server

### Step 1: Enable SIP Debugging

```bash
ssh abhishek.varma@192.168.210.74

# Enable full SIP logging
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
sudo docker exec -it webrtc-asterisk asterisk -rx "core set verbose 10"
sudo docker exec -it webrtc-asterisk asterisk -rx "core set debug 10"
```

### Step 2: Make a Test Call

1. From extension **1003** (or any DN), call a WebRTC client (e.g., **1000**)
2. Let the call ring (don't answer yet)
3. Wait 5 seconds to capture all SIP messages

### Step 3: Capture Logs

```bash
# Save Asterisk logs
sudo docker logs webrtc-asterisk --tail 1000 > /tmp/asterisk_notify_test.log

# Copy to local machine (from your Windows machine)
scp abhishek.varma@192.168.210.74:/tmp/asterisk_notify_test.log D:\Abhi\WebRTC\webrtc-genesys\
```

### Step 4: Search for NOTIFY

```bash
# On server
grep -i "Event: talk" /tmp/asterisk_notify_test.log
grep -i "NOTIFY.*Event" /tmp/asterisk_notify_test.log

# Check if NOTIFY is received from Genesys
grep -i "NOTIFY.*192.168.210.81" /tmp/asterisk_notify_test.log

# Check if NOTIFY is sent to WebRTC client
grep -i "NOTIFY.*192.168.210.25" /tmp/asterisk_notify_test.log
```

## Expected Results

### ✅ If NOTIFY is Working (Should See)

```
<--- Receiving NOTIFY from 192.168.210.81:5060 --->
NOTIFY sip:1000@192.168.210.25:XXXX SIP/2.0
Event: talk
Subscription-State: active
X-Genesys-CallUUID: ...

---> Transmitting NOTIFY to 192.168.210.25:XXXX --->
NOTIFY sip:1000@192.168.210.25:XXXX SIP/2.0
Event: talk
...
```

### ❌ If NOTIFY is Blocked (Will See)

```
<--- Receiving NOTIFY from 192.168.210.81:5060 --->
NOTIFY sip:1000@... SIP/2.0
Event: talk
...

[No corresponding transmission to WebRTC client]
```

OR

```
[No NOTIFY with Event: talk received from Genesys at all]
```

## Fix if NOTIFY Not Forwarded

### Option 1: Configure Asterisk to Forward NOTIFY

Edit `asterisk/etc/pjsip.conf`:

```ini
[genesys_trunk]
type=endpoint
; ... existing settings ...
allow_subscribe=yes
notify_early_inuse_ringing=yes

[webrtc_client_template](!)
type=endpoint
; ... existing settings ...
allow_subscribe=yes
subscribe_context=default
```

Restart:
```bash
sudo docker restart webrtc-asterisk
```

### Option 2: Configure Asterisk to Pass Through NOTIFY

Edit `asterisk/etc/extensions.conf` to add NOTIFY pass-through:

```ini
[from-genesys]
; Existing dial rules
exten => _XXXX,1,NoOp(Incoming call for ${EXTEN})
same => n,Dial(PJSIP/${EXTEN},60)
same => n,Hangup()

; Pass through NOTIFY messages
exten => _XXXX,1,Set(CHANNEL(passthrough_notify)=yes)
```

### Option 3: Enable SIP INFO Method (Alternative)

If NOTIFY can't be forwarded, use SIP INFO as an alternative:

```ini
[webrtc_client_template](!)
type=endpoint
dtmf_mode=rfc4733
allow_sdp_nat=yes
```

## Quick Verification Commands

### Check Endpoint Settings

```bash
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint 1000"
```

Look for:
- `allow_subscribe`: Should be `true`
- `subscribe_context`: Should be set
- `notify_early_inuse_ringing`: Should be `true`

### Check Active Subscriptions

```bash
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip show subscriptions"
```

Should show subscriptions for each registered WebRTC client.

### Monitor NOTIFY in Real-Time

```bash
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
# Then watch logs in another terminal
sudo docker logs -f webrtc-asterisk | grep -i "NOTIFY\|Event:"
```

## Test with Direct Genesys Registration (Control)

To verify the hypothesis, you already tested this:

1. ✅ Register 1002 directly to Genesys (192.168.210.81:5060)
2. ✅ Call from 1003 to 1002
3. ✅ NOTIFY with Event: talk is sent
4. ✅ WWE auto-answers
5. ✅ Call shows in WWE Call Manager

## Test with Asterisk (Issue)

Now test through Asterisk:

1. ❌ Register 1000 to Asterisk (192.168.210.74:5060)
2. ❌ Call from 1003 to 1000
3. ❓ **Does NOTIFY with Event: talk reach 1000?**
4. ❌ WWE doesn't auto-answer
5. ❌ Call doesn't show in WWE Call Manager

## One-Line Test

```bash
# Make call and immediately check for NOTIFY
sudo docker logs --tail 200 --follow webrtc-asterisk | grep -i "NOTIFY\|Event: talk" &
# Now make the test call
# Press Ctrl+C when done
```

## Expected Fix Result

After enabling NOTIFY forwarding:

```
1. Call from 1003 -> 1000 (through Asterisk)
2. Asterisk receives INVITE from Genesys
3. Asterisk forwards INVITE to WebRTC client 1000
4. 1000 sends 180 Ringing
5. ✅ Genesys sends NOTIFY (Event: talk) to Asterisk
6. ✅ Asterisk forwards NOTIFY to 1000
7. ✅ WWE detects auto-answer condition
8. ✅ WWE creates interaction
9. ✅ Call appears in WWE Call Manager
10. ✅ Call auto-answers
```

## Files to Check

- `asterisk/etc/pjsip.conf` - Main configuration
- `asterisk/etc/extensions.conf` - Dialplan
- Asterisk logs - `/var/log/asterisk/full`

## Next Action

**Run the test, capture logs, and check if NOTIFY is being forwarded!**

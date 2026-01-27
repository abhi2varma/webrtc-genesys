# 🎯 SIMPLER SOLUTION: Asterisk responds to NOTIFY and forwards to WebRTC client

## **Problem We Just Discovered:**

T-Server is sending `NOTIFY` with `Event: talk` to Asterisk **4 TIMES** (retrying):

```sip
<--- Received SIP request from UDP:192.168.210.81:5060 --->
NOTIFY sip:192.168.210.54:5061 SIP/2.0
Event: talk
Subscription-State: active
Call-ID: D6F9763C-E5D5-4C4B-97C3-C0725E0E2E17-21@192.168.210.81
```

**Asterisk is receiving it but:**
1. ❌ NOT responding with `200 OK`
2. ❌ NOT forwarding to WebRTC client
3. ❌ Causing T-Server to retry 4 times

## **Why Asterisk Isn't Responding:**

The NOTIFY is an **in-dialog** message (part of the INVITE dialog), but Asterisk doesn't have an established subscription to handle it. T-Server is sending unsolicited NOTIFY messages.

## **SOLUTION OPTIONS:**

### **Option 1: Make Asterisk Respond to NOTIFY** ⭐ **EASIEST**

Add to `pjsip.conf`:

```ini
[global]
type=global
max_forwards=70
keep_alive_interval=90
user_agent=Asterisk-WebRTC-Client
ignore_uri_user_options=yes
send_rpid=yes
send_pai=yes
```

And in the endpoint config, add:

```ini
[genesys_sip_server]
type=endpoint
...
allow_subscribe=yes
accept_multiple_sdp_answers=yes
```

This makes Asterisk accept the NOTIFY and respond with 200 OK.

### **Option 2: Forward NOTIFY via Custom SIP Messaging**

Use Asterisk's MESSAGE bus to forward NOTIFY to WebRTC client:

In `extensions-sip-endpoint.conf`:

```asterisk
[from-genesys]
; Handle incoming calls
exten => _X.,1,NoOp(Call from Genesys ${EXTEN})
    same => n,Set(CHANNEL(hangup_handler_push)=notify-handler,s,1)
    same => n,Dial(PJSIP/${EXTEN},30,rTt)
    same => n,Hangup()

; NOTIFY handler (called via AGI or custom event)
[notify-handler]
exten => s,1,NoOp(Handling NOTIFY Event: talk)
    same => n,System(/usr/local/bin/trigger-auto-answer.sh ${CHANNEL})
    same => n,Return()
```

### **Option 3: Use PJSIP NOTIFY Template** ⭐ **RECOMMENDED**

Create `/etc/asterisk/pjsip_notify.conf`:

```ini
[talk_event]
Event=>talk
Subscription-State=>active
Content=>
```

Then forward NOTIFY when received from T-Server to WebRTC client.

### **Option 4: Simplest - Just Answer Immediately on 180 Ringing**

Since we know auto-answer is enabled, we can modify the dialplan to answer immediately after sending 180 Ringing:

```asterisk
[from-genesys]
exten => _X.,1,NoOp(Call from Genesys ${EXTEN})
    same => n,Set(CALLERID(name)=)
    same => n,Set(CALLERID(num)=${CALLERID(num)})
    same => n,Set(CHANNEL(musicclass)=default)
    ; Progress to generate 180 Ringing
    same => n,Progress()
    ; Wait a tiny bit for 180 to be sent
    same => n,Wait(0.1)
    ; Now answer immediately (auto-answer simulation)
    same => n,Answer()
    ; Bridge the call
    same => n,Dial(PJSIP/${EXTEN},30,A)
    same => n,Hangup()
```

## **IMMEDIATE ACTION:**

Test **Option 4** first since auto-answer is already enabled:

1. Modify Asterisk dialplan to answer immediately after 180 Ringing
2. This simulates the auto-answer behavior
3. Test call flow

If that doesn't work, implement **Option 3** (PJSIP NOTIFY forwarding).

## **Current Logs Show:**

- ✅ INVITE received from T-Server
- ✅ Asterisk forwards to WebRTC client  
- ✅ WebRTC client sends 180 Ringing
- ✅ Asterisk forwards 180 to T-Server
- ✅ **T-Server sends NOTIFY Event: talk** (4 times, retrying)
- ❌ **Asterisk doesn't respond**
- ❌ **No auto-answer happens**
- ❌ Call times out

## **Testing Steps:**

```bash
# 1. Edit dialplan
docker exec -it asterisk vi /etc/asterisk/extensions-sip-endpoint.conf

# 2. Reload dialplan
docker exec asterisk asterisk -rx "dialplan reload"

# 3. Make test call with auto-answer enabled

# 4. Watch logs
docker exec asterisk asterisk -rvvv
```

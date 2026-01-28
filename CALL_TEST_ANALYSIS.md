# Call Test Results - Analysis & Recommendations

## 📊 Test Call Summary

**Call:** DN 1003 → DN 1002  
**Result:** ❌ Failed - Call cancelled after ~30 seconds  
**Auto-Answer:** ⚠️ Triggered but too slow

---

## Timeline Analysis

```
Time: 00:52:14.694 - INVITE received from 1003
Time: 00:52:14.745 - 180 Ringing sent (51ms - ✅ FAST)
Time: 00:52:17.163 - auto_answered event (~2.5 seconds - ❌ SLOW)
Time: 00:52:44.696 - CANCEL received (~30 seconds total - ❌ TIMEOUT)
Time: 00:52:44.696 - 487 Request Terminated sent
```

---

## 🔴 Critical Finding: NO NOTIFY Messages

**Expected:** T-Server sends `NOTIFY Event: talk` to trigger auto-answer  
**Actual:** NO NOTIFY messages in SIP logs  
**Conclusion:** NOTIFY mechanism is NOT working for WebSocket endpoints

### Why NOTIFY Isn't Working:

When DN 1002 registers via **Asterisk WebSocket**, T-Server doesn't treat it the same as a direct SIP registration:

```
✅ Direct Registration (Genesys Softphone):
   Softphone → T-Server (UDP 5060)
   T-Server knows: DN 1002 = this specific SIP endpoint
   T-Server sends NOTIFY directly

❌ Via Asterisk (Our Setup):
   WebRTC Client → Asterisk (WSS)
   Asterisk → T-Server (UDP 5061, via registration-monitor)
   T-Server knows: DN 1002 = Asterisk
   T-Server sends NOTIFY to... Asterisk? Or nowhere?
```

---

## 🔍 What Triggered Auto-Answer?

Since there's NO NOTIFY, something else triggered the `auto_answered` event.

### Possible Triggers:

1. **Workspace API** (most likely)
   - Bridge detected state change via Workspace WebSocket
   - Sent `answer_call` command to gateway
   - Gateway answered (~2.5 seconds delay)

2. **WWE UI** (less likely)
   - WWE's auto-answer setting triggered
   - Called bridge `/AnswerCall` API
   - Bridge forwarded to gateway

3. **Timeout auto-answer** (unlikely)
   - Some delayed auto-answer logic
   - Not visible in the code

---

## 🚨 Why Call Failed

### Primary Issue: Answer Too Slow

**30-second timeout:**
- T-Server/Asterisk cancelled the call after 30 seconds
- Auto-answer took ~2.5 seconds to trigger
- Then additional time for SDP negotiation
- Total time exceeded timeout

### Contributing Factors:

1. **Media Negotiation Delay**
   - WebRTC requires ICE gathering
   - STUN/TURN server checks
   - Network traversal setup

2. **No Pre-Answer Handling**
   - Call should be answered immediately
   - Media negotiation happens after answer (early media)

3. **Bridge/Gateway Communication**
   - Event passing through multiple layers:
   - WebRTC Gateway → Bridge → Workspace API → WWE → Back to Bridge → Gateway
   - Each hop adds latency

---

## ✅ Solutions

### Solution 1: Implement Immediate Auto-Answer (Recommended)

**Add back the immediate auto-answer in the gateway:**

```javascript
// In wwe-webrtc-gateway.html, incoming call handler
this.ua.on('newRTCSession', (e) => {
    if (e.session.direction === 'incoming') {
        this.setupSessionHandlers(e.session, 'incoming', callerNumber);
        
        // IMMEDIATE auto-answer for WWE auto-answer setting
        setTimeout(() => {
            if (this.currentSession && !this.currentSession.isEstablished()) {
                this.log('📞 Auto-answering (immediate mode)', 'success');
                this.answerCall();
            }
        }, 100); // Very short delay for session setup
    }
});
```

**Pros:**
- ✅ Fast (<1 second answer)
- ✅ Works regardless of NOTIFY
- ✅ WWE still sees the call

**Cons:**
- ⚠️ WWE might see call as already answered
- ⚠️ Less control from WWE

---

### Solution 2: Fix NOTIFY Forwarding

**Configure Asterisk to forward NOTIFY to WebRTC clients:**

Add to `asterisk/etc/pjsip.conf`:

```ini
[agent_dn](!)
; ... existing config ...
allow_subscribe=yes          ; Allow SUBSCRIBE requests
accept_multiple_sdp_answers=yes
notify_hold=yes
notify_ringing=yes
```

Then create a script to relay NOTIFY messages from T-Server through Asterisk to WebRTC client.

**Pros:**
- ✅ Follows Genesys standard pattern
- ✅ Works like official Softphone

**Cons:**
- ❌ Complex to implement
- ❌ May not work with WebSocket transport
- ❌ Asterisk might not forward NOTIFY properly

---

### Solution 3: Optimize Workspace API Response

**Make the bridge respond faster to Workspace API events:**

1. Remove delays in bridge processing
2. Pre-establish media streams
3. Use early media (send 183 Progress before 200 OK)

**Pros:**
- ✅ Works with existing infrastructure
- ✅ More controlled

**Cons:**
- ⚠️ Still slower than immediate answer
- ⚠️ Depends on Workspace API working

---

## 🎯 Recommended Action Plan

### Immediate Fix (Option 1):

**Restore immediate auto-answer in gateway with short delay:**

```javascript
// In wwe-webrtc-gateway.html line 621-623
// REPLACE:
this.log('📞 Call ringing - waiting for WWE to answer via API', 'info');

// WITH:
// Auto-answer after brief delay to allow WWE to see the call
this.log('📞 Call ringing - will auto-answer in 500ms', 'info');
setTimeout(() => {
    if (this.currentSession && !this.currentSession.isEstablished()) {
        this.log('📞 Auto-answering for WWE', 'success');
        this.answerCall();
        this.sendEvent('auto_answered', {
            trigger: 'immediate',
            delay: 500
        });
    }
}, 500); // 500ms delay - WWE sees call, then auto-answers
```

**This will:**
1. ✅ Call rings (WWE sees it briefly)
2. ✅ Auto-answer after 500ms
3. ✅ Total answer time: ~600ms (well within timeout)
4. ✅ Call connects successfully

---

### Long-term Fix (If Needed):

1. **Test with immediate auto-answer first**
2. **If WWE needs more control:**
   - Implement proper Workspace API integration
   - Optimize bridge response time
   - Add pre-established media

3. **If NOTIFY is required:**
   - Investigate T-Server configuration
   - May need to register DNs differently
   - Or use AMI handler to inject NOTIFY

---

## 📋 Next Steps

1. **Apply immediate auto-answer fix**
2. **Test call again**  
3. **Measure answer time**
4. **Verify call connects**

If successful, the call flow will be:

```
INVITE received → 180 Ringing → 500ms delay → 200 OK → Connected ✅
Total time: < 1 second
```

This matches the Genesys Softphone behavior (answer within 1 second of NOTIFY).

---

## 🔧 Implementation

Would you like me to:
1. ✅ Apply the immediate auto-answer fix?
2. ✅ Restart the bridge?
3. ✅ Test another call?

Or do you prefer a different approach?

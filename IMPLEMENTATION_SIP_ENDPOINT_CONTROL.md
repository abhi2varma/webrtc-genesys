# Implementation: Enable SIP Endpoint Control Mode for WWE

## Current Status

✅ **Already Implemented:**
- Electron Bridge REST API at `https://127.0.0.1:8000`
- `/AnswerCall` endpoint (line 488-501 in main.js)
- `/HangUp` endpoint (line 472-485)
- `/Hold` and `/Retrieve` endpoints (lines 536-565)
- WebRTC gateway `answerCall()` method
- Message passing between Electron and WebRTC gateway

❌ **Not Working:**
- WWE is in **3PCC/T-Server control mode**
- WWE sends Answer to Genesys API, not to the Electron bridge
- Need to configure WWE for **SIP Endpoint control mode**

---

## Solution: Configure Genesys for SIP Endpoint Control

### Step 1: Update Device Configuration in Genesys

**Option A: Via Genesys Administrator (GUI)**

1. Open **Genesys Administrator**
2. Navigate to: **Configuration → Environment → Devices**
3. Find the device for DN 1002 (likely `P_1002` or similar)
4. Open **Annex** tab
5. Add/modify these parameters:

```ini
[voice]
media-type = sip-endpoint
control-mode = endpoint
use-external-routing = true
```

6. Save the configuration
7. Restart T-Server or reload configuration

**Option B: Via Genesys Configuration Manager**

1. Open **Configuration Manager**
2. Find: **Environment → Switches → SIP_Switch**
3. **Annex** tab → Add:

```ini
[voice]
media-control = external
third-party-control = false
```

4. Or create a new Switch type:
   - Name: `WebRTC_External`
   - Type: `External Service`
   - Set DNs 1002, 1003 to use this switch

---

### Step 2: Update WWE Configuration (if needed)

WWE may need additional configuration to recognize the SIP Endpoint. Check your WWE installation's configuration files:

**File:** `<WWE_Install>/config/environment.js` or similar

Add/verify:
```javascript
{
  "voice": {
    "sip-endpoint-control": true,
    "auto-answer": true,
    "endpoint-url": "https://127.0.0.1:8000"
  }
}
```

---

### Step 3: Verify Electron Bridge Endpoints

Your Electron bridge already has the required endpoints. Here's what WWE will call:

| WWE Action | HTTP Call | Your Endpoint |
|-----------|-----------|---------------|
| **Answer Call** | `POST /AnswerCall` | ✅ Implemented (line 488) |
| **Hangup** | `POST /HangUp` | ✅ Implemented (line 472) |
| **Hold** | `POST /Hold` | ✅ Implemented (line 536) |
| **Resume** | `POST /Retrieve` | ✅ Implemented (line 552) |
| **Make Call** | `POST /MakeCall` | ✅ Implemented (line 453) |

---

### Step 4: Add Missing Call Control Endpoints (Optional Enhancement)

While your basic endpoints work, WWE may expect additional endpoints:

```javascript
// Add to main.js around line 566

// Transfer call (blind transfer)
app.post('/Transfer', async (req, res) => {
  try {
    const { destination } = req.body;
    logger.info('Transfer called', { destination });
    
    await sendWebRTCCommand('transfer', { destination });
    
    res.json({
      TransferResult: true
    });
  } catch (error) {
    logger.error('Transfer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start conference
app.post('/Conference', async (req, res) => {
  try {
    logger.info('Conference called');
    
    await sendWebRTCCommand('conference', {});
    
    res.json({
      ConferenceResult: true
    });
  } catch (error) {
    logger.error('Conference error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mute/Unmute microphone
app.post('/MuteMicrophone', async (req, res) => {
  try {
    logger.info('MuteMicrophone called');
    
    await sendWebRTCCommand('set_mute', { muted: true });
    
    res.json({
      MuteMicrophoneResult: true
    });
  } catch (error) {
    logger.error('MuteMicrophone error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/UnmuteMicrophone', async (req, res) => {
  try {
    logger.info('UnmuteMicrophone called');
    
    await sendWebRTCCommand('set_mute', { muted: false });
    
    res.json({
      UnmuteMicrophoneResult: true
    });
  } catch (error) {
    logger.error('UnmuteMicrophone error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DTMF tones
app.post('/SendDTMF', async (req, res) => {
  try {
    const { digits } = req.body;
    logger.info('SendDTMF called', { digits });
    
    await sendWebRTCCommand('send_dtmf', { digits });
    
    res.json({
      SendDTMFResult: true
    });
  } catch (error) {
    logger.error('SendDTMF error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### Step 5: Enhance WebRTC Gateway for Additional Commands

Add these handlers to `wwe-webrtc-gateway.html` around line 320:

```javascript
// In handleMessage() switch statement, add:

case 'transfer':
    this.transferCall(data);
    break;
case 'send_dtmf':
    this.sendDTMF(data);
    break;
case 'hold':
    this.holdCall();
    break;
case 'resume':
    this.resumeCall();
    break;
```

Then add these methods around line 550:

```javascript
transferCall({ destination }) {
    if (!this.currentSession) {
        this.log('No active call to transfer', 'error');
        return;
    }

    this.log(`Transferring call to ${destination}`, 'info');
    
    const target = `sip:${destination}@${this.sipServer.replace(/^wss?:\/\//, '').split(':')[0]}`;
    this.currentSession.refer(target);
    
    this.sendEvent('call_transferred', { destination });
}

sendDTMF({ digits }) {
    if (!this.currentSession) {
        this.log('No active call for DTMF', 'error');
        return;
    }

    this.log(`Sending DTMF: ${digits}`, 'info');
    
    for (const digit of digits) {
        this.currentSession.sendDTMF(digit);
    }
    
    this.sendEvent('dtmf_sent', { digits });
}

holdCall() {
    if (!this.currentSession) {
        this.log('No active call to hold', 'error');
        return;
    }

    this.log('Holding call', 'info');
    this.currentSession.hold();
    this.sendEvent('call_held');
}

resumeCall() {
    if (!this.currentSession) {
        this.log('No active call to resume', 'error');
        return;
    }

    this.log('Resuming call', 'info');
    this.currentSession.unhold();
    this.sendEvent('call_resumed');
}
```

---

## Testing the Fix

### Test 1: Verify Endpoint Control Mode

After configuration changes:

1. **Agent logs out and logs back in to WWE**
2. **Check WWE console logs:**
   ```bash
   grep "IWSIPEndpoint\|127.0.0.1:8000" logs.txt
   ```
   **Expected:** Should see WWE calling the Electron bridge

3. **Make a test call to DN 1002**
4. **Check Electron bridge logs:**
   ```bash
   # In your terminal running the bridge
   ```
   **Expected:** Should see `POST /AnswerCall` being called

### Test 2: Manual API Test

Before testing with WWE, verify your endpoints work:

```bash
# Test Answer endpoint
curl -k -X POST https://127.0.0.1:8000/AnswerCall \
  -H "Content-Type: application/json" \
  -d "{}"

# Expected: {"AnswerCallResult":true}
```

### Test 3: WWE Auto-Answer

1. **Incoming call to DN 1002**
2. **Expected behavior:**
   - Phone rings ✅
   - WWE shows notification ✅
   - **Call auto-answers within 1-2 seconds** ✅ ← This should now work!
   - WWE shows call as "Talking" ✅

---

## Debugging

### If auto-answer still doesn't work:

**Check 1: Is WWE calling the bridge?**
```bash
grep -i "answercall\|hangup\|hold" <electron_bridge_log>
```

**Check 2: WWE logs for control mode**
```bash
grep -i "endpoint\|3pcc\|control.*mode" logs.txt
```

**Check 3: Check device configuration**
In Genesys Administrator:
- DN 1002 properties → What Switch is it assigned to?
- Switch Annex → Does it have `media-control = external`?

**Check 4: T-Server logs**
```bash
# Should NOT see T-Server trying to send SIP commands to Asterisk
# for call control (Answer, Hold, etc.)
```

---

## Expected Call Flow After Fix

### Incoming Call with SIP Endpoint Control:

```
1. External → T-Server → Asterisk → WebRTC Client
   (Call signaling via SIP)

2. WebRTC Client → Ringing → Asterisk → T-Server

3. T-Server → EventRinging → GIS → WWE
   (WWE receives call notification)

4. WWE → POST https://127.0.0.1:8000/AnswerCall
   (WWE calls Electron bridge directly, NOT T-Server!)

5. Electron Bridge → answerCall() → WebRTC Gateway
   (JsSIP session.answer())

6. WebRTC Client → 200 OK → Asterisk → T-Server

7. T-Server → EventEstablished → GIS → WWE
   (Call connected)

8. RTP media flows: Asterisk ↔ WebRTC Client
```

**Key difference:** Step 4 - WWE now calls the Electron bridge, not T-Server!

---

## Alternative: Quick Hack (If Genesys Config Can't Be Changed)

If you can't change the Genesys configuration, you can implement a **WWE plugin** that intercepts Answer commands:

**File:** `wwe-webrtc-plugin.js`

```javascript
// WWE Plugin to override Answer behavior
(function() {
  // Intercept Answer command
  const originalAnswer = WWE.Voice.InteractionVoiceCommands.prototype.answer;
  
  WWE.Voice.InteractionVoiceCommands.prototype.answer = function() {
    console.log('[WebRTC Plugin] Intercepting Answer command');
    
    // Call our Electron bridge instead of T-Server
    fetch('https://127.0.0.1:8000/AnswerCall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(response => {
      console.log('[WebRTC Plugin] Call answered via bridge');
    }).catch(error => {
      console.error('[WebRTC Plugin] Answer failed:', error);
      // Fallback to original behavior
      originalAnswer.call(this);
    });
  };
})();
```

Load this plugin in WWE configuration.

---

## Summary

**The Fix:**
1. **Configure Genesys device for SIP Endpoint control mode**
2. **WWE will then call your Electron bridge for call control**
3. **Your existing `/AnswerCall` endpoint will handle it**
4. **Auto-answer will work!**

**Your code is already 95% ready** - you just need the Genesys configuration change to tell WWE to use SIP Endpoint control instead of T-Server control.

Would you like help with:
1. Making the Genesys configuration changes?
2. Adding the optional enhancement endpoints?
3. Creating a WWE plugin as a workaround?

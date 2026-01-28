# How Genesys Native WebRTC Bridge Works

## Architecture Overview

### Genesys Native WebRTC Solution Components

```
┌─────────────────────────────────────────────────────────────┐
│                         WWE (Browser)                        │
│  - Uses 3PCC (T-Server Control Mode)                        │
│  - Sends Answer/Hold/Transfer to Genesys API               │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS REST API
                 ↓
┌─────────────────────────────────────────────────────────────┐
│              Genesys Interaction Server (GIS)                │
│  - Receives WWE commands                                     │
│  - Forwards to T-Server via TLib protocol                   │
└────────────────┬────────────────────────────────────────────┘
                 │ TLib/TServer Protocol
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                  Genesys T-Server (SIP)                      │
│  - Receives call control requests (Answer, Hold, etc.)      │
│  - Translates to SIP messages                               │
│  - Has DN → Connection mapping                              │
└────────────────┬────────────────────────────────────────────┘
                 │ SIP Protocol
                 ↓
┌─────────────────────────────────────────────────────────────┐
│         Genesys Media Layer / WebRTC Gateway                 │
│  - SIP User Agent for each DN                               │
│  - WebRTC media server                                      │
│  - Receives SIP INVITE/200 OK/BYE from T-Server            │
└────────────────┬────────────────────────────────────────────┘
                 │ WebRTC (SRTP/DTLS)
                 ↓
┌─────────────────────────────────────────────────────────────┐
│              Browser (WebRTC Client in WWE)                  │
│  - Receives media stream                                     │
│  - ICE/STUN/TURN for NAT traversal                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Difference: DN Registration

### Genesys Native WebRTC
**The DN is registered BY the Media Layer, not by the agent's browser:**

1. **Agent logs in to WWE** → DN 1002
2. **WWE tells GIS** → "Agent wants DN 1002"
3. **GIS tells T-Server** → RequestDevice(DN=1002)
4. **T-Server sends SIP REGISTER** → To Media Layer on behalf of DN 1002
5. **Media Layer registers** → DN 1002 to T-Server
6. **T-Server knows:** DN 1002 = Media Layer SIP endpoint

### Your Current Setup (Problem)
**The DN is registered BY Asterisk:**

1. **Agent logs in to WWE** → DN 1002
2. **WWE tells Electron Bridge** → RegisterDN(1002)
3. **Electron Bridge → WebRTC Client** → Registers to Asterisk
4. **Asterisk registers** → DN 1002 to T-Server
5. **T-Server knows:** DN 1002 = Asterisk IP
6. **BUT T-Server doesn't know HOW to control calls on DN 1002** ❌

---

## Call Flow Comparison

### Genesys Native WebRTC: Incoming Call

```
1. External Call → T-Server → DN 1002
2. T-Server sends INVITE → Media Layer (DN 1002's SIP endpoint)
3. Media Layer → 180 Ringing → T-Server
4. T-Server → EventRinging → GIS → WWE
5. WWE → Answer command → GIS → T-Server
6. T-Server sends 200 OK → Media Layer (for DN 1002)  ← KEY!
7. Media Layer answers call → RTP media established
8. T-Server → EventEstablished → GIS → WWE
```

**Critical:** T-Server has **full SIP call control** over the Media Layer endpoint.

### Your Setup: Incoming Call (Current - Broken)

```
1. External Call → T-Server → DN 1002
2. T-Server sends INVITE → Asterisk (DN 1002 is registered there)
3. Asterisk → WebRTC Client → 180 Ringing
4. Asterisk → 180 Ringing → T-Server
5. T-Server → EventRinging → GIS → WWE
6. WWE → Answer command → GIS → T-Server
7. T-Server needs to send 200 OK... but WHERE?
   - T-Server doesn't control Asterisk
   - T-Server doesn't know about the WebRTC client
   - NO SIP MESSAGING PATH TO ANSWER THE CALL ❌
```

---

## The Missing Piece: SIP Call Control Integration

### What Genesys Media Layer Does (That We Don't Have)

1. **Acts as a SIP B2BUA (Back-to-Back User Agent)**
   - One SIP leg to T-Server (for DN 1002)
   - One WebRTC leg to the browser
   - Bridges the two legs

2. **Responds to T-Server SIP commands**
   - INVITE → Creates WebRTC session
   - 200 OK → Answers the WebRTC call
   - BYE → Hangs up the WebRTC call
   - REFER → Transfers the call

3. **Maintains SIP Dialog State**
   - T-Server thinks it's talking to DN 1002's phone
   - Actually it's talking to the Media Layer
   - Media Layer controls the browser's WebRTC session

---

## Solution Options

### Option 1: Implement Genesys-Style Media Layer (Complex)

Build a SIP B2BUA that mimics Genesys Media Layer:

**Architecture:**
```
T-Server (SIP) ←→ Python/Node.js B2BUA ←→ WebRTC Client (Browser)
```

**Implementation:**
1. B2BUA registers DN 1002 to T-Server (not Asterisk)
2. T-Server sends INVITE to B2BUA
3. B2BUA creates WebRTC Offer → sends to Browser via WebSocket
4. Browser creates Answer → sends back to B2BUA
5. B2BUA sends 200 OK to T-Server
6. RTP/SRTP media flows through B2BUA

**Pros:**
- WWE works in native 3PCC mode
- T-Server has full call control
- Standard Genesys architecture

**Cons:**
- Complex SIP B2BUA implementation
- Need to handle media bridging (RTP ↔ SRTP)
- ICE/STUN/TURN complexity
- State synchronization

---

### Option 2: Use Genesys Native WebRTC (Recommended)

**Just use Genesys's official WebRTC solution!**

Components needed:
1. **Genesys Media Layer** (server-side)
2. **WebRTC Media Server** license
3. WWE configured for Genesys WebRTC

**Why not use this?**
- Licensing costs?
- Not available in your Genesys version?
- Custom requirements?

---

### Option 3: Make T-Server Control Asterisk (Medium Complexity)

**Implement Asterisk as a Genesys Switch:**

1. **Create a T-Server Driver for Asterisk**
   - Listens to Asterisk AMI events
   - Translates AMI events to T-Server CTI events
   - Translates T-Server commands to Asterisk AMI actions

2. **Configure T-Server**
   - Add Asterisk as a Switch
   - DNs 1002, 1003 belong to "Asterisk_Switch"
   - T-Server sends commands to the driver

3. **Driver Handles Call Control**
   ```
   T-Server: AnswerCall(DN=1002, ConnID=xxx)
   → Driver: AMI Action: Atxfer channel to Answer
   → Asterisk: Answers the call
   ```

**Pros:**
- WWE works in 3PCC mode
- Asterisk handles media and WebRTC
- Genesys has full visibility

**Cons:**
- Need to write a T-Server driver
- Complex protocol mapping
- Requires T-Server SDK knowledge

---

### Option 4: Switch to SIP Endpoint Control Mode (Easiest)

**Make WWE control the WebRTC client directly:**

1. **Configure Device for External Control**
   ```
   Device Annex:
   [voice]
   media-type = sip-endpoint
   control-mode = endpoint
   ```

2. **WWE Changes Behavior**
   - Instead of sending Answer to T-Server
   - Sends Answer to `https://127.0.0.1:8000/AnswerCall`
   - Electron bridge forwards to WebRTC client

3. **Implement Missing Bridge APIs**
   - `/AnswerCall` → JsSIP session.answer()
   - `/HoldCall` → JsSIP session.hold()
   - `/ResumeCall` → JsSIP session.unhold()
   - `/TransferCall` → JsSIP session.refer()

**Pros:**
- Simplest implementation
- No T-Server driver needed
- Asterisk handles all SIP/media

**Cons:**
- T-Server has limited visibility
- Not "standard" Genesys architecture
- May lose some CTI features

---

## What Genesys Media Layer Actually Is

It's essentially:
1. **Janus Gateway** or similar WebRTC server
2. **SIP User Agent** (like PJSIP or FreeSWITCH)
3. **Media Bridge** (RTP ↔ WebRTC)
4. **Signaling Bridge** (SIP ↔ WebSocket)

**You've effectively replicated parts of this with Asterisk!**
- Asterisk = SIP User Agent + Media Bridge
- But missing: T-Server SIP call control integration

---

## Recommended Path Forward

### Short Term: Implement Option 4 (SIP Endpoint Control)

1. **Add missing APIs to Electron Bridge:**

```javascript
// webrtc-gateway-bridge/src/main.js

ipcMain.handle('answer-call', async (event, data) => {
  // Forward to WebRTC client iframe
  mainWindow.webContents.send('answer-call', data);
  return { success: true };
});

ipcMain.handle('hold-call', async (event, data) => {
  mainWindow.webContents.send('hold-call', data);
  return { success: true };
});

ipcMain.handle('hangup-call', async (event, data) => {
  mainWindow.webContents.send('hangup-call', data);
  return { success: true };
});
```

2. **Implement in WebRTC client:**

```javascript
// wwe-webrtc-gateway.html

window.addEventListener('message', (event) => {
  if (event.data.action === 'answer-call') {
    if (currentSession) {
      currentSession.answer({
        mediaConstraints: { audio: true, video: false }
      });
    }
  }
});
```

3. **Configure Genesys device for external control**

### Long Term: Consider Option 2 (Genesys Native)

If budget allows, migrate to Genesys's official WebRTC solution for full feature parity.

---

## Summary

**Genesys Native WebRTC works because:**
- T-Server has full SIP control over the Media Layer
- Media Layer acts as B2BUA between T-Server and Browser
- WWE uses standard 3PCC mode

**Your setup doesn't work because:**
- T-Server has NO control over Asterisk/WebRTC client
- Asterisk registers DNs, but T-Server can't control the calls
- Missing: SIP call control integration layer

**Fix:** Either implement the missing integration (Option 3) or switch to endpoint control mode (Option 4).

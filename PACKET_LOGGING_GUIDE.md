# 🔍 Complete Packet-by-Packet Logging Guide

## ✅ What's Been Enabled

I've added comprehensive logging that tracks **every phase** of a WebRTC call, from browser startup to live audio streaming.

---

## 🚀 How to Deploy & Use

### Step 1: Deploy to Linux Server

```bash
# SSH to your server
ssh Gencct@192.168.210.54

# Navigate to project
cd /home/Gencct/webrtc-genesys

# Pull latest changes
git pull origin main

# Copy updated file to Nginx
sudo docker cp nginx/html/wwe-webrtc-gateway.html webrtc-nginx:/usr/share/nginx/html/

echo "✅ Deployment complete!"
```

### Step 2: Open Browser Console

1. Open Chrome/Firefox
2. Navigate to: `https://192.168.210.54:8443/wwe-demo.html`
3. Press **F12** to open Developer Tools
4. Go to **Console** tab
5. Keep it open during the entire call process

### Step 3: Make a Test Call

```
Sign In:
- Agent ID: agent123
- DN: 5001
- Password: Genesys2024!WebRTC
- SIP Server: wss://192.168.210.54:8443/ws

Make Call:
- Destination: 1003 (or 5002 for agent-to-agent)
```

---

## 📊 What You'll See in Console

### 🟢 **PHASE 0** — Initialization
```
🟢 PHASE 0 - WebRTC Gateway initialized
```

### 🟢 **PHASE 1** — WebSocket Connection
```
🟢 PHASE 1 - WebSocket connecting to: wss://192.168.210.54:8443/ws
✅ WebSocket OPEN
📡 Connecting to SIP server: wss://192.168.210.54:8443/ws
🔧 JsSIP Configuration: { ... }
🚀 Starting JsSIP UA...
✅ SIP WebSocket connected
```

You'll see actual SIP messages:
```
⬆️ WS TX: REGISTER sip:192.168.210.81 SIP/2.0...
⬇️ WS RX: SIP/2.0 200 OK...
✅ SIP registered successfully
```

### 🟢 **PHASE 2** — Microphone Access
```
🟢 PHASE 2 - Requesting microphone access
```
*(Browser will prompt for mic permission)*

### 🟢 **PHASE 3** — Call Intent
```
🟢 PHASE 3 - Making call to 1003
📞 Calling sip:1003@192.168.210.54
```

### 🟢 **PHASE 4** — SDP Offer Creation
```
🟢 PHASE 4 - Creating SDP offer
🟢 PHASE 4 - SDP OFFER:
v=0
o=- 1234567890 2 IN IP4 192.168.210.54
s=WebRTC Session
...
m=audio 12345 UDP/TLS/RTP/SAVPF 111 103 104
a=rtpmap:111 opus/48000/2
a=fingerprint:sha-256 AB:CD:EF:...
```

### 🟢 **PHASE 5** — ICE Candidate Gathering
```
🟢 PHASE 5 - ICE Gathering State: gathering
🧊 ICE Candidate: candidate:842163049 1 udp 1677729535 192.168.210.54 54321 typ srflx...
🧊 ICE Candidate: candidate:842163050 1 udp 2130706431 192.168.1.10 54322 typ host...
🟢 PHASE 5 - ICE Gathering State: complete
🧊 ICE Candidate gathering complete
```

### 🟢 **PHASE 6** — SIP INVITE Sent
```
⬆️ WS TX: INVITE sip:1003@192.168.210.81:5060 SIP/2.0
Via: SIP/2.0/WS ...
From: <sip:5001@192.168.210.54>
To: <sip:1003@192.168.210.81>
Content-Type: application/sdp
...
```

### 🟢 **PHASE 7** — SIP Response
```
⬇️ WS RX: SIP/2.0 180 Ringing
📞 Call progress (ringing)

⬇️ WS RX: SIP/2.0 200 OK
✅ Call accepted
```

### 🟢 **PHASE 8** — SDP Answer
```
🟢 PHASE 8 - SDP ANSWER:
v=0
o=Genesys 1234567890 1 IN IP4 192.168.210.124
...
m=audio 8000 RTP/AVP 0 101
a=rtpmap:0 pcmu/8000
```

### 🟢 **PHASE 9** — ICE Connectivity Checks
```
🟢 PHASE 9 - PeerConnection created
🧊 ICE Connection State: checking
🧊 ICE Connection State: connected
🔗 Connection State: connecting
🔗 Connection State: connected
```

### 🟢 **PHASE 10** — DTLS Handshake
```
🟢 PHASE 10 - Call confirmed (DTLS handshake complete)
📡 Signaling State: stable
```

### 🟢 **PHASE 11** — Audio Streaming
```
🟢 PHASE 11 - Remote audio stream added
🟢 PHASE 11 - Remote audio track added
```

**At this point, you should hear audio!** 🎤🔊

---

## 🔧 Additional Logging Options

### Enable Even More Detailed JsSIP Logging

Add to browser console manually:
```javascript
// See EVERY SIP message detail
localStorage.setItem('debug', 'JsSIP:*');
localStorage.setItem('debugLevel', 'debug');
```

Then refresh the page.

### Kamailio SIP Packet Logging

On the server:
```bash
# Enable Kamailio debug mode
sudo docker exec webrtc-kamailio kamctl params set debug 3

# Watch live SIP traffic
sudo docker logs -f webrtc-kamailio | grep -E "INVITE|200 OK|REGISTER|BYE"
```

### Asterisk SIP Logging

```bash
# Enable PJSIP packet logging
sudo docker exec webrtc-asterisk asterisk -rx 'pjsip set logger on'

# Watch live
sudo docker logs -f webrtc-asterisk | grep -E "INVITE|200|SDP"
```

### Capture Network Packets (tcpdump)

```bash
# Capture all SIP/RTP traffic on server
sudo tcpdump -i any -s 0 -A '(port 5060 or port 8080 or portrange 10000-20000)' -w webrtc-call.pcap

# Analyze with Wireshark on your Windows workstation
# Transfer the file: scp Gencct@192.168.210.54:webrtc-call.pcap .
```

---

## 📋 Quick Reference - What Each Phase Shows

| Phase | What's Happening | Where to Look | Key Messages |
|-------|------------------|---------------|--------------|
| **0** | Page load | Browser Console | `Gateway initialized` |
| **1** | WebSocket connect | Console + Kamailio | `WebSocket connecting`, `WS OPEN` |
| **2** | Mic access | Browser Popup | Permission dialog |
| **3** | Call intent | Console | `Making call to X` |
| **4** | SDP Offer | Console | `SDP OFFER:` with media details |
| **5** | ICE gathering | Console | `ICE Candidate:` (multiple) |
| **6** | SIP INVITE | Console + Kamailio | `WS TX: INVITE` |
| **7** | SIP response | Console + Asterisk | `180 Ringing`, `200 OK` |
| **8** | SDP Answer | Console | `SDP ANSWER:` |
| **9** | ICE checks | Console | `ICE Connection State: checking` |
| **10** | DTLS handshake | Console | `Call confirmed` |
| **11** | RTP audio | Console | `Remote audio stream added` |

---

## 🐛 Troubleshooting

### If You Don't See Logs:

1. **Check console is open**: Press F12
2. **Clear console**: Click 🚫 icon
3. **Refresh page**: Ctrl+F5
4. **Check filter**: Remove any console filters

### If Logging is Too Verbose:

```javascript
// In browser console, disable JsSIP detailed logs:
JsSIP.debug.disable();

// Then refresh
```

### Save Console Output:

1. Right-click in console
2. Select **"Save as..."**
3. Save to file for analysis

---

## ✅ Success Indicators

You should see **all these in sequence**:

1. ✅ WebSocket OPEN
2. ✅ SIP registered successfully  
3. ✅ ICE Candidate gathering complete
4. ✅ Call accepted
5. ✅ ICE Connection State: connected
6. ✅ Call confirmed
7. ✅ Remote audio stream added

If any step fails, the logs will show **exactly** where and why! 🎯

---

## 📊 Example Complete Call Flow Output

```
[12:00:00.001] 🟢 PHASE 0 - WebRTC Gateway initialized
[12:00:00.050] 🟢 PHASE 1 - WebSocket connecting to: wss://192.168.210.54:8443/ws
[12:00:00.120] ✅ WebSocket OPEN
[12:00:00.150] 🚀 Starting JsSIP UA...
[12:00:00.200] ⬆️ WS TX: REGISTER sip:192.168.210.81 SIP/2.0
[12:00:00.250] ⬇️ WS RX: SIP/2.0 200 OK
[12:00:00.260] ✅ SIP registered successfully
[12:00:05.100] 🟢 PHASE 3 - Making call to 1003
[12:00:05.110] 🟢 PHASE 2 - Requesting microphone access
[12:00:05.120] 🟢 PHASE 4 - Creating SDP offer
[12:00:05.200] 🟢 PHASE 4 - SDP OFFER: v=0 o=- 123456...
[12:00:05.220] 🟢 PHASE 5 - ICE Gathering State: gathering
[12:00:05.350] 🧊 ICE Candidate: candidate:842163049 1 udp...
[12:00:05.450] 🧊 ICE Candidate: candidate:842163050 1 udp...
[12:00:05.550] 🟢 PHASE 5 - ICE Gathering State: complete
[12:00:05.600] ⬆️ WS TX: INVITE sip:1003@192.168.210.81:5060...
[12:00:05.700] ⬇️ WS RX: SIP/2.0 180 Ringing
[12:00:05.710] 📞 Call progress (ringing)
[12:00:06.500] ⬇️ WS RX: SIP/2.0 200 OK
[12:00:06.510] ✅ Call accepted
[12:00:06.520] 🟢 PHASE 8 - SDP ANSWER: v=0 o=Genesys...
[12:00:06.600] 🟢 PHASE 9 - PeerConnection created
[12:00:06.650] 🧊 ICE Connection State: checking
[12:00:06.750] 🧊 ICE Connection State: connected
[12:00:06.800] 🟢 PHASE 10 - Call confirmed (DTLS handshake complete)
[12:00:06.850] 🟢 PHASE 11 - Remote audio stream added
[12:00:06.900] 🟢 PHASE 11 - Remote audio track added
```

**🎉 Call successfully established in ~1.8 seconds!**

---

*Last Updated: December 22, 2025*


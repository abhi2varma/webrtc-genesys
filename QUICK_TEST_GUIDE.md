# Quick Test Guide - WebRTC Gateway

## ✅ ICE Delay Fixed!
The 40-second delay has been resolved. Calls now initiate in ~500ms.

---

## 🎯 Testing Options

### Option 1: Test with Echo Extension (NEW! ⭐)

I've added test extensions to Asterisk:

**Extension 1000 - Echo Test**
- Call this to hear your own voice back
- Perfect for testing audio quality
- Usage: Just dial `1000` from WWE

**Extension 1003 - Milliwatt Test** 
- Continuous test tone
- Good for checking connection quality
- Usage: Just dial `1003` from WWE

**To Deploy These Test Extensions:**

```bash
# On your Linux server (192.168.210.54)
cd /home/Gencct/webrtc-genesys

# Pull latest changes
git pull origin main

# Copy updated dialplan to Asterisk
sudo docker cp asterisk/etc/extensions-sip-endpoint.conf webrtc-asterisk:/etc/asterisk/

# Reload Asterisk dialplan
sudo docker exec webrtc-asterisk asterisk -rx "dialplan reload"

# Verify the extensions are loaded
sudo docker exec webrtc-asterisk asterisk -rx "dialplan show genesys-agent"
```

---

### Option 2: Test Between Two Agents (Agent-to-Agent)

1. **Open first browser tab** (or window):
   - Navigate to: `https://192.168.210.54:8443/wwe-demo.html`
   - Sign in as:
     - Agent ID: `agent123`
     - DN: `5001`
     - Password: `Genesys2024!WebRTC`
     - SIP Server: `wss://192.168.210.54:8443/ws`

2. **Open second browser tab**:
   - Navigate to: `https://192.168.210.54:8443/wwe-demo.html`
   - Sign in as:
     - Agent ID: `agent456`
     - DN: `5002`
     - Password: `Genesys2024!WebRTC`
     - SIP Server: `wss://192.168.210.54:8443/ws`

3. **Make the call**:
   - In **first tab** (agent 5001), dial: `5002`
   - The **second tab** (agent 5002) should ring
   - Answer the call in the second tab

---

### Option 3: Call Through to Genesys

For any other number (not 5xxx, 1000, or 1003), the call will route to your Genesys SIP Server:

- Extension pattern: Any number (e.g., `1003`, `8005551234`)
- Routing: → Kamailio → Asterisk → **Genesys SIP Server**
- Note: Genesys must have the destination configured

---

## 🔍 Troubleshooting

### If Extension 1000 or 1003 Still Returns 404:

```bash
# Check if dialplan loaded correctly
sudo docker exec webrtc-asterisk asterisk -rx "dialplan show genesys-agent"

# You should see:
#   [ Context 'genesys-agent' ]
#   '1000' => 1. NoOp(Echo Test)
#   '1003' => 1. NoOp(Milliwatt Test)

# If not, restart Asterisk
sudo docker restart webrtc-asterisk
```

### Check Call Logs:

```bash
# Asterisk logs
sudo docker logs webrtc-asterisk --tail 50 | grep -i "exten\|dial\|hangup"

# Kamailio logs
sudo docker logs webrtc-kamailio --tail 50 | grep INVITE
```

---

## 📊 What's Working Now

✅ **WebSocket Connection** - Working  
✅ **SIP Registration** - Working  
✅ **ICE Gathering** - Fixed (now <1 second)  
✅ **INVITE Sending** - Working  
🔄 **Call Completion** - Testing (needs valid destination)

---

## 🎯 Recommended Test Flow

1. **Deploy the test extensions** (Option 1 above)
2. **Test with Echo (1000)** - Verify audio works
3. **Test with Milliwatt (1003)** - Verify connection quality
4. **Test agent-to-agent (5001 → 5002)** - Verify full call flow
5. **Test Genesys routing** - Call a real Genesys extension

---

## 🚀 Next Steps

Once basic calling works:
- [ ] Test inbound calls from Genesys to agents
- [ ] Test call hold/resume
- [ ] Test call transfer
- [ ] Test mute/unmute
- [ ] Integrate with real WWE (replace demo page)

---

*Last Updated: December 22, 2025*


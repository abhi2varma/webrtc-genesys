# Deploy Kamailio SDP Filtering for CN Removal (Bug #13 - Attempt 3)

## Problem
- Dialplan-level codec restriction (`SIP_CODEC_INBOUND/OUTBOUND`) did NOT prevent Asterisk from forwarding CN packets
- Asterisk still receiving/forwarding CN from Genesys SIP Endpoint (1003)
- CN packets appear every ~30 seconds during silence
- DTLS closes after 33 seconds due to "unknown payload type 13" warnings

## Root Cause
**Asterisk is forwarding CN packets received from Genesys**, even though:
- Client-side SDP filtering removes CN from WebRTC client
- Dialplan variables restrict codecs in Asterisk

The issue: **Asterisk never negotiated CN directly with Genesys**, but Genesys is sending CN anyway!

## Solution
**Filter CN from SDP at the Kamailio level BEFORE it reaches Asterisk**. This prevents Asterisk from ever seeing CN in the SDP, so it won't accept or forward CN packets.

### Changes Made
1. Added `sdpops.so` module to Kamailio
2. Added `sdp_remove_line_by_prefix("a=rtpmap:13")` to remove CN rtpmap
3. Added `sdp_remove_codecs_by_id("13")` to remove codec 13 from m=audio lines
4. Applied filtering in:
   - `route[MEDIA_OFFER]` - Filters INVITE SDP from Genesys → Asterisk
   - Reply routes - Filters 200 OK SDP from Asterisk → Genesys

## Deployment Steps

### 1. SSH to Server
```bash
ssh Gencct@103.167.180.166
cd /opt/gcti_apps/webrtc-genesys
```

### 2. Pull Latest Changes
```bash
sudo git pull origin main
```

### 3. Copy Updated Kamailio Config
```bash
sudo docker cp kamailio/kamailio-proxy.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg
```

### 4. Verify Config
```bash
docker exec webrtc-kamailio kamailio -c -f /etc/kamailio/kamailio.cfg
```

**Expected Output:** `config file ok, exiting...`

### 5. Restart Kamailio (FULL RESTART REQUIRED - New Module Loaded)
```bash
docker restart webrtc-kamailio
```

### 6. Verify Kamailio Started
```bash
docker logs --tail 30 webrtc-kamailio | grep -E "listening|ERROR"
```

**Expected Output:**
```
INFO: <core> [core/udp_server.c:154]: probe_max_receive_buffer(): SO_RCVBUF is finally 425984
INFO: <core> [main.c:3058]: main(): processes (at least): 13 - shm size: 67108864 - pkg size: 8388608
Listening on 
             udp: 192.168.210.54 [192.168.210.54]:5070
             tcp: 192.168.210.54 [192.168.210.54]:5070
             tcp: 192.168.210.54 [192.168.210.54]:8080
```

### 7. Test Call
1. **Restart Electron with clean cache**
   ```powershell
   taskkill /F /IM electron.exe 2>nul & ping 127.0.0.1 -n 3 >nul & rmdir /S /Q "%USERPROFILE%\AppData\Roaming\webrtc-gateway-bridge" 2>nul & cd D:\Abhi\WebRTC\webrtc-genesys\webrtc-gateway-bridge && npm start -- --clear-cache
   ```

2. **Login as 1002** in Electron

3. **Make call:** 1003 → 1002

4. **Monitor RTPengine** (on server):
   ```bash
   docker logs -f webrtc-rtpengine | grep -E "unknown payload|DTLS peer has closed|Confirmed peer"
   ```

5. **Monitor Kamailio** (on server - new terminal):
   ```bash
   docker logs -f webrtc-kamailio | grep -E "Removed CN|MEDIA_OFFER|rtpengine"
   ```

### 8. Verify Success

**✅ Good Signs:**
```
# Kamailio should log:
INFO: 🔇 Removed CN (payload type 13) from SDP

# RTPengine should show:
INFO: Confirmed peer address as 192.168.210.54:XXXXX
```

- **NO** "RTP packet with unknown payload type 13" warnings
- **NO** "DTLS peer has closed the connection" messages
- Call stays active > 60 seconds
- Audio remains clear

**❌ Still Broken:**
```
# RTPengine shows:
WARNING: RTP packet with unknown payload type 13 received from 192.168.210.54:XXXXX
INFO: DTLS peer has closed the connection
```

- CN warnings still appear
- DTLS closes at ~30 seconds
- Audio cuts out at 35-40 seconds

## Rollback (If Needed)
```bash
cd /opt/gcti_apps/webrtc-genesys
sudo git checkout HEAD~1 kamailio/kamailio-proxy.cfg
sudo docker cp kamailio/kamailio-proxy.cfg webrtc-kamailio:/etc/kamailio/kamailio.cfg
docker restart webrtc-kamailio
```

## Technical Details

### What Changed in Kamailio Config

**Module Added:**
```cfg
loadmodule "sdpops.so"
```

**SDP Filtering in OFFER:**
```cfg
route[MEDIA_OFFER] {
    if (has_body("application/sdp")) {
        sdp_remove_line_by_prefix("a=rtpmap:13");
        sdp_remove_codecs_by_id("13");
        xlog("L_INFO", "🔇 Removed CN (payload type 13) from SDP\n");
    }
    # ... rtpengine_offer() ...
}
```

**SDP Filtering in ANSWER:**
```cfg
onreply_route[MANAGE_REPLY] {
    if (status =~ "^(18[0-9]|200)$" && has_body("application/sdp")) {
        sdp_remove_line_by_prefix("a=rtpmap:13");
        sdp_remove_codecs_by_id("13");
        xlog("L_WARN", "🔇 Removed CN from answer SDP\n");
        # ... rtpengine_answer() ...
    }
}
```

### Why This Works

1. **Prevents SDP Negotiation:** Kamailio removes CN from SDP BEFORE Asterisk sees it
2. **Blocks Forwarding:** If Asterisk never negotiates CN with Genesys, it won't forward CN packets
3. **Bidirectional:** Filters both INVITE (offer) and 200 OK (answer) SDP
4. **Early Stage:** Happens before RTPengine processing, ensuring clean SDP throughout

### Call Flow with Fix

```
Genesys (1003) 
  ↓ INVITE with CN in SDP
Kamailio 
  ↓ REMOVE CN from SDP ✂️
  ↓ INVITE without CN
Asterisk
  ↓ Negotiates only ulaw/alaw
  ↓ INVITE without CN
RTPengine
  ↓ INVITE without CN
WebRTC Client (1002)
```

**Result:** No CN in SDP = No CN in RTP stream = No DTLS closure!

## Testing Priority
**CRITICAL** - This is the third attempt to fix Bug #13. If this fails, we may need to:
1. Configure Genesys SIP Endpoint to not send CN
2. Use Asterisk transcoding to drop unknown payload types
3. Implement RTPengine filtering for payload type 13

## Related Bugs
- **Bug #11:** RTP timeout (increased timeouts) ✅ Fixed
- **Bug #12:** Client-side DTLS timeout (SDP filtering in browser) ✅ Fixed
- **Bug #13 Attempt 1:** Asterisk `comfort_noise=no` ❌ Parameter unsupported
- **Bug #13 Attempt 2:** Dialplan `SIP_CODEC_INBOUND/OUTBOUND` ❌ Didn't prevent forwarding
- **Bug #13 Attempt 3:** Kamailio SDP filtering (THIS FIX) ⏳ Testing

## Notes
- **FULL RESTART REQUIRED** for Kamailio (new module loaded)
- Changes apply to all calls immediately after restart
- Monitor both Kamailio and RTPengine logs during test
- Watch for "Removed CN" messages in Kamailio logs
- If still seeing CN packets, source may be Genesys configuration

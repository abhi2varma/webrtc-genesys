# Deploy Dialplan-Level Comfort Noise Fix (Bug #13)

## Problem
- RTPengine logs show: `RTP packet with unknown payload type 13 received`
- DTLS closes connection ~30 seconds after call starts
- Asterisk is generating Comfort Noise (CN) packets at RTP level, even though client-side SDP filtering removes CN

## Solution
- Add `SIP_CODEC_INBOUND=ulaw,alaw` and `SIP_CODEC_OUTBOUND=ulaw,alaw` to all dialplan contexts
- This forces Asterisk to only use ulaw and alaw codecs, explicitly excluding CN
- Works at the channel level, preventing CN generation at RTP level

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

### 3. Copy Updated Dialplan to Container
```bash
sudo docker cp asterisk/etc/extensions-sip-endpoint.conf webrtc-asterisk:/etc/asterisk/extensions-sip-endpoint.conf
```

### 4. Reload Asterisk Dialplan (NO RESTART NEEDED)
```bash
docker exec webrtc-asterisk asterisk -rx "dialplan reload"
```

### 5. Verify Dialplan Changes
```bash
docker exec webrtc-asterisk asterisk -rx "dialplan show genesys-agent" | head -30
docker exec webrtc-asterisk asterisk -rx "dialplan show from-genesys" | head -30
```

**Expected Output:** You should see `Set(SIP_CODEC_INBOUND=ulaw,alaw)` and `Set(SIP_CODEC_OUTBOUND=ulaw,alaw)` in the dialplan.

### 6. Test Call
1. **Electron:** Restart with clean cache
2. **Make call:** 1003 → 1002
3. **Monitor RTPengine:**
   ```bash
   docker logs -f webrtc-rtpengine | grep -E "unknown payload|DTLS peer has closed|Confirmed peer"
   ```

### 7. Verify Success
**✅ Good Signs:**
- NO "RTP packet with unknown payload type 13" warnings
- NO "DTLS peer has closed the connection" messages
- Call duration > 60 seconds with continuous audio
- Audio quality remains stable

**❌ Still Broken:**
- "RTP packet with unknown payload type 13" warnings still appear
- "DTLS peer has closed" around 30 seconds
- Audio cuts out at 35-40 seconds

## Rollback (If Needed)
```bash
# Revert dialplan to previous version
cd /opt/gcti_apps/webrtc-genesys
sudo git checkout HEAD~1 asterisk/etc/extensions-sip-endpoint.conf
sudo docker cp asterisk/etc/extensions-sip-endpoint.conf webrtc-asterisk:/etc/asterisk/extensions-sip-endpoint.conf
docker exec webrtc-asterisk asterisk -rx "dialplan reload"
```

## Technical Details

### What Changed
Added to ALL dial patterns in `extensions-sip-endpoint.conf`:
```asterisk
same => n,Set(SIP_CODEC_INBOUND=ulaw,alaw)
same => n,Set(SIP_CODEC_OUTBOUND=ulaw,alaw)
```

### Affected Contexts
- `[genesys-agent]` - All outbound call patterns (_1XXX, _5XXX, _8[1-9]XXX, _X.)
- `[from-genesys]` - All inbound call patterns (_5XXX, _1XXX, _X.)

### Why This Works
1. `SIP_CODEC_INBOUND=ulaw,alaw` - Forces Asterisk to only accept ulaw/alaw from remote party
2. `SIP_CODEC_OUTBOUND=ulaw,alaw` - Forces Asterisk to only send ulaw/alaw to remote party
3. Explicitly excludes CN (payload type 13) at the channel level
4. Prevents Asterisk from generating CN packets during silence, even if CN was negotiated in SDP
5. Works in conjunction with client-side SDP filtering (Bug #12 fix)

### Testing Priority
**HIGH PRIORITY** - This is critical for call stability. Without this fix:
- Calls fail after 30-40 seconds
- DTLS-SRTP session breaks
- Audio cuts out completely
- No recovery possible without hangup/recall

## Related Bugs
- **Bug #12:** DTLS timeout due to Comfort Noise (client-side SDP filtering)
- **Bug #13:** Asterisk Comfort Noise generation (this fix - dialplan-level codec restriction)
- **Bug #11:** RTP timeout (increased timeouts in pjsip.conf and RTPengine)

## Notes
- This fix does NOT require Asterisk restart
- Dialplan reload is sufficient and does not drop active calls
- Changes apply to all future calls immediately after reload
- Client-side SDP filtering (Bug #12) is still necessary for defense-in-depth
- Together, these fixes ensure CN is removed from both SDP and RTP streams

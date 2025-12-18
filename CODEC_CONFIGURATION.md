# Codec Configuration - Force PCMU/PCMA

## Overview

The WebRTC gateway has been configured to force **PCMU (G.711 µ-law)** and **PCMA (G.711 A-law)** codecs instead of Opus for better compatibility with Genesys and traditional telephony systems.

## Why PCMU/PCMA?

### Advantages:
- ✅ **Universal compatibility** with legacy PBX systems and Genesys
- ✅ **Low latency** - no encoding/decoding overhead
- ✅ **Predictable bandwidth** (64 kbps per channel)
- ✅ **Better transcoding** when bridging calls
- ✅ **Consistent quality** across all platforms
- ✅ **Hardware support** on most telephony equipment

### Opus Considerations:
- ❌ Higher CPU usage for encoding/decoding
- ❌ May require transcoding when talking to Genesys
- ❌ Not supported by all legacy equipment
- ✅ Better for low-bandwidth scenarios (not typical for LAN deployments)

## Configuration Changes

### 1. Client-Side (WebRTC Browser)

**File:** `nginx/html/app.js`

#### Added SDP Manipulation Function:
```javascript
removeOpusCodec(sdp) {
    // Removes Opus codec from SDP offer/answer
    // Forces PCMU(0), PCMA(8), G722(9), telephone-event
    // Filters out high payload types (111, 63, 110, etc.)
}
```

#### Outgoing Calls:
- SDP offers are modified to remove Opus
- Only PCMU/PCMA are advertised
- Debug message shows: "Calling XXX... (PCMU/PCMA only)"

#### Incoming Calls:
- SDP answers are modified to remove Opus
- Client will only accept PCMU/PCMA
- Debug message shows: "Incoming call answered (PCMU/PCMA only)"

### 2. Server-Side (Asterisk)

**File:** `asterisk/etc/pjsip.conf`

#### WebRTC Endpoint Template:
```ini
[agent_dn](!)
type=endpoint
transport=transport-ws
context=genesys-agent
disallow=all
allow=ulaw,alaw        # CHANGED: Removed opus, prioritized ulaw/alaw
webrtc=yes
```

**Before:** `allow=opus,ulaw,alaw`  
**After:** `allow=ulaw,alaw`

#### Genesys Trunk Endpoint:
```ini
[genesys_sip_server]
type=endpoint
disallow=all
allow=ulaw,alaw,g722,opus    # Prioritizes ulaw/alaw, keeps opus/g722 as backup
```

## Codec Priority Order

### WebRTC Clients (5001, 5002, etc.):
1. **PCMU (G.711 µ-law)** - Payload type 0
2. **PCMA (G.711 A-law)** - Payload type 8
3. ~~Opus~~ - **Removed**

### Genesys Trunk:
1. **PCMU (G.711 µ-law)** - Primary
2. **PCMA (G.711 A-law)** - Primary
3. G722 - Fallback
4. Opus - Fallback

## Testing

### Verify Codec in Active Call:

```bash
# Check codec on active channel
sudo docker exec webrtc-asterisk asterisk -rx "core show channel PJSIP/5001-XXXXXXXX" | grep -i codec

# Check RTP codec
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show channels"
```

### Browser Console Check:

```javascript
// During active call, check negotiated codec
webrtcClient.session.connection.getStats().then(stats => {
    stats.forEach(stat => {
        if (stat.type === 'inbound-rtp' || stat.type === 'outbound-rtp') {
            console.log('Codec:', stat.codecId);
        }
    });
});
```

### Expected Results:

#### Asterisk Logs:
```
Audio is at 192.168.210.54 port 16920
Codec: 0 (ulaw)
```

#### Browser Debug Console:
```
✓ SDP modified: Forced PCMU/PCMA codecs
✓ Calling 1003... (PCMU/PCMA only)
✓ Remote audio stream added
```

#### SIP INVITE SDP:
```
m=audio 60895 UDP/TLS/RTP/SAVPF 0 8 9 126
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:9 G722/8000
a=rtpmap:126 telephone-event/8000
```

Notice: No Opus (payload type 111) present!

## Bandwidth Considerations

### PCMU/PCMA Bandwidth Usage:
- **Codec bitrate:** 64 kbps
- **With IP/UDP/RTP overhead:** ~80-88 kbps
- **For 10 concurrent calls:** ~800-880 kbps

### Compared to Opus:
- **Opus variable bitrate:** 6-510 kbps (typically 32-64 kbps for voice)
- **Savings:** Minimal in LAN environments
- **Trade-off:** Higher compatibility and lower latency with PCMU/PCMA

## Rollback Instructions

If you need to re-enable Opus:

### 1. Client-Side (app.js):
Comment out the SDP manipulation in `makeCall()` and `handleIncomingCall()`:

```javascript
// Comment out these lines:
// const origCreateOffer = peerconnection.createOffer.bind(peerconnection);
// peerconnection.createOffer = (options) => {
//     return origCreateOffer(options).then((offer) => {
//         offer.sdp = this.removeOpusCodec(offer.sdp);
//         return offer;
//     });
// };
```

### 2. Server-Side (pjsip.conf):
Change back to:
```ini
allow=opus,ulaw,alaw
```

### 3. Restart:
```bash
sudo docker restart webrtc-asterisk webrtc-nginx
```

## Troubleshooting

### Issue: No audio in calls

**Check:**
```bash
# Verify codecs are matched
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show channels"
```

**Solution:** Ensure both sides support PCMU or PCMA

### Issue: Call fails with 488 Not Acceptable

**Cause:** Remote side doesn't support PCMU/PCMA

**Solution:** Check Genesys codec configuration, or re-enable Opus

### Issue: One-way audio

**Check RTP:**
```bash
sudo docker exec webrtc-asterisk asterisk -rx "rtp show stats"
```

**Likely cause:** Firewall/NAT issues, not codec related

## Performance Monitoring

### Check Codec Statistics:

```bash
# Show codec translation paths
sudo docker exec webrtc-asterisk asterisk -rx "core show translation"

# Show codec usage
sudo docker exec webrtc-asterisk asterisk -rx "core show codecs"
```

### Expected Output:
```
Translation times between formats:
         ulaw |  alaw | 
   ulaw     - |    1 |
   alaw     1 |    - |
```

No Opus translation = No transcoding overhead!

## References

- **G.711 (PCMU/PCMA):** [RFC 5391](https://tools.ietf.org/html/rfc5391)
- **SDP Codec Negotiation:** [RFC 3264](https://tools.ietf.org/html/rfc3264)
- **WebRTC Audio Codecs:** [RFC 7874](https://tools.ietf.org/html/rfc7874)

---

**Last Updated:** Dec 18, 2025  
**Status:** ✅ Active - PCMU/PCMA enforced


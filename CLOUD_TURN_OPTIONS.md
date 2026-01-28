# Using Cloud TURN Services

## Free/Trial Options

### 1. Metered.ca (Free Tier)
- 50 GB/month free
- No credit card required

```javascript
iceServers: [
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'your-metered-username',
    credential: 'your-metered-password'
  }
]
```

Sign up: https://www.metered.ca/tools/openrelay/

### 2. Xirsys (Trial Available)
- Global TURN network
- 500 MB free trial

```javascript
iceServers: [
  { urls: 'stun:global.xirsys.net' },
  {
    urls: 'turn:global.xirsys.net:80?transport=udp',
    username: 'your-xirsys-username',
    credential: 'your-xirsys-credential'
  }
]
```

Sign up: https://xirsys.com/

### 3. Twilio (Paid, Most Reliable)
- Enterprise-grade
- $0.40 per GB

```javascript
// Get credentials via Twilio API
iceServers: [
  { urls: 'stun:global.stun.twilio.com:3478' },
  {
    urls: 'turn:global.turn.twilio.com:3478?transport=udp',
    username: 'your-twilio-username',
    credential: 'your-twilio-token'
  }
]
```

---

## How to Integrate Cloud TURN

Update `nginx/html/wwe-webrtc-gateway.html`:

```javascript
iceServers: [
  // Google STUN (free)
  { urls: 'stun:stun.l.google.com:19302' },
  
  // Your local TURN (when port forwarding is done)
  {
    urls: 'turn:103.167.180.166:3478',
    username: 'webrtc',
    credential: 'Genesys2024!SecureTurn'
  },
  
  // Cloud TURN fallback (Metered.ca example)
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'YOUR_METERED_USERNAME',
    credential: 'YOUR_METERED_PASSWORD'
  }
],
iceTransportPolicy: 'all'  // Try all options
```

The browser will automatically use whichever TURN server works!

---

## Cost Comparison

| Solution | Setup Time | Monthly Cost | Notes |
|----------|-----------|--------------|-------|
| **Port Forwarding** | 30 mins | $0 | Best for production |
| **Metered.ca Free** | 10 mins | $0 (50 GB) | Good for testing |
| **Xirsys** | 10 mins | $29-$99/mo | Medium scale |
| **Twilio** | 15 mins | ~$10-50/mo | Enterprise-grade |
| **AWS TURN Cluster** | 2-3 days | $50-200/mo | DIY enterprise |

---

## For Your Genesys Setup

Most **Genesys on-premise customers** use:

1. **Port forwarding** on edge router/firewall
2. **DMZ** with dedicated TURN server
3. Or **Genesys Cloud** (fully managed)

**Recommendation:** Configure port forwarding - it's a one-time 30-minute task and standard practice for enterprise WebRTC deployments.

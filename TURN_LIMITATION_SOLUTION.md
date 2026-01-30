# Asterisk TURN Limitation & Solution

## Problem Discovered

Asterisk's `res_rtp_asterisk` module **does NOT support TURN relay allocation**. It only supports:
- Host candidates (local IP addresses)
- STUN for server reflexive candidates (public IP discovery)

Evidence:
```bash
docker exec webrtc-asterisk asterisk -rx "rtp show settings"
# Shows: STUN address but NO TURN address
```

## Current Situation

### Working ✅
1. Browser **CAN** allocate TURN relay via Coturn
   - Generates relay candidates like: `103.167.180.166:10062`
2. Asterisk generates host candidates on port 10016
3. SIP signaling works perfectly
4. Call rings on both sides

### NOT Working ❌
1. Asterisk cannot allocate TURN relay
2. ICE candidates from Asterisk side fail to connect
3. Browser cannot reach Asterisk's host candidate (192.168.210.54:10016)
4. Connection fails with "ICE disconnected"

## Why Direct Connection Fails

Looking at the candidates:

**Asterisk offers:**
```
a=candidate:Hc0a8d236 1 UDP 2130706431 192.168.210.54 10016 typ host
```

**Browser tries to connect to:** `192.168.210.54:10016` (private IP)

**Problem:** Browser is at public IP `183.82.161.38` and cannot reach private IP `192.168.210.54` directly!

## Solution Options

### Option 1: Browser Uses TURN Relay (Current Attempt)
- Browser connects through TURN relay at `103.167.180.166:10062`
- Packets go: Browser → Coturn Relay → Asterisk
- **Issue:** Asterisk also needs to send through relay, but it can't allocate one

### Option 2: Fix Server-Side NAT/Routing ⭐ **RECOMMENDED**
Make Asterisk's host candidate reachable by configuring proper NAT:

1. **Asterisk should advertise public IP in candidates:**
   ```
   a=candidate:H67a7b4a6 1 UDP 2130706431 103.167.180.166 10016 typ host
   ```

2. **Server needs DNAT rule** to forward incoming UDP to Asterisk:
   ```bash
   sudo iptables -t nat -A PREROUTING -i ens160 -p udp --dport 10000:10100 -j DNAT --to-destination 192.168.210.54
   ```

3. **Already have SNAT/MASQUERADE** (done earlier):
   ```bash
   sudo iptables -t nat -A POSTROUTING -s 192.168.210.54 -o ens160 -j MASQUERADE
   ```

### Option 3: Use Asterisk with TURN Support
Upgrade to Asterisk with `res_pjsip` + `pjproject` TURN client support, or use a different SIP server that supports TURN relay.

## Next Steps

1. **Apply DNAT rule** on server for incoming RTP packets
2. **Configure Asterisk to advertise public IP** in ICE candidates
3. **Test direct RTP connection** Browser ← → Asterisk (public IP)
4. If direct fails, browser's TURN relay should still work for incoming audio

## Commands to Run on Server

```bash
# 1. Add DNAT rule for incoming RTP
sudo iptables -t nat -A PREROUTING -i ens160 -p udp --dport 10000:10100 -j DNAT --to-destination 192.168.210.54

# 2. Verify NAT rules
sudo iptables -t nat -L -n -v

# 3. Make rules persistent
sudo iptables-save > /etc/sysconfig/iptables

# 4. Pull latest config and restart Asterisk
cd /opt/gcti_apps/webrtc-genesys
git pull
docker restart webrtc-asterisk
```

## Expected Result

After applying DNAT:
- Browser can reach Asterisk at `103.167.180.166:10016`
- Packets get forwarded to `192.168.210.54:10016` (Asterisk)
- Asterisk responses get SNAT'd back to `103.167.180.166`
- ICE connection succeeds! ✅

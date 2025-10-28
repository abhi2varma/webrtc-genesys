# Troubleshooting Guide

Common issues and solutions for the Asterisk WebRTC system.

## Table of Contents

1. [WebSocket Connection Issues](#websocket-connection-issues)
2. [Audio Problems](#audio-problems)
3. [Registration Failures](#registration-failures)
4. [Genesys Integration Issues](#genesys-integration-issues)
5. [Container Issues](#container-issues)
6. [Network Issues](#network-issues)
7. [Performance Issues](#performance-issues)

---

## WebSocket Connection Issues

### Problem: Cannot connect to WebSocket

**Symptoms:**
- Client shows "Disconnected"
- Console error: "WebSocket connection failed"

**Solutions:**

1. **Check SSL certificates:**
```bash
# Verify certificates exist
ls -la certs/

# Test HTTPS
curl -k https://your-domain.com

# Check certificate validity
openssl x509 -in certs/cert.pem -text -noout
```

2. **Verify Nginx is running:**
```bash
docker ps | grep nginx
docker logs webrtc-nginx
```

3. **Check WebSocket proxy configuration:**
```bash
# Should show WebSocket upgrade headers
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://your-domain.com/ws
```

4. **Verify Asterisk HTTP module:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "http show status"
```

5. **Check firewall:**
```bash
sudo ufw status
# Ensure port 443 is open
```

### Problem: WebSocket connects but disconnects immediately

**Solutions:**

1. **Check Asterisk logs:**
```bash
docker logs -f webrtc-asterisk | grep -i websocket
```

2. **Verify transport configuration in pjsip.conf:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show transports"
```

3. **Check for certificate mismatch:**
- Ensure certificate CN/SAN matches your domain
- Browser may require manual certificate acceptance for self-signed certs

---

## Audio Problems

### Problem: No audio in one or both directions

**Symptoms:**
- Call connects but no audio
- One-way audio only

**Solutions:**

1. **Verify RTP ports are open:**
```bash
sudo ufw allow 10000:20000/udp
```

2. **Check public IP configuration:**
```bash
# In asterisk/etc/pjsip.conf
# Ensure external_media_address is set correctly
docker exec -it webrtc-asterisk asterisk -rx "pjsip show transports"
```

3. **Enable RTP debugging:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "rtp set debug on"
docker logs -f webrtc-asterisk | grep RTP
```

4. **Check ICE/STUN configuration:**
```bash
# Verify STUN server is reachable
docker exec -it webrtc-asterisk asterisk -rx "stun show status"
```

5. **Verify TURN server:**
```bash
# Check Coturn logs
docker logs webrtc-coturn

# Test TURN connectivity
docker exec -it webrtc-asterisk asterisk -rx "rtp show settings"
```

### Problem: Choppy or poor quality audio

**Solutions:**

1. **Check network latency:**
```bash
ping -c 100 your-server-ip
```

2. **Verify codec configuration:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "core show codecs"
# Prefer: opus, ulaw, alaw
```

3. **Check CPU usage:**
```bash
docker stats
```

4. **Adjust jitter buffer:**
```bash
# Edit asterisk/etc/rtp.conf
# Add: jbenable=yes
# Add: jbmaxsize=200
```

5. **Check bandwidth:**
```bash
# Monitor network usage
docker exec -it webrtc-asterisk asterisk -rx "rtp show stats"
```

---

## Registration Failures

### Problem: Cannot register WebRTC client

**Symptoms:**
- Client shows "Registration failed"
- 401 Unauthorized or 403 Forbidden errors

**Solutions:**

1. **Verify credentials:**
```bash
# Check configured users
docker exec -it webrtc-asterisk asterisk -rx "pjsip show auths"
```

2. **Check endpoint configuration:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint 1000"
```

3. **Review Asterisk logs:**
```bash
docker logs -f webrtc-asterisk | grep -i auth
```

4. **Verify transport:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show transports"
# Ensure WSS transport is active
```

5. **Check realm/domain:**
- Ensure SIP URI matches expected domain
- Domain should match certificate CN

### Problem: Registration succeeds but expires immediately

**Solutions:**

1. **Check NAT keepalive:**
```bash
# Edit asterisk/etc/pjsip.conf
# Ensure: qualify_frequency=30
```

2. **Verify WebSocket keepalive:**
```bash
# Check kamailio/kamailio.cfg
# Ensure: keepalive_timeout=30
```

3. **Check client-side keepalive:**
- JsSIP should send keepalive packets
- Check browser console for WebSocket activity

---

## Genesys Integration Issues

### Problem: Cannot connect to Genesys SIP trunk

**Symptoms:**
- Outbound calls fail
- No registration with Genesys
- 503 Service Unavailable

**Solutions:**

1. **Verify Genesys credentials:**
```bash
# Check configuration
cat asterisk/etc/pjsip.conf | grep -A 10 genesys_trunk
```

2. **Test connectivity:**
```bash
# Ping Genesys server
docker exec -it webrtc-asterisk ping -c 5 GENESYS_SIP_HOST

# Check if port is reachable
docker exec -it webrtc-asterisk nc -zv GENESYS_SIP_HOST 5060
```

3. **Check registration status:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show registrations"
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoint genesys_trunk"
```

4. **Enable SIP debugging:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"
docker logs -f webrtc-asterisk | grep -i genesys
```

5. **Check authentication:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show auths"
# Verify genesys_auth is present with correct credentials
```

### Problem: Inbound calls from Genesys not working

**Solutions:**

1. **Verify Genesys can reach your server:**
```bash
# Check if traffic is arriving
sudo tcpdump -i any -n port 5060
```

2. **Check identify configuration:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "pjsip show identifies"
# Should show genesys-identify matching Genesys IP
```

3. **Verify dialplan:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "dialplan show from-genesys"
```

4. **Check for IP whitelisting:**
- Ensure your public IP is whitelisted in Genesys portal
- Verify firewall rules allow inbound from Genesys

### Problem: One-way audio with Genesys

**Solutions:**

1. **Check RTP symmetric:**
```bash
# In pjsip.conf [genesys_trunk]
# Ensure: rtp_symmetric=yes
# Ensure: direct_media=no
```

2. **Verify NAT settings:**
```bash
# Ensure: force_rport=yes
# Ensure: rewrite_contact=yes
```

3. **Check Kamailio RTP engine:**
```bash
docker logs webrtc-kamailio | grep -i rtpengine
```

---

## Container Issues

### Problem: Container won't start

**Solutions:**

1. **Check logs:**
```bash
docker-compose logs [service-name]
```

2. **Check port conflicts:**
```bash
sudo netstat -tulpn | grep -E '5060|8088|443'
```

3. **Verify Docker resources:**
```bash
docker system df
# Clean up if needed:
docker system prune -a
```

4. **Check configuration syntax:**
```bash
# For Asterisk
docker run --rm -v $(pwd)/asterisk/etc:/etc/asterisk asterisk:latest asterisk -rx "core show config"

# For Kamailio
docker run --rm -v $(pwd)/kamailio:/etc/kamailio kamailio/kamailio:latest kamailio -c
```

### Problem: Container keeps restarting

**Solutions:**

1. **Check exit code:**
```bash
docker-compose ps
docker inspect --format='{{.State.ExitCode}}' webrtc-asterisk
```

2. **Review recent logs:**
```bash
docker logs --tail 100 webrtc-asterisk
```

3. **Check file permissions:**
```bash
ls -la asterisk/etc/
# Should be readable by container user
```

4. **Verify volume mounts:**
```bash
docker inspect webrtc-asterisk | grep -A 10 Mounts
```

---

## Network Issues

### Problem: NAT traversal not working

**Solutions:**

1. **Verify STUN configuration:**
```bash
# Test STUN server
docker exec -it webrtc-asterisk stunclient stun.l.google.com
```

2. **Check TURN server:**
```bash
docker logs webrtc-coturn
docker exec -it webrtc-coturn turnserver --version
```

3. **Verify ICE candidates:**
```bash
# Enable WebRTC debugging in browser
# Check ICE candidates in console
```

4. **Test with different STUN/TURN servers:**
```javascript
// In client configuration
pcConfig: {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { 
            urls: 'turn:your-domain.com:3478',
            username: 'webrtc',
            credential: 'your-secret'
        }
    ]
}
```

### Problem: High latency or packet loss

**Solutions:**

1. **Check network quality:**
```bash
# MTR for detailed network analysis
mtr -r -c 100 your-server-ip
```

2. **Verify QoS settings:**
```bash
# Check if QoS markings are preserved
sudo iptables -L -v -n | grep TOS
```

3. **Optimize RTP settings:**
```bash
# Edit asterisk/etc/rtp.conf
# Add: rtcpinterval=5000
```

4. **Check for bandwidth throttling:**
```bash
# Test bandwidth
iperf3 -c your-server-ip
```

---

## Performance Issues

### Problem: High CPU usage

**Solutions:**

1. **Identify the culprit:**
```bash
docker stats
```

2. **Check concurrent calls:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "core show channels count"
```

3. **Optimize codec usage:**
```bash
# Prefer efficient codecs: opus, ulaw
# Disable transcoding if possible
```

4. **Adjust worker processes:**
```bash
# Edit kamailio/kamailio.cfg
# children=8  # Adjust based on CPU cores
```

### Problem: High memory usage

**Solutions:**

1. **Check for memory leaks:**
```bash
docker exec -it webrtc-asterisk asterisk -rx "memory show summary"
```

2. **Limit call history:**
```bash
# Reduce CDR retention
# Rotate logs more frequently
```

3. **Adjust Docker limits:**
```yaml
# In docker-compose.yml
services:
  asterisk:
    mem_limit: 2g
    memswap_limit: 2g
```

### Problem: Database performance issues

**Solutions:**

1. **Check MySQL performance:**
```bash
docker exec -it webrtc-mysql mysqladmin -u root -p status
```

2. **Optimize tables:**
```bash
docker exec -it webrtc-mysql mysql -u root -p kamailio -e "OPTIMIZE TABLE location;"
```

3. **Clean old records:**
```bash
# Delete expired location entries
docker exec -it webrtc-mysql mysql -u root -p kamailio -e "DELETE FROM location WHERE expires < NOW();"
```

4. **Add indexes:**
```bash
docker exec -it webrtc-mysql mysql -u root -p kamailio -e "SHOW INDEX FROM location;"
```

---

## Getting More Help

If you're still experiencing issues:

1. **Enable debug logging:**
```bash
# Asterisk
docker exec -it webrtc-asterisk asterisk -rx "core set debug 5"
docker exec -it webrtc-asterisk asterisk -rx "pjsip set logger on"

# Kamailio
# Edit kamailio/kamailio.cfg
# Set: debug=4
```

2. **Capture SIP traffic:**
```bash
# Install sngrep for SIP analysis
docker exec -it webrtc-asterisk sngrep
```

3. **Export logs:**
```bash
docker-compose logs > system-logs.txt
```

4. **Check system resources:**
```bash
./scripts/monitor.sh > system-status.txt
```

5. **Review documentation:**
- [Asterisk Wiki](https://wiki.asterisk.org)
- [Kamailio Docs](https://www.kamailio.org/wikidocs/)
- [JsSIP Documentation](https://jssip.net/documentation/)

---

## Quick Diagnostic Commands

```bash
# Full system check
./scripts/monitor.sh

# Restart everything
docker-compose restart

# Reload Asterisk config
docker exec webrtc-asterisk asterisk -rx "core reload"

# View real-time logs
docker-compose logs -f

# Check connectivity
docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Test audio
docker exec -it webrtc-asterisk asterisk -rx "console dial 600@from-internal"
```





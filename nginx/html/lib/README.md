# CometD JavaScript Libraries

## Overview

These libraries are copied from **Genesys Workspace Web Edition (GWS) 8.5.2** to ensure compatibility with the GWS CometD server.

---

## Files

### 1. `cometd.js`
- **Version:** 3.1.12
- **Source:** `D:\WWE-Local\gws\BOOT-INF\classes\static\ui\ad\v1\lib\org\cometd.js`
- **Description:** CometD JavaScript client library (minified)
- **Usage:** Core library for CometD real-time messaging

### 2. `jquery.cometd.js`
- **Version:** 3.1.12
- **Source:** `D:\WWE-Local\gws\BOOT-INF\classes\static\ui\ad\v1\lib\jquery\jquery.cometd.js`
- **Description:** jQuery bindings for CometD (optional)
- **Usage:** Use if you want jQuery-style API for CometD

---

## Why These Versions?

**GWS Server uses CometD 3.1.12** (confirmed in `pom.xml`):
```xml
<org.cometd.version>3.1.12</org.cometd.version>
```

Using the **same version** ensures:
- ✅ Protocol compatibility
- ✅ No serialization/deserialization issues
- ✅ Consistent behavior with GWS Agent Desktop

---

## Usage in WebRTC Client

### index.html
```html
<!-- Load CometD library -->
<script src="lib/cometd.js"></script>
```

### app.js
```javascript
// Initialize CometD
const cometd = new org.cometd.CometD();

// Configure
cometd.configure({
  url: 'http://192.168.210.54:8090/genesys/cometd',
  logLevel: 'info'
});

// Handshake
cometd.handshake(function(reply) {
  if (reply.successful) {
    console.log('CometD connected:', reply.clientId);
    
    // Subscribe to call events
    cometd.subscribe('/v2/me/calls', function(message) {
      console.log('Call event:', message.data);
    });
  } else {
    console.error('CometD handshake failed:', reply);
  }
});
```

---

## CometD API Reference

### Configuration Options

```javascript
cometd.configure({
  url: 'http://server:port/genesys/cometd',
  logLevel: 'info',           // 'info', 'debug', 'warn'
  requestHeaders: {},         // Custom HTTP headers
  maxConnections: 2,          // Max concurrent connections
  backoffIncrement: 1000,     // Backoff increment (ms)
  maxBackoff: 60000,          // Max backoff (ms)
  maxNetworkDelay: 10000,     // Max network delay (ms)
  appendMessageTypeToURL: false
});
```

### Handshake

```javascript
cometd.handshake(function(reply) {
  if (reply.successful) {
    // Connected
  } else {
    // Failed
  }
});
```

### Subscribe to Channel

```javascript
const subscription = cometd.subscribe('/channel/name', function(message) {
  console.log('Received:', message.data);
});

// Unsubscribe
cometd.unsubscribe(subscription);
```

### Publish Message

```javascript
cometd.publish('/channel/name', {
  key: 'value'
});
```

### Disconnect

```javascript
cometd.disconnect(function() {
  console.log('Disconnected');
});
```

---

## Transport Mechanism

CometD uses **HTTP long-polling** (not WebSocket despite config):

```
1. Client sends POST to /genesys/cometd
2. Server holds connection open (up to 60 seconds)
3. When event occurs, server responds immediately
4. Client receives response, processes, then reconnects
5. Repeat
```

This creates a **persistent, real-time connection** over standard HTTP.

---

## Channels in GWS

### Voice Events
```javascript
cometd.subscribe('/v2/me/calls', function(message) {
  // Call state changes: Ringing, Established, Released, Held, etc.
});
```

### Agent State Events
```javascript
cometd.subscribe('/v2/me/state', function(message) {
  // Agent state: Ready, NotReady, AfterCallWork, LoggedOut
});
```

### Multimedia Events
```javascript
cometd.subscribe('/v2/me/interactions', function(message) {
  // Chat, email, workitem events
});
```

---

## Troubleshooting

### Issue: Handshake fails with 403 Forbidden

**Cause:** Not authenticated with GWS

**Fix:** Login to GWS first, or send credentials in handshake:
```javascript
cometd.registerExtension('auth', {
  outgoing: function(message) {
    if (message.channel === '/meta/handshake') {
      message.ext = message.ext || {};
      message.ext.authentication = {
        username: 'agent1',
        password: 'password'
      };
    }
    return message;
  }
});
```

### Issue: CORS error

**Cause:** CORS not configured in GWS

**Fix:** In `application.yaml`:
```yaml
crossOriginSettings:
  allowedOrigins: http://192.168.210.54
  allowCredentials: true
```

### Issue: Connection timeout

**Cause:** Network or firewall blocking

**Fix:** Check:
- GWS is running (port 8090)
- No firewall blocking HTTP POST
- GWS accessible from client

---

## References

- [CometD Official Documentation](http://cometd.org/)
- [CometD JavaScript API](http://cometd.org/documentation/3.x/javascript/)
- [Genesys CometD Documentation](https://docs.genesys.com/Documentation/HTCC/latest/Dep/CometD)

---

## License

These libraries are part of **Genesys Workspace Web Edition** and are subject to Genesys licensing terms.

Used for integration with Genesys contact center platform.


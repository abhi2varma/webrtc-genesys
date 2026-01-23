# Troubleshooting WWE Local Access

## Problem: WWE login fails with 403 Forbidden after switching from HTTPS to HTTP

### Symptoms
```
Cookie "JSESSIONID" has been rejected because there is an existing "secure" cookie.
GET http://192.168.210.54:8090/api/v2/me [HTTP/1.1 403 Forbidden]
GET http://192.168.210.54:8090/internal-api/me/settings [HTTP/1.1 403 Forbidden]
```

### Root Cause
When you access WWE via HTTPS (e.g., `https://103.167.180.166:8443`), the browser stores a **secure session cookie** (`JSESSIONID`) with the `Secure` flag set.

When you later access WWE via HTTP (e.g., `http://192.168.210.54:8090`), the browser rejects the new HTTP cookie because a secure cookie with the same name already exists.

This causes authentication failures even after successful login.

### Solution 1: Clear Browser Cookies (Quick Fix)

#### Chrome/Edge:
1. Open DevTools (F12)
2. Go to **Application** tab
3. Expand **Cookies** in the left sidebar
4. Select `http://192.168.210.54:8090`
5. Right-click → **Clear**
6. Refresh the page (Ctrl+F5)

#### Firefox:
1. Press **Ctrl+Shift+Del**
2. Select **Cookies**
3. Time range: **Everything**
4. Click **Clear Now**
5. Refresh the page (Ctrl+F5)

#### Alternative (Incognito/Private Window):
Open WWE in an incognito/private window: `http://192.168.210.54:8090/ui/ad/v1/index.html`

### Solution 2: Use Consistent Protocol

Always access WWE via the same protocol:

**Option A: Always use HTTP (local development)**
```
http://192.168.210.54:8090/ui/ad/v1/index.html
```

**Option B: Always use HTTPS (via Nginx)**
```
https://103.167.180.166:8443/
```

### Solution 3: Configure SameSite Cookie Policy (Advanced)

If you need to access WWE via both HTTP and HTTPS, configure Genesys to use separate session cookies for each protocol.

This requires modifying Genesys WWE configuration (not recommended for POC).

---

## Prevention

To avoid this issue in the future:

1. **During development**: Use only HTTP or only HTTPS, not both
2. **Clear cookies** when switching between protocols
3. **Use different browsers** for HTTP (local) and HTTPS (remote) access
   - Chrome for local HTTP: `http://192.168.210.54:8090`
   - Edge for remote HTTPS: `https://103.167.180.166:8443`

---

## Related Issues

### Issue: "Password fields present on an insecure (http://) page"
This is a browser warning when using HTTP instead of HTTPS. It's expected for local development.

**Solution**: Use HTTPS in production via Nginx.

### Issue: "The Notification permission may only be requested in a secure context"
Browser notifications require HTTPS. WWE notifications won't work over plain HTTP.

**Solution**: Use HTTPS via Nginx if you need browser notifications.

---

## Testing Steps After Clearing Cookies

1. **Clear all cookies** for `192.168.210.54`
2. **Open WWE**: `http://192.168.210.54:8090/ui/ad/v1/index.html`
3. **Login** with test1/password
4. **Verify**: You should see the WWE interface without 403 errors
5. **Check DevTools Console**: No cookie rejection messages

---

## Cookie Details

### Secure Cookie (from HTTPS access)
```
Name: JSESSIONID
Value: <session-id>
Domain: 103.167.180.166
Path: /
Secure: ✓ (Yes)
HttpOnly: ✓ (Yes)
SameSite: Lax
```

### HTTP Cookie (rejected when secure cookie exists)
```
Name: JSESSIONID
Value: <different-session-id>
Domain: 192.168.210.54
Path: /
Secure: ✗ (No)  ← Browser rejects this!
HttpOnly: ✓ (Yes)
SameSite: Lax
```

---

## Quick Reference

| Access Method | URL | Cookie Type | Works? |
|--------------|-----|-------------|--------|
| **Direct HTTP** | `http://192.168.210.54:8090` | HTTP (insecure) | ✓ (if no secure cookie exists) |
| **HTTPS via Nginx** | `https://103.167.180.166:8443` | HTTPS (secure) | ✓ |
| **Both** | Mixed | Conflict! | ✗ (secure cookie blocks HTTP cookie) |

---

## Logs Analysis

### Failed Login (Cookie Conflict)
```
Cookie "JSESSIONID" has been rejected because there is an existing "secure" cookie.
GET /api/v2/me [403 Forbidden]
{"statusCode":20,"statusMessage":"Access denied"}
```

### Successful Login (No Cookie Conflict)
```
GET /api/v2/me [200 OK]
{"statusCode":0,"user":{...}}
2026-01-23 21:30:53.680 [DEBUG] [WWE.AuthentificationManager] Login is succesful
```

---

## Version Info
- **WWE Version**: 8.5.202.96
- **jQuery Version**: 3.5.1
- **Bootstrap Version**: 3.4.1

# Testing Start Guide

## Pre-Test Checklist

### 1. Docker Status
- [ ] Docker Desktop is installed and running
- [ ] Docker daemon is accessible

### 2. Network Information
**Your IP Addresses:**
- `192.168.18.192` (Primary?)
- `192.168.14.1`
- `192.168.77.1`
- `172.20.10.9`

**Which IP should we use for:**
- Asterisk external IP (for SIP/RTP)?
- WebRTC server URL?

**Genesys Environment:**
- SIP Server: `10.78.3.90:5060`
- GWS: `192.168.18.109:8090`

### 3. Configuration Needed

**Before starting, we need to replace these placeholders:**

#### `asterisk/etc/pjsip.conf`:
- `${PUBLIC_IP}` → Your server's IP (which one?)
- `${GENESYS_SIP_HOST}` → `10.78.3.90`
- `${GENESYS_SIP_PORT}` → `5060`
- `${GENESYS_USERNAME}` → Your Genesys username
- `${GENESYS_PASSWORD}` → Your Genesys password

#### `coturn/turnserver.conf`:
- `YOUR_PUBLIC_IP_HERE` → Your server's IP (2 places)
- `your-domain.com` → Your domain or IP
- `your-turn-secret-key` → A secure key

#### `nginx/nginx.conf`:
- `your-domain.com` → Your domain or IP

### 4. SSL Certificates
- [ ] Generate certificates using `scripts/generate-certs.ps1`

---

## Quick Start Commands

### Step 1: Generate Certificates
```powershell
.\scripts\generate-certs.ps1
```

### Step 2: Update Configuration
We'll help you replace the placeholders once you confirm:
- Which IP to use
- Genesys credentials

### Step 3: Start Services
```powershell
docker-compose up -d
```

### Step 4: Check Status
```powershell
docker-compose ps
docker-compose logs asterisk
docker-compose logs nginx
```

### Step 5: Test Web Client
Open browser: `https://your-ip-or-domain`

---

## Testing Flow

1. **GWS Connection Test**
   - Open web client
   - Connect to GWS: `http://192.168.18.109:8090`
   - Verify CometD connection

2. **SIP Registration Test**
   - Enter Agent DN: `5001`
   - Enter Password: `GenesysAgent5001!`
   - Connect to Asterisk via WSS
   - Verify registration

3. **Asterisk → Genesys Registration**
   - Check Asterisk logs for registration status
   - Verify connection to `10.78.3.90:5060`

4. **End-to-End Test**
   - Make a test call through GWS
   - Verify media flow

---

## Current Status

Let's start by:
1. Checking Docker
2. Generating certificates
3. Getting your IP and credentials
4. Updating configuration
5. Starting services


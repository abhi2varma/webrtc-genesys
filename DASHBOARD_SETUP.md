# 📊 Registration Dashboard Setup Guide

## Overview

Beautiful real-time dashboard showing all active WebRTC client registrations and Genesys SIP registrations with IP addresses and ports.

---

## 🚀 Deployment Steps

### Step 1: Deploy to CentOS

```bash
# Pull latest code
cd /opt/gcti_apps/webrtc-genesys
sudo git pull origin main

# Build dashboard API image
cd dashboard
sudo docker build -t webrtc-dashboard-api .

# Go back to project root
cd ..

# Start all services (including new dashboard API)
sudo docker-compose up -d

# Verify all containers are running
sudo docker-compose ps
```

**Expected containers:**
```
webrtc-asterisk                Up
webrtc-coturn                  Up
webrtc-nginx                   Up
webrtc-registration-monitor    Up
webrtc-dashboard-api           Up  ← NEW!
```

---

### Step 2: Restart Nginx to Load New Config

```bash
sudo docker-compose restart nginx
```

---

### Step 3: Access the Dashboard

**Open in browser:**
```
http://192.168.210.54/dashboard.html
```

---

## 📋 Dashboard Features

### 1. Statistics Cards
- **Active WebRTC Clients** - How many agents are connected
- **Registered to Genesys** - How many DNs are registered to Genesys SIP Server
- **Total DNs Configured** - Total number of DNs (5001-5020 = 20)

### 2. WebRTC Client Registrations Table
Shows all active WebRTC clients with:
- **DN** - Extension number (5001-5020)
- **IP Address** - Client's IP address (from VPN/network interface)
- **Port** - WebSocket connection port
- **Status** - Online/Offline
- **Full URI** - Complete SIP contact URI

### 3. Genesys SIP Registrations Table
Shows which DNs are registered to Genesys with:
- **DN** - Extension number
- **Status** - Registered/Unregistered
- **Server URI** - Genesys SIP Server URI
- **Client URI** - How Asterisk identifies itself

### 4. Auto-Refresh
- Auto-refreshes every 5 seconds
- Can be toggled on/off
- Manual refresh button available

---

## 🧪 Testing the Dashboard

### Test 1: No Registrations

**Before connecting any clients:**
1. Open dashboard: `http://192.168.210.54/dashboard.html`
2. Should show:
   - Active WebRTC Clients: **0**
   - Registered to Genesys: **0**
   - Both tables: "No active registrations"

---

### Test 2: Single Registration

**Connect one WebRTC client (DN 5001):**
1. Open: `http://192.168.210.54/`
2. Connect as DN 5001
3. Go back to dashboard
4. Should show:
   - Active WebRTC Clients: **1**
   - Registered to Genesys: **1**
   - WebRTC table shows: DN 5001 with your IP/port
   - Genesys table shows: DN 5001 - Registered

---

### Test 3: Multiple Registrations

**Connect 3 WebRTC clients:**
1. Tab 1: DN 5001
2. Tab 2: DN 5002
3. Tab 3: DN 5003

**Dashboard should show:**
- Active WebRTC Clients: **3**
- Registered to Genesys: **3**
- All 3 DNs listed in both tables

---

### Test 4: Disconnect

**Disconnect DN 5001:**
1. Click "Disconnect" in Tab 1
2. Wait 5 seconds (or click refresh)
3. Dashboard should update:
   - Active WebRTC Clients: **2** (5002, 5003)
   - Registered to Genesys: **2**
   - DN 5001 removed from WebRTC table
   - DN 5001 shows "Unregistered" in Genesys table

---

## 📸 Dashboard UI

### Layout:

```
┌────────────────────────────────────────────────────────────┐
│  🎯 WebRTC Registration Dashboard                          │
│  Real-time monitoring of WebRTC client and Genesys...      │
└────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ Active WebRTC    │  │ Registered to    │  │ Total DNs    │
│ Clients          │  │ Genesys          │  │ Configured   │
│                  │  │                  │  │              │
│       3          │  │       3          │  │      20      │
└──────────────────┘  └──────────────────┘  └──────────────┘

┌────────────────────────────────────────────────────────────┐
│  🔄 Refresh Now    ☑ Auto-refresh every 5s                 │
│  Last updated: 10:30:45 AM                                 │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  📱 Active WebRTC Client Registrations                     │
├───────┬──────────────┬──────┬─────────┬──────────────────┤
│ DN    │ IP Address   │ Port │ Status  │ Full URI         │
├───────┼──────────────┼──────┼─────────┼──────────────────┤
│ 5001  │ 10.8.0.5     │ 8901 │ Online  │ sip:xyz@10.8...  │
│ 5002  │ 10.8.0.6     │ 8902 │ Online  │ sip:abc@10.8...  │
│ 5003  │ 192.168.1.10 │ 8903 │ Online  │ sip:def@192....  │
└───────┴──────────────┴──────┴─────────┴──────────────────┘

┌────────────────────────────────────────────────────────────┐
│  🌐 Genesys SIP Server Registrations                       │
├───────┬──────────────┬─────────────────────┬─────────────┤
│ DN    │ Status       │ Server URI          │ Client URI  │
├───────┼──────────────┼─────────────────────┼─────────────┤
│ 5001  │ Registered   │ sip:192.168.210.81  │ sip:5001... │
│ 5002  │ Registered   │ sip:192.168.210.81  │ sip:5002... │
│ 5003  │ Registered   │ sip:192.168.210.81  │ sip:5003... │
└───────┴──────────────┴─────────────────────┴─────────────┘
```

---

## 🔍 Troubleshooting

### Issue 1: Dashboard Shows "Error loading data"

**Check dashboard API:**
```bash
sudo docker logs webrtc-dashboard-api
```

**If API is not running:**
```bash
sudo docker-compose up -d dashboard-api
```

---

### Issue 2: Dashboard Shows Empty Tables

**Check AMI connection:**
```bash
# Test API endpoint directly
curl http://127.0.0.1:5000/api/health

# Should return: {"status":"ok"}

# Test registrations endpoint
curl http://127.0.0.1:5000/api/registrations
```

**If API can't connect to Asterisk:**
- Verify `manager.conf` is loaded in Asterisk
- Check AMI credentials in `docker-compose.yml`

---

### Issue 3: Dashboard Not Loading

**Check nginx config:**
```bash
# Test nginx configuration
sudo docker exec -it webrtc-nginx nginx -t

# Restart nginx
sudo docker-compose restart nginx
```

**Check nginx logs:**
```bash
sudo docker logs webrtc-nginx
```

---

### Issue 4: "No active registrations" But Clients Are Connected

**Verify clients are actually registered:**
```bash
# Check Asterisk endpoints
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints" | grep 5001

# Check if API sees them
curl http://127.0.0.1:5000/api/registrations | jq
```

---

## 📊 API Endpoints

### Health Check
```bash
GET /api/health
```

**Response:**
```json
{
  "status": "ok"
}
```

### Get Registrations
```bash
GET /api/registrations
```

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "dn": "5001",
      "ip": "10.8.0.5",
      "port": "8901",
      "status": "Reachable",
      "uri": "sip:xyz@10.8.0.5:8901;transport=WS"
    }
  ],
  "genesys_registrations": [
    {
      "dn": "5001",
      "status": "Registered",
      "server_uri": "sip:192.168.210.81:5060",
      "client_uri": "sip:5001@192.168.210.81"
    }
  ]
}
```

---

## 🎨 Customization

### Change Refresh Interval

Edit `dashboard.html`:
```javascript
// Change from 5000ms (5 seconds) to 10000ms (10 seconds)
autoRefreshInterval = setInterval(loadData, 10000);
```

### Change Dashboard Theme

Edit `dashboard.html` CSS:
```css
/* Change gradient background */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change primary color */
.stat-number {
    color: #667eea;  /* Change this */
}
```

---

## ✅ Success Checklist

- [ ] Dashboard API container running
- [ ] Dashboard accessible at `/dashboard.html`
- [ ] Shows correct WebRTC client count
- [ ] Shows correct Genesys registration count
- [ ] Tables display IP addresses and ports
- [ ] Auto-refresh works
- [ ] Manual refresh button works
- [ ] Statistics update in real-time

---

## 🎯 What You Can See

### From Dashboard, You Can Monitor:

1. **Which agents are currently online** (WebRTC clients)
2. **Their IP addresses** (useful for VPN troubleshooting)
3. **Their port numbers** (for network debugging)
4. **Which DNs are registered to Genesys** (availability in call center)
5. **Registration status changes in real-time** (5-second updates)

### Use Cases:

- **Capacity monitoring:** How many agents are online?
- **Network troubleshooting:** Which IP/VPN is each agent using?
- **Availability tracking:** Which DNs are available for calls?
- **Registration debugging:** Is DN registered locally but not to Genesys?

---

**Your dashboard is now ready!** 🎉

Access it at: `http://192.168.210.54/dashboard.html`


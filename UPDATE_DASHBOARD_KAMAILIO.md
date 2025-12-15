# Update Dashboard with Kamailio Status

**New Feature:** Dashboard now shows Kamailio SIP load balancer status!

---

## 🎯 What's New

### **Dashboard Now Shows:**
1. ✅ **Kamailio Status Card** - Running/Stopped indicator
2. ✅ **Dispatcher Endpoints** - All configured Asterisk instances
3. ✅ **Health Checks** - Real-time health status (Healthy/Checking/Unknown)
4. ✅ **Complete Monitoring** - WebRTC + Genesys + Kamailio in one dashboard

---

## 🚀 Quick Update (5 minutes)

Run these commands on your server (192.168.210.54):

```bash
# 1. Navigate to project
cd /opt/gcti_apps/webrtc

# 2. Discard local changes (if any)
sudo git checkout kamailio/kamailio.cfg

# 3. Pull latest code
sudo git pull origin main

# 4. Rebuild dashboard with Docker CLI support
cd dashboard
sudo docker build --no-cache -t webrtc-dashboard-api .
cd ..

# 5. Restart dashboard and nginx
sudo docker-compose stop dashboard-api nginx
sudo docker-compose up -d dashboard-api nginx

# 6. Wait for startup
sleep 10

# 7. Verify dashboard is running
sudo docker logs webrtc-dashboard-api --tail 20
```

---

## ✅ Verify New Features

### **Test Kamailio API Endpoint:**

```bash
# Test new Kamailio endpoint
curl http://127.0.0.1:5000/api/kamailio

# Expected output:
# {
#   "success": true,
#   "kamailio_running": true,
#   "container_status": "Up X seconds",
#   "dispatchers": [
#     {
#       "setid": "1",
#       "destination": "sip:192.168.210.54:5060",
#       "ip": "192.168.210.54",
#       "port": "5060",
#       "flags": "0",
#       "health": "Healthy"
#     }
#   ],
#   "dispatcher_count": 1
# }
```

### **Open Updated Dashboard:**

```
Browser: http://192.168.210.54/dashboard.html
```

**You should see:**
1. **New stat card** showing Kamailio status (✓ or ✗)
2. **New section** "⚖️ Kamailio SIP Load Balancer"
3. **Table showing:**
   - Set ID
   - Destination (SIP URI)
   - IP address
   - Port
   - Health status (color-coded: Green=Healthy, Blue=Checking, Red=Unknown)

---

## 🎬 For Demo - Show Complete Stack

### **Show Dashboard:**

```
"Our dashboard now monitors all 7 services in real-time:

1. WebRTC Client Registrations
   - Shows which DNs are actively connected
   - IP addresses and ports
   - Connection status

2. Genesys SIP Registrations  
   - Which DNs are registered to Genesys SIP Server
   - Registration status and expiry

3. Kamailio Load Balancer (NEW!)
   - Container health (Running/Stopped)
   - All dispatcher endpoints
   - Health check status for each Asterisk instance
   - Kamailio sends OPTIONS every 10 seconds to verify health

In production with 20 Asterisk instances, you'll see all 20 
listed here with their individual health status. Kamailio 
automatically removes failed instances from the rotation."
```

### **Point Out Key Features:**

```
✓ Auto-refresh every 5 seconds
✓ Real-time health monitoring
✓ Color-coded status indicators
✓ Complete system visibility in one dashboard
✓ Production-ready monitoring
```

---

## 📊 Dashboard Sections

### **Stats Cards (4 cards):**
1. **Active WebRTC Clients** - How many agents connected
2. **Registered to Genesys** - DNs registered to SIP server
3. **Kamailio Status** - ✓ (green) or ✗ (red)
4. **Total DNs Configured** - Always shows 20

### **Tables (3 sections):**
1. **📱 Active WebRTC Client Registrations**
   - DN, IP, Port, Status, Full URI

2. **🌐 Genesys SIP Server Registrations**
   - DN, Status, Server URI, Client URI

3. **⚖️ Kamailio SIP Load Balancer** (NEW!)
   - Container Status
   - Dispatcher count
   - Table: Set ID, Destination, IP, Port, Health Status

---

## 🔧 Troubleshooting

### **Issue: Kamailio section shows "Error loading Kamailio data"**

```bash
# Check dashboard API logs
sudo docker logs webrtc-dashboard-api --tail 50

# Common fixes:

# 1. Dashboard container needs Docker socket access
sudo docker-compose down
sudo docker-compose up -d

# 2. Check if Kamailio is running
sudo docker ps | grep kamailio

# 3. Rebuild dashboard with Docker CLI
cd dashboard
sudo docker build --no-cache -t webrtc-dashboard-api .
cd ..
sudo docker-compose restart dashboard-api
```

### **Issue: Health status shows "Unknown"**

This is normal if:
- Kamailio just started (wait 10-20 seconds for first health check)
- Asterisk is not responding to OPTIONS requests
- Check Kamailio logs: `sudo docker logs webrtc-kamailio | grep OPTIONS`

### **Issue: Dashboard API can't access Docker**

```bash
# Check docker.sock is mounted
sudo docker inspect webrtc-dashboard-api | grep docker.sock

# Should see:
# "/var/run/docker.sock:/var/run/docker.sock:ro"

# If not, ensure docker-compose.yml has:
# volumes:
#   - /var/run/docker.sock:/var/run/docker.sock:ro

# Restart
sudo docker-compose restart dashboard-api
```

---

## 🎯 What This Enables

### **Current (Single Instance):**
- Shows 1 Asterisk endpoint
- Health status: Healthy
- Proves monitoring works

### **Future (20 Instances in Production):**
```
Kamailio Dashboard will show:
┌────────────────────────────────────────┐
│ Set ID | Destination | IP       | Health│
├────────────────────────────────────────┤
│   1    | sip:...101  | x.x.x.101| ✓     │
│   1    | sip:...102  | x.x.x.102| ✓     │
│   1    | sip:...103  | x.x.x.103| ✗     │ ← Failed!
│   ...                                   │
│   1    | sip:...120  | x.x.x.120| ✓     │
└────────────────────────────────────────┘

Failed instances are automatically removed from 
call routing until they recover.
```

---

## 📝 Technical Details

### **How It Works:**

1. **Dashboard API** queries Docker via socket:
   - Checks if `webrtc-kamailio` container is running
   - Gets container status

2. **Reads Dispatcher List:**
   - Parses `/etc/kamailio/dispatcher.list`
   - Extracts IP addresses and ports

3. **Checks Health:**
   - Reads last 100 lines of Kamailio logs
   - Looks for OPTIONS requests and 200 OK responses
   - Determines health status

4. **Dashboard Frontend:**
   - Fetches from `/api/kamailio` every 5 seconds
   - Renders table with color-coded status
   - Auto-refreshes alongside other data

---

## ✅ Success Checklist

After update:
- [ ] Dashboard loads: http://192.168.210.54/dashboard.html
- [ ] Four stat cards visible (including Kamailio)
- [ ] Kamailio section shows "Container Status: Running"
- [ ] Dispatcher table shows 1 endpoint (192.168.210.54:5060)
- [ ] Health status is "Healthy" or "Checking" (not "Unknown")
- [ ] Auto-refresh works (last updated timestamp changes)
- [ ] No errors in browser console (F12)
- [ ] API endpoint works: `curl http://127.0.0.1:5000/api/kamailio`

---

## 🎉 Benefits

✅ **Complete Visibility** - Monitor all 7 services from one dashboard  
✅ **Real-time Monitoring** - 5-second refresh interval  
✅ **Health Tracking** - Know immediately if Kamailio or Asterisk fails  
✅ **Production Ready** - Scales to show 20+ Asterisk instances  
✅ **Demo Impact** - Show stakeholders complete monitoring solution  

---

**Time to Update:** 5 minutes  
**Downtime:** ~10 seconds (dashboard restart only)  
**Risk:** Very low  
**Impact:** Professional monitoring dashboard! 🚀

---

**Run the update commands above and refresh your dashboard!**


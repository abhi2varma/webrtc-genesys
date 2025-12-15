# Proof of Concept (POC) Deployment
## Single Server WebRTC Gateway - 192.168.210.54

**Purpose:** Validate architecture and demonstrate functionality before full enterprise deployment  
**Server:** 192.168.210.54 (CentOS)  
**Timeline:** 1-2 days  
**Test Capacity:** 20-50 concurrent calls

---

## 🎯 POC Objectives

### **What We're Proving:**
- ✅ WebRTC clients can connect from internet
- ✅ Registration flow works (WebRTC → Asterisk → Genesys)
- ✅ Calls route properly (PSTN → Genesys → Asterisk → WebRTC)
- ✅ Audio quality is acceptable
- ✅ Dynamic registration system works
- ✅ Monitoring dashboard functions
- ✅ Architecture is sound for scaling

### **What We're NOT Testing:**
- ❌ Full 5000 concurrent call capacity
- ❌ High availability / failover
- ❌ Load balancing across multiple servers
- ❌ Long-term stability (days/weeks)

---

## 📋 Quick Deployment Checklist

### **Phase 1: Pre-Deployment (30 minutes)**
- [ ] Verify server access: `ssh Gencct@192.168.210.54 -p 69`
- [ ] Verify Git repository accessible
- [ ] Verify Docker and Docker Compose installed
- [ ] Verify network connectivity to Genesys (192.168.210.81)
- [ ] Note current server specs (CPU, RAM, disk)

### **Phase 2: Code Deployment (15 minutes)**
- [ ] Pull latest code from GitHub
- [ ] Create log directories
- [ ] Review configuration files
- [ ] No changes needed (already configured for 192.168.210.54)

### **Phase 3: Start Services (10 minutes)**
- [ ] Start Docker containers
- [ ] Verify all containers running
- [ ] Check logs for errors
- [ ] Verify Asterisk started

### **Phase 4: Testing (30 minutes)**
- [ ] Test WebRTC client connection (internal)
- [ ] Test registration to Asterisk
- [ ] Test registration to Genesys
- [ ] Test inbound call
- [ ] Test outbound call
- [ ] Test monitoring dashboard

### **Phase 5: Demo Preparation (optional)**
- [ ] Test from external network (if internet-facing)
- [ ] Prepare demo script
- [ ] Document any issues

**Total Time:** 1.5-2 hours

---

## 🚀 Step-by-Step Deployment

### **Step 1: Connect to Server**

```bash
# From your Windows machine (PowerShell or Git Bash)
ssh Gencct@192.168.210.54 -p 69
# Password: !QAZxsw23edcvfr4

# Verify you're in the right place
pwd
# Expected: /home/Gencct or similar
```

---

### **Step 2: Navigate to Project Directory**

```bash
# Go to project directory
cd /opt/gcti_apps/webrtc

# Verify it exists
ls -la

# If it doesn't exist, create it
sudo mkdir -p /opt/gcti_apps/webrtc
sudo chown -R Gencct:Gencct /opt/gcti_apps/webrtc
cd /opt/gcti_apps/webrtc
```

---

### **Step 3: Pull Latest Code**

```bash
# If repository already cloned
cd /opt/gcti_apps/webrtc
sudo git fetch origin
sudo git pull origin main

# If repository NOT cloned yet
cd /opt/gcti_apps
sudo git clone https://github.com/abhi2varma/webrtc-genesys.git webrtc
sudo chown -R Gencct:Gencct /opt/gcti_apps/webrtc
cd webrtc
```

---

### **Step 4: Create Log Directories**

```bash
# Create all log directories
sudo mkdir -p asterisk/logs
sudo mkdir -p coturn/logs
sudo mkdir -p nginx/logs
sudo mkdir -p registration-monitor/logs
sudo mkdir -p dashboard/logs
sudo mkdir -p redis/logs redis/data
sudo mkdir -p kamailio/logs

# Set permissions
sudo chown -R 1000:1000 asterisk/logs
sudo chmod -R 755 */logs
sudo chmod -R 755 redis/data

# Verify
ls -la */logs
```

---

### **Step 5: Review Configuration**

```bash
# Check Asterisk external IP (should be 192.168.210.54)
grep external_media_address asterisk/etc/pjsip.conf
# Expected: external_media_address=192.168.210.54

# Check Genesys SIP server (should be 192.168.210.81)
grep GENESYS_SIP_HOST docker-compose.yml
# Expected: GENESYS_SIP_HOST=192.168.210.81

# Check DN range (should be 5001-5020)
grep DN_RANGE docker-compose.yml
# Expected: DN_RANGE_START=5001, DN_RANGE_END=5020

# Everything looks good? Continue.
# Need changes? Edit files, then continue.
```

---

### **Step 6: Stop Any Existing Containers**

```bash
# Stop and remove old containers (if any)
sudo docker-compose down

# Verify nothing running
sudo docker ps

# Optional: Clean up old images if disk space low
# sudo docker system prune -a
```

---

### **Step 7: Build Docker Images**

```bash
# Build registration monitor
cd /opt/gcti_apps/webrtc/registration-monitor
sudo docker build --no-cache -t webrtc-registration-monitor .

# Build dashboard API
cd /opt/gcti_apps/webrtc/dashboard
sudo docker build --no-cache -t webrtc-dashboard-api .

# Return to project root
cd /opt/gcti_apps/webrtc
```

---

### **Step 8: Start All Services**

```bash
# Start containers in detached mode
sudo docker-compose up -d

# Wait 10 seconds for startup
sleep 10

# Check status
sudo docker-compose ps

# Expected output:
# NAME                           STATUS
# webrtc-asterisk                Up
# webrtc-coturn                  Up
# webrtc-nginx                   Up
# webrtc-registration-monitor    Up
# webrtc-dashboard-api           Up
# webrtc-redis                   Up
# webrtc-kamailio                Up
```

---

### **Step 9: Verify Services**

#### **Check Asterisk:**
```bash
# Check Asterisk logs
sudo docker logs webrtc-asterisk --tail 50

# Look for:
# "Asterisk Ready"
# No ERROR messages

# Check Asterisk CLI
sudo docker exec -it webrtc-asterisk asterisk -rx "core show version"
# Should show Asterisk version

# Check PJSIP endpoints
sudo docker exec -it webrtc-asterisk asterisk -rx "pjsip show endpoints"
# Should show 5001-5020 endpoints
```

#### **Check Registration Monitor:**
```bash
# Check monitor logs
sudo docker logs webrtc-registration-monitor --tail 50

# Look for:
# "✅ Connected to Asterisk AMI"
# "Monitoring DNs: 5001-5020"
# No ERROR messages
```

#### **Check Dashboard API:**
```bash
# Check dashboard logs
sudo docker logs webrtc-dashboard-api --tail 20

# Test API
curl http://127.0.0.1:5000/api/registrations

# Expected: JSON with contacts and genesys_registrations arrays
```

#### **Check Nginx:**
```bash
# Test web server
curl http://192.168.210.54/

# Expected: HTML content (WebRTC client)

# Test dashboard
curl http://192.168.210.54/dashboard.html

# Expected: HTML content (dashboard)
```

#### **Check Redis:**
```bash
# Test Redis connection
sudo docker exec webrtc-redis redis-cli ping

# Expected: PONG

# Check Redis is storing data (optional)
sudo docker exec webrtc-redis redis-cli keys "*"
```

####Human: <additional_data>
Below are some potentially helpful/relevant pieces of information for figuring out how to respond:

<open_and_recently_viewed_files>
Recently viewed files (recent at the top, oldest at the bottom):
- d:\Abhi\WebRTC\webrtc-genesys\POC_DEPLOYMENT.md (total lines: 712)
- d:\Abhi\WebRTC\webrtc-genesys\registration-monitor\requirements.txt (total lines: 2)
- d:\Abhi\WebRTC\webrtc-genesys\registration-monitor\registration_monitor.py (total lines: 347)
- d:\Abhi\WebRTC\webrtc-genesys\.gitignore (total lines: 91)
- d:\Abhi\WebRTC\webrtc-genesys\kamailio\dispatcher.list (total lines: 15)
- d:\Abhi\WebRTC\webrtc-genesys\kamailio\kamailio.cfg (total lines: 309)
- d:\Abhi\WebRTC\webrtc-genesys\docker-compose.yml (total lines: 167)
- d:\Abhi\WebRTC\webrtc-genesys\ENTERPRISE_DEPLOYMENT_CHECKLIST.md (total lines: 653)

Files that are currently open and visible in the user's IDE:
- d:\Abhi\WebRTC\webrtc-genesys\POC_DEPLOYMENT.md (currently focused file, cursor is on line 287, total lines: 718)

Note: these files may or may not be relevant to the current conversation. Use the read_file tool if you need to get the contents of some of them.
</open_and_recently_viewed_files>
<attached_files>

The user has accepted the changes to the file docker-compose.yml.


The user has accepted the changes to the file registration-monitor/requirements.txt.


The user has accepted the changes to the file .gitignore.


The user has accepted the changes to the file POC_DEPLOYMENT.md.

</attached_files>
</additional_data>

<user_query>
commit
</user_query>

---

### **Step 10: Initial Testing**

#### **Test 1: WebRTC Client Access (Internal)**

From your Windows machine, open browser:
```
http://192.168.210.54/
```

**Expected:**
- WebRTC client loads
- Registration form visible
- No console errors

#### **Test 2: Register a Client**

On the WebRTC client page:
```
Extension: 5001
Password: GenesysAgent5001!
Click: Connect
```

**Expected:**
- Status changes to "Registered"
- Green indicator
- Timer starts

**Verify on Server:**
```bash
# Check Asterisk registration
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"
# 5001 should show "Avail" with contact

# Check Genesys registration
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"
# genesys_reg_5001 should show "Registered" or "Outbound Reg Sent"

# Check Redis (if you want to verify state storage)
# This is optional for POC
```

#### **Test 3: Monitoring Dashboard**

Open in browser:
```
http://192.168.210.54/dashboard.html
```

**Expected:**
- Shows 1 active WebRTC client (5001)
- Shows IP address and port
- Shows Genesys registration status
- Auto-refreshes every 5 seconds

#### **Test 4: Multiple Clients**

Open 2-3 more browser tabs:
- Register as 5002, 5003, 5004
- Check dashboard updates
- Verify all appear

---

## 📞 Call Testing

### **Test 1: Inbound Call (Genesys → WebRTC)**

**Prerequisites:**
- DN 5001 registered in Genesys
- Asterisk trunk configured in Genesys
- Test phone number or agent to call from

**Steps:**
1. Have another agent or test system call DN 5001 through Genesys
2. WebRTC client should ring
3. Answer the call
4. Verify two-way audio

**If call doesn't ring:**
```bash
# Check Asterisk logs for INVITE
sudo docker logs webrtc-asterisk --tail 100 | grep INVITE

# Check if DN is registered to Genesys
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"
```

### **Test 2: Outbound Call (WebRTC → Genesys)**

**Steps:**
1. In WebRTC client, enter a valid DN or phone number
2. Click "Call"
3. Call should be established through Genesys
4. Verify two-way audio

---

## 🔍 Troubleshooting

### **Problem: Containers won't start**

```bash
# Check Docker service
sudo systemctl status docker

# Check for port conflicts
sudo netstat -tulpn | grep -E '5060|8088|3478'

# Check disk space
df -h

# Check logs
sudo docker-compose logs
```

### **Problem: Can't access WebRTC client**

```bash
# Check Nginx is running
sudo docker ps | grep nginx

# Check firewall
sudo firewall-cmd --list-all

# Make sure port 80 is open
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

# Test locally on server
curl http://localhost/
```

### **Problem: WebRTC client can't register**

```bash
# Check WebSocket connection
sudo docker logs webrtc-asterisk | grep WebSocket

# Check Asterisk PJSIP
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"

# Check for SIP errors
sudo docker logs webrtc-asterisk --tail 100 | grep ERROR
```

### **Problem: Registration to Genesys fails**

```bash
# Check network connectivity to Genesys
ping 192.168.210.81

# Check SIP connectivity
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Check monitor is working
sudo docker logs webrtc-registration-monitor --tail 50

# Manual test registration
sudo docker exec webrtc-asterisk asterisk -rx "pjsip send register genesys_reg_5001"
```

### **Problem: No audio on calls**

```bash
# Check RTP ports
sudo netstat -tulpn | grep "10000\|10001\|10002"

# Check firewall allows RTP
sudo firewall-cmd --list-all | grep 10000-20000

# If not, add RTP ports
sudo firewall-cmd --permanent --add-port=10000-20000/udp
sudo firewall-cmd --reload

# Check Coturn (TURN server)
sudo docker logs webrtc-coturn
```

---

## 📊 POC Success Criteria

### **Minimum Success (MVP):**
- [x] WebRTC client loads in browser
- [x] Can register 1 agent (DN 5001)
- [x] Agent shows as registered in Asterisk
- [x] Agent shows as registered in Genesys (if Genesys configured)
- [x] Dashboard shows active registration

### **Full Success:**
- [x] Can register 5-10 agents simultaneously
- [x] Inbound calls work (Genesys → WebRTC)
- [x] Outbound calls work (WebRTC → Genesys)
- [x] Two-way audio works
- [x] Calls can be held/resumed
- [x] DTMF works
- [x] Dashboard shows all registrations
- [x] Dynamic registration works (register/unregister)

### **Bonus:**
- [ ] Test from external network (4G, home internet)
- [ ] Test with 20+ simultaneous agents
- [ ] Run for 24 hours without issues
- [ ] Record calls (if enabled)
- [ ] Test failover (restart Asterisk, verify re-registration)

---

## 📝 POC Demonstration Script

### **Demo Flow (15 minutes):**

**1. Introduction (2 min)**
```
"We've built a WebRTC gateway that allows agents to take calls 
from anywhere using just a web browser. Let me show you how it works."
```

**2. Show Architecture (3 min)**
```
Open: PRODUCTION_ARCHITECTURE.md
Point out: Agent Browser → Asterisk → Genesys → SBC → Provider
"This POC is running on a single server at 192.168.210.54"
```

**3. Live Demo (8 min)**
```
A. Open WebRTC client (http://192.168.210.54/)
   - Show clean interface
   - Explain DN, password

B. Register Agent 5001
   - Enter credentials
   - Click Connect
   - Show "Registered" status

C. Open Dashboard (http://192.168.210.54/dashboard.html)
   - Show agent appears in list
   - Show IP address, port
   - Show Genesys registration status

D. Make/Receive Test Call
   - Either dial out or have call come in
   - Show call timer
   - Show DTMF dialpad
   - Demonstrate hold/resume

E. Register Multiple Agents
   - Open 2-3 more browser tabs
   - Register 5002, 5003, 5004
   - Show dashboard updates in real-time
```

**4. Technical Details (2 min)**
```
"Behind the scenes:
- Asterisk handles WebRTC ↔ SIP conversion
- Dynamic registration to Genesys
- Built-in monitoring
- All in Docker containers for easy deployment"
```

**5. Q&A and Next Steps (2 min)**
```
"This POC proves the concept works. 
Next steps:
- Full enterprise deployment for 5000 agents
- High availability setup
- Production testing
- Phased rollout"
```

---

## 📋 POC Feedback Checklist

After POC, collect feedback on:

### **User Experience:**
- [ ] Is the interface intuitive?
- [ ] Is registration process clear?
- [ ] Are call controls easy to use?
- [ ] Is audio quality acceptable?
- [ ] Any missing features?

### **Technical:**
- [ ] Registration success rate
- [ ] Call setup time (< 3 seconds?)
- [ ] Audio quality (MOS score if measured)
- [ ] Any errors in logs?
- [ ] Performance of single server

### **Business:**
- [ ] Does this meet business requirements?
- [ ] Ready for pilot with real agents?
- [ ] Concerns about scaling to 5000?
- [ ] Timeline for full deployment?

---

## 🎯 Decision Points After POC

### **If POC is Successful:**

**Option 1: Small Pilot (Recommended)**
```
Deploy to 10-20 real agents for 1-2 weeks
- Use existing server (can handle 20-50 agents)
- Gather real-world feedback
- Identify any issues before big investment
```

**Option 2: Proceed to Full Deployment**
```
- Begin hardware procurement (12-16 weeks)
- Follow ENTERPRISE_DEPLOYMENT_CHECKLIST.md
- Follow ON_PREMISE_DEPLOYMENT_GUIDE.md
- Budget: $156K-230K
```

### **If POC Has Issues:**

**Fix and Re-test:**
```
- Document all issues
- Prioritize critical vs. nice-to-have
- Make fixes
- Re-test with same checklist
- Iterate until success criteria met
```

---

## 💡 POC Limitations (Set Expectations)

**What POC WON'T Show:**
1. **Scale:** Single server, not 5000 agents
2. **HA:** No failover, no load balancing
3. **Performance:** Not tested under heavy load
4. **Stability:** Short-term testing only
5. **Security:** May not have SSL/TLS yet
6. **Integration:** May not have full Genesys config

**Set These Expectations with Stakeholders!**

---

## 📞 Quick Reference - Common Commands

### **Check Status:**
```bash
# All services
sudo docker-compose ps

# Asterisk CLI
sudo docker exec -it webrtc-asterisk asterisk -rvvv

# View logs
sudo docker logs webrtc-asterisk
sudo docker logs webrtc-registration-monitor
sudo docker logs webrtc-dashboard-api

# Check registrations
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"
```

### **Restart Services:**
```bash
# Restart all
sudo docker-compose restart

# Restart specific service
sudo docker-compose restart asterisk
sudo docker-compose restart registration-monitor
```

### **View Logs in Real-Time:**
```bash
# Follow Asterisk logs
sudo docker logs -f webrtc-asterisk

# Follow monitor logs
sudo docker logs -f webrtc-registration-monitor

# Follow all logs
sudo docker-compose logs -f
```

---

## ✅ POC Completion Checklist

**Before presenting POC, verify:**

- [ ] All Docker containers running
- [ ] WebRTC client accessible (http://192.168.210.54/)
- [ ] Dashboard accessible (http://192.168.210.54/dashboard.html)
- [ ] At least 1 agent can register (5001)
- [ ] At least 1 test call successful
- [ ] No critical errors in logs
- [ ] Demo script prepared
- [ ] Screenshots/recordings taken
- [ ] Feedback form ready
- [ ] Next steps document prepared

---

## 🚀 After POC - Next Steps

### **Immediate (This Week):**
1. **Collect Feedback** from stakeholders
2. **Document Issues** encountered
3. **Decide:** Pilot vs. Full Deployment
4. **If Pilot:** Identify 10-20 agent volunteers
5. **If Full:** Begin budget approval process

### **Short Term (2-4 Weeks):**
1. **Small Pilot** (if chosen)
   - Deploy to 10-20 agents
   - Monitor daily
   - Collect feedback
   - Make improvements
2. **Hardware Procurement** (if going full scale)
   - Get vendor quotes
   - Submit POs
   - Track delivery (6-10 weeks)

### **Long Term (3-6 Months):**
1. **Full Deployment** (if all successful)
   - Follow enterprise checklist
   - 8-week deployment
   - Phased rollout to 5000 agents

---

**Document Version:** 1.0  
**Server:** 192.168.210.54  
**Last Updated:** December 16, 2025  
**Status:** Ready for POC Deployment


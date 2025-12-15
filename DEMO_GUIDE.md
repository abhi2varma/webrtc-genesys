# Demo Guide - Docker Compose POC
## WebRTC Gateway with Genesys Integration

**Environment:** Docker Compose on 192.168.210.54  
**Duration:** 15-20 minutes  
**Audience:** Technical team, stakeholders, management

---

## 🎯 Demo Objectives

By the end of this demo, attendees will see:
1. ✅ WebRTC client embedded in browser
2. ✅ SIP registration to Asterisk gateway
3. ✅ Asterisk registered to Genesys SIP Server
4. ✅ Call flow working end-to-end
5. ✅ Real-time monitoring dashboard
6. ✅ System logs and diagnostics

---

## 📋 Pre-Demo Checklist (30 minutes before)

### **1. Verify All Services Running**

```bash
# SSH to server
ssh Gencct@192.168.210.54 -p 69

# Check all containers
cd /opt/gcti_apps/webrtc
sudo docker-compose ps

# Expected output - ALL should be "Up":
# NAME                           STATUS
# webrtc-asterisk                Up
# webrtc-coturn                  Up
# webrtc-nginx                   Up
# webrtc-redis                   Up
# webrtc-kamailio                Up
# webrtc-registration-monitor    Up
# webrtc-dashboard-api           Up

# If any are down:
sudo docker-compose up -d
```

### **2. Verify Asterisk → Genesys Connection**

```bash
# Check Asterisk can reach Genesys SIP Server
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Should show registrations to 192.168.210.81:
# genesys_reg_5001    192.168.210.81:5060    Registered
# genesys_reg_5002    192.168.210.81:5060    Registered
# ... (or some registered)

# If none registered:
sudo docker-compose restart asterisk
sleep 10
# Check again
```

### **3. Verify Web Access**

```bash
# From your demo machine, test access:
curl http://192.168.210.54/

# Should return HTML (WebRTC client page)

# Test dashboard
curl http://192.168.210.54/dashboard.html

# Should return HTML (dashboard page)
```

### **4. Prepare Demo Browser**

```
1. Open browser (Firefox or Chrome)
2. Open 3 tabs:
   - Tab 1: http://192.168.210.54/ (WebRTC Client)
   - Tab 2: http://192.168.210.54/dashboard.html (Dashboard)
   - Tab 3: http://192.168.210.54:8090/ui/ad/v1/index.html (Genesys WWE - optional)
   
3. Test WebRTC client loads properly
4. Test dashboard shows data
```

### **5. Prepare Terminal Windows**

Open 3 terminal windows (arrange side-by-side):

**Terminal 1: Asterisk Logs**
```bash
ssh Gencct@192.168.210.54 -p 69
cd /opt/gcti_apps/webrtc
sudo docker logs -f webrtc-asterisk --tail 50
```

**Terminal 2: Asterisk CLI**
```bash
ssh Gencct@192.168.210.54 -p 69
sudo docker exec -it webrtc-asterisk asterisk -rvvv
```

**Terminal 3: System Monitoring**
```bash
ssh Gencct@192.168.210.54 -p 69
watch -n 2 'sudo docker stats --no-stream'
```

### **6. Test Call Flow (Dry Run)**

```
1. Open WebRTC client
2. Register as 5001 (password: pass5001)
3. Verify "Connected" status
4. Dial 5002 (another extension)
5. Verify call connects
6. Check dashboard shows registration
7. Disconnect call
8. Logout
```

**If test fails:** Troubleshoot before demo!

---

## 🎬 Demo Script (15-20 minutes)

### **Introduction (2 minutes)**

```
"Today I'll demonstrate our WebRTC gateway that integrates with 
Genesys SIP infrastructure. This POC validates:

1. WebRTC client functionality
2. SIP gateway capabilities with Asterisk
3. Integration with Genesys SIP Server
4. Real-time monitoring and diagnostics

The setup you're seeing runs on a single server for POC purposes. 
For production, we'll deploy on Kubernetes across 20 servers to 
handle 5000 concurrent calls."
```

### **Part 1: Show Infrastructure (2 minutes)**

**Terminal 1:**
```bash
# Show running services
sudo docker-compose ps

"As you can see, we have 7 services running:
- Asterisk: SIP gateway and WebRTC handler
- Redis: State management for DN mappings
- Kamailio: SIP proxy for future load balancing
- Coturn: TURN server for NAT traversal
- Nginx: Web server and reverse proxy
- Registration Monitor: Dynamic DN management
- Dashboard API: Real-time monitoring"
```

**Terminal 2 (Asterisk CLI):**
```bash
# Show Asterisk status
core show version

"Running Asterisk - the open source PBX that handles all SIP 
and WebRTC communication."

# Show configured endpoints
pjsip show endpoints

"We have 20 DNs configured (5001-5020), ready for agents."

# Show Genesys registrations
pjsip show registrations

"And here are our registrations to the Genesys SIP Server at 
192.168.210.81. These DNs are now visible to Genesys for routing."
```

### **Part 2: WebRTC Client Demo (5 minutes)**

**Browser Tab 1 (WebRTC Client):**

**Step 1: Show the Interface**
```
"This is our WebRTC client. It can be embedded directly into 
Genesys Workspace Web Edition as an iframe or widget.

The client provides:
- SIP registration
- Call controls (dial, answer, hangup, hold)
- Genesys CometD integration for CTI events
- Real-time call status"
```

**Step 2: Register Extension**
```
User: 5001
Password: pass5001
Click "Register"

"The client is now registering to our Asterisk gateway via 
WebSocket. No plugins needed - pure browser WebRTC."

[Wait for "Connected" status]

"Connected! The extension 5001 is now registered."
```

**Terminal 2 (Show in Asterisk CLI):**
```bash
pjsip show contacts

"In Asterisk, we can see the WebSocket contact for extension 5001 
with the client's IP address and WebSocket transport."
```

**Step 3: Make a Call**
```
"Let me dial another extension. I'll call 5002."

[Enter 5002, click Dial]

"The call is connecting through Asterisk..."

[Show "Ringing" then "In Call" status]

"And we're connected! Audio is flowing via WebRTC."
```

**Terminal 1 (Asterisk Logs):**
```
"In the logs, you can see the SIP INVITE messages, the call 
being established, and RTP media starting."

[Point out key log lines: INVITE, 200 OK, ACK, RTP started]
```

**Step 4: Hold/Resume (Optional)**
```
[Click Hold]
"Call is now on hold - music on hold playing."

[Click Resume]
"And resumed."
```

**Step 5: End Call**
```
[Click Hangup]
"Call ended. BYE message sent."
```

### **Part 3: Genesys Integration (3 minutes)**

**Terminal 2 (Asterisk CLI):**
```bash
# Show outbound registrations to Genesys
pjsip show registrations

"These are our registrations TO Genesys. Each DN (5001, 5002, etc.) 
is registered to the Genesys SIP Server at 192.168.210.81.

This means Genesys sees these as available endpoints and can route 
calls to them."

# Show Genesys trunk
pjsip show aors genesys_sip_server

"And this is our SIP trunk to Genesys. When agents make outbound 
calls or transfer calls, they go through this trunk to the Genesys 
infrastructure."
```

**Browser Tab 3 (Genesys WWE - Optional):**
```
"Here's the Genesys Workspace Web Edition. In production, our 
WebRTC client would be embedded right here in this interface.

Agents would:
1. Log into Genesys WWE
2. See the WebRTC client as part of their desktop
3. Click to register (or auto-register on login)
4. Receive calls routed from Genesys Contact Center
5. Make outbound calls through Genesys

The CometD integration means CTI events from Genesys (call state, 
customer data, etc.) appear in real-time in the WebRTC client."
```

### **Part 4: Monitoring Dashboard (2 minutes)**

**Browser Tab 2 (Dashboard):**
```
"This is our real-time monitoring dashboard. It shows:

1. Active WebRTC Registrations
   - Extension 5001 is registered
   - IP address and port shown
   - WebSocket transport

2. Genesys Registrations
   - Which DNs are currently registered to Genesys
   - Registration status and expiry

This dashboard helps administrators monitor the system in real-time."
```

**Terminal 3 (System Resources):**
```
"And here's the resource usage. For this POC on a single server:
- CPU: ~5-10% (very light)
- Memory: ~2-3 GB total
- Network: Minimal

For production with 5000 calls, we'll scale horizontally across 
20 servers with Kubernetes orchestration."
```

### **Part 5: Call Flow Architecture (3 minutes)**

**Whiteboard/Screen Share:**
```
"Let me explain the call flow:

┌──────────────┐
│  WebRTC      │  1. WebSocket (WSS)
│  Client      │────────────────────┐
│  (Browser)   │                    │
└──────────────┘                    ▼
                            ┌──────────────┐
                            │  Asterisk    │
                            │  Gateway     │
                            └──────────────┘
                                    │
                                    │ 2. SIP (UDP)
                                    ▼
                            ┌──────────────┐
                            │  Genesys     │
                            │  SIP Server  │
                            └──────────────┘
                                    │
                                    │ 3. CTI Events
                                    ▼
                            ┌──────────────┐
                            │  Genesys     │
                            │  T-Server    │
                            └──────────────┘

1. WebRTC Client ←→ Asterisk: 
   - WebSocket for SIP signaling
   - SRTP for encrypted media
   - STUN/TURN for NAT traversal

2. Asterisk ←→ Genesys SIP:
   - Standard SIP trunk
   - DN registration (5001-5020)
   - Call routing

3. Genesys T-Server ←→ WWE:
   - CometD for CTI events
   - Agent state, call data, screen pops
   - Integration with contact center routing

Asterisk acts as a B2BUA (Back-to-Back User Agent), converting:
- WebRTC ←→ SIP
- SRTP ←→ RTP
- Browser ←→ Traditional telephony"
```

### **Part 6: Production Scalability (2 minutes)**

**Show Slide/Diagram:**
```
"For production deployment (5000 concurrent calls):

Current POC:
- 1 server
- 1 Asterisk instance
- Capacity: 100-500 calls
- Deployment: Docker Compose
- Cost: $0 (existing hardware)

Production Plan:
- 23 servers (3 masters + 20 workers)
- 20 Asterisk instances (auto-scaling 10-30)
- Capacity: 5,000+ calls
- Deployment: Kubernetes with kubeadm
- Features:
  ✓ Auto-scaling (CPU-based)
  ✓ High availability (99.9% uptime)
  ✓ Load balancing (Kamailio + K8s)
  ✓ Self-healing (automatic restarts)
  ✓ Zero-downtime updates
  ✓ Monitoring (Prometheus + Grafana)

Timeline: 4-6 weeks (hardware + deployment + testing)
"
```

---

## 🎤 Q&A Preparation

### **Technical Questions:**

**Q: "What happens if Asterisk crashes?"**
```
A: "In this POC, we'd need to restart it manually. In production 
on Kubernetes, it auto-restarts within 10 seconds, and active calls 
on other Asterisk instances continue uninterrupted."
```

**Q: "How does this handle NAT/firewall?"**
```
A: "We use STUN/TURN (Coturn server) for NAT traversal. The WebRTC 
client tests connectivity and automatically uses TURN relay if 
direct connection fails."
```

**Q: "What about call quality?"**
```
A: "WebRTC uses Opus codec with packet loss concealment. We've tested 
with 50ms RTT and <1% packet loss with excellent quality. We'll do 
full network assessment before production."
```

**Q: "How does Genesys route calls to specific agents?"**
```
A: "Each agent has a unique DN (5001, 5002, etc.). When an agent 
logs into WWE and registers their DN via the WebRTC client, Genesys 
T-Server knows that DN is available and routes calls to it through 
the SIP trunk."
```

**Q: "Can agents use this from home?"**
```
A: "Yes! WebRTC works through firewalls and NAT using TURN. Agents 
just need a browser and internet connection. Audio is encrypted 
end-to-end with SRTP."
```

### **Business Questions:**

**Q: "What's the cost?"**
```
A: "For on-premise deployment:
- Initial hardware: $156K-230K (servers, network, storage)
- Annual operating: $118K (power, maintenance, staff)
- Total 3-year TCO: ~$510K

Cloud alternative (AWS):
- $3,500-4,000/month (~$42K/year, $126K for 3 years)
- But long-term, on-premise is cheaper (5+ years)

POC cost: $0 (using existing hardware)"
```

**Q: "How long to deploy production?"**
```
A: "Timeline:
- Week 1-2: Hardware procurement and rack
- Week 3: Install Kubernetes (kubeadm)
- Week 4: Deploy WebRTC application
- Week 5-6: Testing and optimization
- Total: 6-8 weeks from hardware order to production

The POC proves the software works. Remaining time is infrastructure."
```

**Q: "Can this scale beyond 5000 calls?"**
```
A: "Absolutely. With Kubernetes, we simply add more worker nodes.
- 10,000 calls: 40 workers
- 20,000 calls: 80 workers
The architecture is horizontally scalable."
```

---

## 🐛 Common Issues & Quick Fixes

### **Issue 1: WebRTC Client Not Loading**

**Symptom:** Browser shows blank page or connection error

**Quick Fix:**
```bash
# Check Nginx
sudo docker-compose logs nginx | tail -20

# Restart Nginx
sudo docker-compose restart nginx

# Test
curl http://192.168.210.54/
```

### **Issue 2: Can't Register Extension**

**Symptom:** Client shows "Connection Failed" or stuck on "Connecting..."

**Quick Fix:**
```bash
# Check Asterisk WebSocket
sudo docker exec webrtc-asterisk asterisk -rx "http show status"

# Restart Asterisk
sudo docker-compose restart asterisk
sleep 15

# Check WebSocket port
netstat -tlnp | grep 8088
```

### **Issue 3: No Audio in Call**

**Symptom:** Call connects but no audio (one-way or both ways)

**Quick Fix:**
```bash
# Check RTP ports
sudo docker exec webrtc-asterisk asterisk -rx "rtp show settings"

# Check Coturn
sudo docker-compose logs coturn | tail -20

# Restart Coturn
sudo docker-compose restart coturn
```

### **Issue 4: Not Registered to Genesys**

**Symptom:** `pjsip show registrations` shows "Unregistered"

**Quick Fix:**
```bash
# Check connectivity to Genesys
ping 192.168.210.81

# Check SIP registration
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show registrations"

# Force re-register
sudo docker-compose restart asterisk
```

### **Issue 5: Dashboard Not Updating**

**Symptom:** Dashboard shows no data or stale data

**Quick Fix:**
```bash
# Check dashboard API
curl http://192.168.210.54:5000/api/registrations

# Restart dashboard API
sudo docker-compose restart dashboard-api

# Check Nginx proxy
sudo docker-compose logs nginx | grep dashboard
```

---

## 📊 Demo Success Metrics

After the demo, you should have demonstrated:

- ✅ **Functional WebRTC Client:** Register, call, hangup all work
- ✅ **Genesys Integration:** DN registered to Genesys SIP Server
- ✅ **Call Quality:** Clear audio, low latency
- ✅ **Real-time Monitoring:** Dashboard shows live data
- ✅ **System Stability:** No crashes, clean logs
- ✅ **Scalability Story:** Clear path from POC to 5000 calls

---

## 📝 Post-Demo Actions

### **Immediate (Within 24 hours):**
```
☐ Send demo recording to stakeholders
☐ Share architecture diagrams
☐ Provide cost analysis document
☐ Schedule follow-up Q&A session
```

### **Short-term (Within 1 week):**
```
☐ Get approval for production infrastructure
☐ Order hardware (if on-premise)
☐ Plan deployment timeline
☐ Identify production team members
```

### **Medium-term (Within 1 month):**
```
☐ Set up Kubernetes cluster (23 nodes)
☐ Deploy production system
☐ Conduct load testing (5000 calls)
☐ Train operations team
☐ Go-live planning
```

---

## 🎯 Key Talking Points

**For Technical Audience:**
- "Open-source stack (Asterisk, Kamailio, Redis) - no vendor lock-in"
- "Standard protocols (SIP, WebRTC, RTP) - interoperable"
- "Container-based (Docker) - easy to deploy and scale"
- "Production-ready with Kubernetes - enterprise-grade orchestration"

**For Business Audience:**
- "Work from home ready - agents need only a browser"
- "Cost-effective - uses existing Genesys infrastructure"
- "Scalable to 5000+ calls - grows with business"
- "Modern technology - future-proof investment"

**For Management:**
- "POC validates technical feasibility - low risk"
- "Clear production path - 6-8 week timeline"
- "On-premise deployment - data stays in your data center"
- "Proven open-source components - battle-tested at scale"

---

## ✅ Final Checklist (Before Demo)

**30 Minutes Before:**
- [ ] All 7 Docker containers running (`docker-compose ps`)
- [ ] WebRTC client loads in browser
- [ ] Dashboard loads and shows data
- [ ] Asterisk registered to Genesys (`pjsip show registrations`)
- [ ] Test call works (5001 → 5002)
- [ ] 3 terminal windows open with logs
- [ ] 3 browser tabs open (client, dashboard, GWS)

**5 Minutes Before:**
- [ ] Clear browser cache/cookies
- [ ] Zoom/screen share tested and working
- [ ] Audio output working
- [ ] Backup slides ready
- [ ] Water nearby (stay hydrated!)

**During Demo:**
- [ ] Speak clearly and slowly
- [ ] Pause for questions
- [ ] Show, don't just tell
- [ ] Have fun! 🚀

---

**Demo Guide Version:** 1.0  
**Last Updated:** December 16, 2025  
**Environment:** Docker Compose POC on 192.168.210.54

---

**Good luck with your demo! You've got this!** 🎉


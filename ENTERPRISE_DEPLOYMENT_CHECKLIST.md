# Enterprise WebRTC Gateway Deployment Checklist
## 5000 Concurrent Calls - Production Scale

**Target Capacity:** 5,000 simultaneous calls  
**Architecture:** Distributed Asterisk cluster with load balancing  
**Timeline:** 4-8 weeks (depending on team size and resources)

---

## 📋 Phase 1: Planning & Design (Week 1)

### **Architecture Design**
- [ ] Review and approve production architecture
- [ ] Finalize server count (10-20 Asterisk instances)
- [ ] Design network topology (VLANs, subnets)
- [ ] Plan IP addressing scheme
- [ ] Design high availability strategy
- [ ] Document failover procedures
- [ ] Create disaster recovery plan

### **Capacity Planning**
- [ ] Calculate bandwidth requirements (500 Mbps - 1 Gbps)
- [ ] Determine concurrent call distribution per instance
- [ ] Plan DN ranges (5000+ DNs)
- [ ] Calculate storage requirements for logs/recordings
- [ ] Plan database capacity (Redis)
- [ ] Estimate costs (cloud vs. on-premise)

### **Infrastructure Decision**
- [ ] **Decision:** Cloud vs. On-Premise vs. Hybrid
- [ ] **If Cloud:** Select provider (AWS/Azure/GCP)
- [ ] **If Cloud:** Select regions/availability zones
- [ ] **If On-Premise:** Order hardware (8-12 week lead time)
- [ ] **If On-Premise:** Prepare data center space/cooling/power

### **Network Planning**
- [ ] Obtain public IP addresses (or plan NAT/load balancer IPs)
- [ ] Plan firewall rules (public & internal)
- [ ] Design DMZ network segments
- [ ] Plan VPN access for management
- [ ] Coordinate with network team
- [ ] Reserve DNS names (webrtc.company.com)

### **Security Planning**
- [ ] SSL certificate procurement plan
- [ ] Security audit requirements
- [ ] Penetration testing schedule
- [ ] Compliance requirements (PCI-DSS, HIPAA, etc.)
- [ ] Data retention policies
- [ ] Encryption standards

### **Team & Resources**
- [ ] Assign project manager
- [ ] Assign technical lead
- [ ] Identify Asterisk/VoIP engineer(s)
- [ ] Identify network engineer
- [ ] Identify DevOps engineer
- [ ] Plan training for operations team
- [ ] Schedule regular project meetings

---

## 🖥️ Phase 2: Infrastructure Provisioning (Week 2-3)

### **Core Infrastructure**

#### **Load Balancers (2x for HA)**
- [ ] Provision Load Balancer #1 (Primary)
  - [ ] **Spec:** 8 CPU, 16 GB RAM, 1 Gbps NIC
  - [ ] Install OS (CentOS 8 / Ubuntu 20.04)
  - [ ] Configure IP: `192.168.210.90`
  - [ ] Install HAProxy
- [ ] Provision Load Balancer #2 (Backup)
  - [ ] **Spec:** 8 CPU, 16 GB RAM, 1 Gbps NIC
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.91`
  - [ ] Install HAProxy
- [ ] Configure keepalived for Virtual IP (VIP)
- [ ] Test HA failover

#### **Kamailio SIP Proxies (2x for HA)**
- [ ] Provision Kamailio #1
  - [ ] **Spec:** 8 CPU, 16 GB RAM, 1 Gbps NIC
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.92`
  - [ ] Install Kamailio 5.6+
- [ ] Provision Kamailio #2
  - [ ] **Spec:** 8 CPU, 16 GB RAM, 1 Gbps NIC
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.93`
  - [ ] Install Kamailio 5.6+
- [ ] Configure dispatcher (load balancing)
- [ ] Test SIP routing

#### **Redis Cluster (3 nodes)**
- [ ] Provision Redis #1 (Master)
  - [ ] **Spec:** 4 CPU, 16 GB RAM
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.200`
  - [ ] Install Redis 7.x
- [ ] Provision Redis #2 (Replica)
  - [ ] **Spec:** 4 CPU, 16 GB RAM
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.201`
  - [ ] Install Redis 7.x
- [ ] Provision Redis #3 (Replica)
  - [ ] **Spec:** 4 CPU, 16 GB RAM
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.202`
  - [ ] Install Redis 7.x
- [ ] Configure replication (master-slave)
- [ ] Install Redis Sentinel (automatic failover)
- [ ] Test failover

#### **Asterisk Cluster (10 instances minimum)**
- [ ] Provision Asterisk #1
  - [ ] **Spec:** 12 CPU, 24 GB RAM, 1 Gbps NIC, 200 GB SSD
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.101`
  - [ ] Install Docker & Docker Compose
- [ ] Provision Asterisk #2-10 (repeat above for each)
  - [ ] Asterisk #2: `192.168.210.102`
  - [ ] Asterisk #3: `192.168.210.103`
  - [ ] Asterisk #4: `192.168.210.104`
  - [ ] Asterisk #5: `192.168.210.105`
  - [ ] Asterisk #6: `192.168.210.106`
  - [ ] Asterisk #7: `192.168.210.107`
  - [ ] Asterisk #8: `192.168.210.108`
  - [ ] Asterisk #9: `192.168.210.109`
  - [ ] Asterisk #10: `192.168.210.110`

#### **Monitoring & Logging**
- [ ] Provision Monitoring Server
  - [ ] **Spec:** 8 CPU, 32 GB RAM, 500 GB storage
  - [ ] Install OS
  - [ ] Configure IP: `192.168.210.250`
  - [ ] Install Prometheus
  - [ ] Install Grafana
  - [ ] Install ELK Stack (Elasticsearch, Logstash, Kibana)
- [ ] Provision Log Aggregation Server (optional, separate)
  - [ ] **Spec:** 8 CPU, 32 GB RAM, 1 TB storage

### **Network Configuration**
- [ ] Configure VLANs
  - [ ] Management VLAN
  - [ ] DMZ VLAN (load balancers)
  - [ ] Internal VLAN (Asterisk, Kamailio, Redis)
  - [ ] Monitoring VLAN
- [ ] Configure routing between VLANs
- [ ] Setup internal DNS (for service discovery)
- [ ] Configure NTP servers (time synchronization critical!)
- [ ] Setup firewall rules (documented separately)

### **Storage & Backup**
- [ ] Setup shared storage (NFS/SAN) for logs if needed
- [ ] Configure backup solution
- [ ] Test backup and restore procedures
- [ ] Plan log retention (30-90 days)

---

## 🔧 Phase 3: Core Services Deployment (Week 3-4)

### **Redis Cluster Setup**
- [ ] Deploy Redis containers on all 3 nodes
- [ ] Configure master-replica replication
- [ ] Install and configure Redis Sentinel
- [ ] Test Redis failover (kill master, verify replica promotion)
- [ ] Create Redis backup job (daily snapshots)
- [ ] Document Redis connection strings

### **Kamailio SIP Proxy Setup**
- [ ] Deploy Kamailio on both nodes
- [ ] Configure dispatcher module (load balancing)
- [ ] Configure Redis integration for registration storage
- [ ] Create dispatcher list (Asterisk instance IPs)
- [ ] Configure SIP routing rules
- [ ] Enable health checks (OPTIONS ping)
- [ ] Configure logging to syslog
- [ ] Test SIP registration through Kamailio
- [ ] Test call routing between Kamailio and mock Asterisk
- [ ] Configure HA between both Kamailio instances

### **HAProxy Load Balancer Setup**
- [ ] Deploy HAProxy on both nodes
- [ ] Configure WebSocket load balancing (sticky sessions)
- [ ] Configure HTTPS/SSL termination
- [ ] Add all Asterisk instances as backend servers
- [ ] Configure health checks (`/health` endpoint)
- [ ] Set load balancing algorithm (leastconn recommended)
- [ ] Configure logging
- [ ] Setup keepalived for VIP failover
- [ ] Test VIP failover (shutdown primary, verify backup takes over)
- [ ] Test load distribution (connect multiple clients)

### **DNS & SSL**
- [ ] Create DNS A record: `webrtc.company.com` → VIP
- [ ] Obtain SSL certificate (Let's Encrypt or commercial)
  - [ ] Request certificate for `webrtc.company.com`
  - [ ] Request wildcard cert if needed: `*.webrtc.company.com`
  - [ ] Verify certificate chain is complete
- [ ] Install SSL certificate on HAProxy
- [ ] Test HTTPS access
- [ ] Setup certificate auto-renewal (if Let's Encrypt)

---

## 📞 Phase 4: Asterisk Cluster Deployment (Week 4-5)

### **Code Preparation**
- [ ] Clone Git repository on all Asterisk servers
- [ ] Create deployment scripts for multi-instance setup
- [ ] Prepare configuration templates
  - [ ] `pjsip.conf` template with instance-specific DN ranges
  - [ ] `extensions.conf` template
  - [ ] `rtp.conf` template
  - [ ] `manager.conf` template
- [ ] Create environment file template (`.env`)

### **DN Range Planning**
- [ ] Define DN ranges per Asterisk instance
  - [ ] Instance #1: 5001-5500 (500 DNs)
  - [ ] Instance #2: 5501-6000 (500 DNs)
  - [ ] Instance #3: 6001-6500 (500 DNs)
  - [ ] Instance #4: 6501-7000 (500 DNs)
  - [ ] Instance #5: 7001-7500 (500 DNs)
  - [ ] Instance #6: 7501-8000 (500 DNs)
  - [ ] Instance #7: 8001-8500 (500 DNs)
  - [ ] Instance #8: 8501-9000 (500 DNs)
  - [ ] Instance #9: 9001-9500 (500 DNs)
  - [ ] Instance #10: 9501-10000 (500 DNs)
- [ ] Document DN to instance mapping in Redis

### **Deploy Asterisk Instance #1** (Pilot)
- [ ] SSH to server `192.168.210.101`
- [ ] Pull latest code from Git
- [ ] Update configuration for instance #1
  - [ ] Set DN range: 5001-5500
  - [ ] Set external IP: `192.168.210.101`
  - [ ] Configure Genesys SIP server: `192.168.210.81`
  - [ ] Configure Redis connection: `192.168.210.200`
- [ ] Create log directories
- [ ] Start Docker containers
  ```bash
  cd /opt/gcti_apps/webrtc
  docker-compose up -d
  ```
- [ ] Verify containers running
  ```bash
  docker-compose ps
  ```
- [ ] Check logs for errors
  ```bash
  docker logs webrtc-asterisk
  ```
- [ ] Test WebSocket connection from client
- [ ] Test registration of DN 5001
- [ ] Test call through Asterisk to Genesys

### **Deploy Asterisk Instances #2-10**
For each instance, repeat:
- [ ] SSH to server
- [ ] Pull code
- [ ] Update configuration (DN range, IP)
- [ ] Start containers
- [ ] Verify startup
- [ ] Test basic registration
- [ ] Add to HAProxy backend (hot reload)
- [ ] Add to Kamailio dispatcher list

### **Registration Monitor Deployment**
- [ ] Deploy registration-monitor on all Asterisk instances
- [ ] Configure Redis integration in monitor
- [ ] Update monitor to store instance mapping
- [ ] Test dynamic registration (WebRTC → Asterisk → Genesys)
- [ ] Verify Redis stores DN → instance mapping
- [ ] Test unregistration cleanup

### **Dashboard Deployment**
- [ ] Deploy dashboard API on dedicated server or co-located
- [ ] Configure to query all Asterisk AMI instances
- [ ] Configure to query Redis for DN distribution
- [ ] Create cluster-wide dashboard
  - [ ] Show total registrations (all instances)
  - [ ] Show per-instance statistics
  - [ ] Show Redis cluster health
  - [ ] Show Kamailio status
- [ ] Test dashboard access

---

## 🔥 Phase 5: Load Balancing & High Availability (Week 5-6)

### **Load Balancer Configuration**
- [ ] Add all 10 Asterisk instances to HAProxy backend
- [ ] Verify sticky sessions work (same client → same server)
- [ ] Test load distribution
  - [ ] Connect 10 clients simultaneously
  - [ ] Verify clients distributed across instances
- [ ] Configure connection limits per instance
- [ ] Setup backend server weights (if needed)
- [ ] Configure timeouts (WebSocket idle, health check)

### **Kamailio Integration**
- [ ] Update Kamailio dispatcher with all Asterisk IPs
- [ ] Test SIP REGISTER through Kamailio → Asterisk
- [ ] Test INVITE routing (incoming calls)
- [ ] Verify Kamailio selects correct Asterisk based on DN
- [ ] Test failover (shutdown one Asterisk, verify re-routing)

### **Health Checks & Monitoring**
- [ ] Create health check endpoint on each Asterisk
  ```bash
  # Test: curl http://192.168.210.101:8088/health
  # Expected: {"status":"ok","registrations":234}
  ```
- [ ] Configure HAProxy health checks (every 5s)
- [ ] Test automatic backend removal (kill Asterisk, verify HAProxy stops sending traffic)
- [ ] Test automatic backend addition (restart Asterisk, verify HAProxy resumes traffic)
- [ ] Setup alerts for backend down events

### **Failover Testing**
- [ ] Test Asterisk instance failure
  - [ ] Shutdown instance #1
  - [ ] Verify HAProxy removes it from rotation
  - [ ] Verify new clients go to other instances
  - [ ] Verify existing clients on instance #1 can reconnect
- [ ] Test Load Balancer failover
  - [ ] Shutdown HAProxy #1 (primary)
  - [ ] Verify VIP moves to HAProxy #2
  - [ ] Verify clients can still connect
  - [ ] Bring HAProxy #1 back, verify VIP returns
- [ ] Test Kamailio failover
  - [ ] Shutdown Kamailio #1
  - [ ] Update Genesys to use Kamailio #2
  - [ ] Verify calls still route
- [ ] Test Redis failover
  - [ ] Kill Redis master
  - [ ] Verify Sentinel promotes replica
  - [ ] Verify applications reconnect automatically

---

## 🧪 Phase 6: Testing & Validation (Week 6-7)

### **Functional Testing**
- [ ] Test basic registration (1 client)
- [ ] Test 10 simultaneous registrations
- [ ] Test 100 simultaneous registrations
- [ ] Test 500 simultaneous registrations
- [ ] Test 1000 simultaneous registrations
- [ ] Test inbound call (PSTN → Agent)
- [ ] Test outbound call (Agent → PSTN)
- [ ] Test call transfer
- [ ] Test call hold/resume
- [ ] Test DTMF
- [ ] Test call recording (if enabled)

### **Load Testing**
- [ ] Install load testing tools
  - [ ] SIPp for SIP load testing
  - [ ] JMeter with WebSocket plugin
  - [ ] Custom WebRTC load generator
- [ ] Test 1000 concurrent calls (20% capacity)
  - [ ] Monitor CPU usage on all servers
  - [ ] Monitor network bandwidth
  - [ ] Monitor call quality (MOS scores)
  - [ ] Check for dropped calls
- [ ] Test 2500 concurrent calls (50% capacity)
  - [ ] Same monitoring as above
  - [ ] Verify no performance degradation
- [ ] Test 5000 concurrent calls (100% capacity)
  - [ ] Full system stress test
  - [ ] Monitor for 1 hour continuous
  - [ ] Check error rates
  - [ ] Verify audio quality
- [ ] Test burst scenarios (1000 calls in 1 minute)
- [ ] Test sustained load (5000 calls for 8 hours)

### **Network Testing**
- [ ] Test from various locations
  - [ ] Office network
  - [ ] Home broadband
  - [ ] 4G/5G mobile
  - [ ] Public WiFi (coffee shop)
  - [ ] International (if applicable)
- [ ] Test NAT traversal with TURN server
- [ ] Test with corporate firewall/proxy
- [ ] Measure latency (RTT) from various locations
- [ ] Test packet loss scenarios (simulate 1%, 5%, 10% loss)

### **Security Testing**
- [ ] SSL/TLS verification
  - [ ] Verify SSL Labs grade A or higher
  - [ ] Check certificate validity
  - [ ] Verify no mixed content warnings
- [ ] Authentication testing
  - [ ] Test invalid credentials
  - [ ] Test brute force protection
- [ ] Penetration testing
  - [ ] SIP scanning (sipvicious)
  - [ ] WebSocket fuzzing
  - [ ] OWASP Top 10 web vulnerabilities
- [ ] DDoS testing (controlled)
  - [ ] Test connection flooding
  - [ ] Test registration flooding

### **Integration Testing**
- [ ] Test Genesys SIP Server integration
  - [ ] Verify all DNs registered in Genesys
  - [ ] Test call routing from Genesys to WebRTC agents
  - [ ] Test call routing from WebRTC agents to Genesys
- [ ] Test WWE integration
  - [ ] Embed WebRTC widget in WWE
  - [ ] Test CometD event synchronization
  - [ ] Test call state updates in WWE
- [ ] Test with existing SBC/provider
  - [ ] Verify provider calls reach WebRTC agents
  - [ ] Test call quality end-to-end

### **Disaster Recovery Testing**
- [ ] Test complete data center failure
- [ ] Test database corruption recovery
- [ ] Test backup restoration
- [ ] Test configuration recovery
- [ ] Document recovery time objective (RTO)
- [ ] Document recovery point objective (RPO)

---

## 🚀 Phase 7: Production Launch (Week 7-8)

### **Pre-Launch Checklist**
- [ ] All tests passed (functional, load, security)
- [ ] Documentation complete
  - [ ] Architecture diagrams
  - [ ] Network diagrams
  - [ ] Configuration documentation
  - [ ] Runbooks for common issues
  - [ ] Escalation procedures
- [ ] Monitoring dashboards created
  - [ ] System health dashboard
  - [ ] Call quality dashboard
  - [ ] Capacity dashboard
  - [ ] Security dashboard
- [ ] Alerting configured
  - [ ] Server down alerts
  - [ ] High CPU/memory alerts
  - [ ] Call failure rate alerts
  - [ ] Disk space alerts
- [ ] Operations team trained
  - [ ] How to access dashboards
  - [ ] How to restart services
  - [ ] How to check logs
  - [ ] Troubleshooting procedures
- [ ] Change control approval obtained
- [ ] Rollback plan documented and tested

### **Soft Launch (Beta)**
- [ ] Select 50-100 pilot users (agents)
- [ ] Communicate maintenance window
- [ ] Enable access for pilot users
- [ ] Monitor closely for 1 week
  - [ ] Daily log review
  - [ ] Daily dashboard review
  - [ ] Daily check-in with pilot users
- [ ] Collect feedback
- [ ] Fix any critical issues
- [ ] Verify no major problems

### **Phased Rollout**
- [ ] **Week 1:** 500 users (10% capacity)
  - [ ] Enable access
  - [ ] Monitor for issues
  - [ ] Collect feedback
- [ ] **Week 2:** 1500 users (30% capacity)
  - [ ] Enable access
  - [ ] Monitor for issues
  - [ ] Verify performance stable
- [ ] **Week 3:** 3000 users (60% capacity)
  - [ ] Enable access
  - [ ] Monitor load balancing
  - [ ] Check for bottlenecks
- [ ] **Week 4:** 5000 users (100% capacity)
  - [ ] Full production launch
  - [ ] All users enabled
  - [ ] 24/7 monitoring

### **Production Cutover**
- [ ] Schedule maintenance window
- [ ] Send notifications to users
- [ ] Execute cutover plan
  - [ ] Final configuration backup
  - [ ] Enable production traffic
  - [ ] Disable old system (if replacing)
  - [ ] Monitor for 4 hours continuously
- [ ] Verify all systems operational
- [ ] Send "go-live" confirmation
- [ ] Celebrate! 🎉

---

## 📊 Phase 8: Monitoring & Optimization (Ongoing)

### **Daily Operations**
- [ ] Review monitoring dashboards
  - [ ] System health (CPU, memory, disk, network)
  - [ ] Call quality (MOS scores, jitter, packet loss)
  - [ ] Registration counts
  - [ ] Error rates
- [ ] Review log aggregation (ELK)
  - [ ] Look for errors
  - [ ] Look for unusual patterns
- [ ] Check alert queue
- [ ] Verify backups completed successfully

### **Weekly Operations**
- [ ] Review capacity trends
  - [ ] Peak concurrent calls
  - [ ] Average call duration
  - [ ] Bandwidth utilization
- [ ] Review performance metrics
  - [ ] Call setup time (SIP INVITE → 200 OK)
  - [ ] Registration success rate
  - [ ] Call completion rate
- [ ] Check for software updates
  - [ ] Asterisk updates
  - [ ] HAProxy updates
  - [ ] Kamailio updates
  - [ ] OS security patches
- [ ] Review security logs
- [ ] Test backup restoration (monthly, but schedule weekly check)

### **Monthly Operations**
- [ ] Capacity planning review
  - [ ] Project growth for next 3-6 months
  - [ ] Plan for additional servers if needed
- [ ] Performance optimization
  - [ ] Review slow queries (if using DB)
  - [ ] Optimize configuration
  - [ ] Tune kernel parameters if needed
- [ ] Security audit
  - [ ] Review access logs
  - [ ] Review firewall rules
  - [ ] Check for vulnerabilities
- [ ] Disaster recovery drill
  - [ ] Test failover procedures
  - [ ] Test backup restoration
  - [ ] Update runbooks based on findings

### **Quarterly Operations**
- [ ] Infrastructure review
  - [ ] Review server utilization
  - [ ] Right-size instances (cloud)
  - [ ] Plan hardware refresh (on-premise)
- [ ] Business continuity testing
  - [ ] Full DR test
  - [ ] Chaos engineering (controlled failures)
- [ ] Cost optimization
  - [ ] Review cloud spending
  - [ ] Identify waste
  - [ ] Reserved instances/savings plans
- [ ] Architecture review
  - [ ] Assess need for scaling
  - [ ] Review new technologies
  - [ ] Plan major upgrades

---

## 📈 Success Metrics

### **Technical KPIs**
- [ ] Uptime: 99.9% or higher
- [ ] Call setup time: < 3 seconds
- [ ] Registration success rate: > 99%
- [ ] Call completion rate: > 98%
- [ ] MOS score: > 4.0 (scale 1-5)
- [ ] Packet loss: < 1%
- [ ] Jitter: < 30ms
- [ ] Latency: < 150ms

### **Business KPIs**
- [ ] User satisfaction score
- [ ] Cost per agent/month
- [ ] Incident count per month
- [ ] Mean time to resolution (MTTR)
- [ ] Agent productivity improvement

---

## ⚠️ Risk Register

### **High Risk Items**
- [ ] **Risk:** Insufficient bandwidth
  - **Mitigation:** Monitor utilization, upgrade if > 70%
- [ ] **Risk:** Single point of failure
  - **Mitigation:** HA for all critical components
- [ ] **Risk:** Database (Redis) overload
  - **Mitigation:** Monitor queries, add sharding if needed
- [ ] **Risk:** DDoS attack
  - **Mitigation:** Rate limiting, DDoS protection service
- [ ] **Risk:** Certificate expiration
  - **Mitigation:** Automated renewal, monitoring alerts

### **Medium Risk Items**
- [ ] **Risk:** Asterisk instance failure
  - **Mitigation:** N+2 configuration, automatic failover
- [ ] **Risk:** Configuration drift across instances
  - **Mitigation:** Configuration management (Ansible/Puppet)
- [ ] **Risk:** Log disk full
  - **Mitigation:** Log rotation, monitoring

---

## 🎯 Final Pre-Launch Checklist

**Before going to production, verify ALL items below:**

- [ ] All infrastructure provisioned and configured
- [ ] All services deployed and running
- [ ] All tests passed (functional, load, security, integration)
- [ ] Monitoring and alerting operational
- [ ] Documentation complete
- [ ] Operations team trained
- [ ] Disaster recovery plan tested
- [ ] Change control approved
- [ ] Rollback plan ready
- [ ] Stakeholders notified
- [ ] Support team on standby
- [ ] Escalation paths defined
- [ ] Go/No-Go meeting held
- [ ] **Final approval obtained from project sponsor**

---

## 📞 Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Project Manager | [Name] | [Phone] | [Email] |
| Technical Lead | [Name] | [Phone] | [Email] |
| Asterisk Engineer | [Name] | [Phone] | [Email] |
| Network Engineer | [Name] | [Phone] | [Email] |
| DevOps Engineer | [Name] | [Phone] | [Email] |
| Escalation (24/7) | [Name] | [Phone] | [Email] |

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Next Review:** Weekly during deployment, Monthly post-launch


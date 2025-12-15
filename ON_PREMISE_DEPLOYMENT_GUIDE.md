# On-Premise Enterprise Deployment Guide
## 5000 Concurrent Calls - Hardware Infrastructure

**Deployment Type:** On-Premise  
**Target Capacity:** 5,000 simultaneous calls  
**Timeline:** 12-16 weeks (including hardware procurement)

---

## 💰 Total Cost Estimate

### **Initial Capital Investment**
```
Hardware Servers:           $80,000 - $120,000
Network Equipment:          $20,000 - $30,000
Storage (SAN/NAS):         $10,000 - $15,000
UPS/Power:                 $5,000 - $10,000
Rack & Cabling:            $3,000 - $5,000
-------------------------------------------------
Total Hardware:            $118,000 - $180,000

Contingency (15%):         $18,000 - $27,000
-------------------------------------------------
TOTAL INVESTMENT:          $136,000 - $207,000
```

### **Annual Operating Costs**
```
Power (estimate):          $6,000/year
Internet Bandwidth:        $12,000/year
Maintenance Contracts:     $15,000/year
Spare Parts:              $5,000/year
IT Staff (dedicated):      $80,000/year (1 person)
-------------------------------------------------
Total Operating:          $118,000/year
```

### **Cloud Comparison (Break-even Analysis)**
```
Cloud Cost: $10,000/month × 12 = $120,000/year

Break-even Point:
- Initial Investment: $136,000
- Annual Savings: $120,000 - $118,000 = $2,000/year
- Break-even: ~68 months (5.6 years)

Note: More accurate break-even ~36 months when considering:
- Cloud costs increase with usage
- Hardware depreciation over 5 years
- Lower operating costs after initial setup
```

---

## 🖥️ Hardware Specifications

### **Asterisk Servers (10 units)**

**Recommended Model:** Dell PowerEdge R750 or HPE ProLiant DL380 Gen11

**Configuration per server:**
```
CPU: 2× Intel Xeon Gold 6326 (16 cores each, 32 cores total)
  - Base: 2.9 GHz, Turbo: 3.5 GHz
  - Or AMD EPYC 7443P (24 cores)

RAM: 128 GB DDR4 ECC (8× 16GB modules)
  - Upgradeable to 256 GB if needed

Storage:
  - 2× 480 GB SSD (RAID 1) - OS
  - 2× 1.92 TB SSD (RAID 1) - Logs/Data

Network:
  - 4× 1 GbE ports (or 2× 10 GbE)
  - Dual-port for redundancy

Power Supply:
  - Dual redundant 800W PSUs

Remote Management:
  - iDRAC Enterprise (Dell) or iLO (HPE)

Warranty:
  - 3-year NBD (Next Business Day) on-site
```

**Cost per server:** $8,000 - $12,000  
**Total (10 servers):** $80,000 - $120,000

**Vendor Options:**
- Dell: PowerEdge R750, R650
- HPE: ProLiant DL380 Gen11, DL360 Gen11
- Supermicro: SuperServer 2U (more affordable, $6,000-8,000)
- Lenovo: ThinkSystem SR650 V3

---

### **Load Balancers (2 units for HA)**

**Recommended Model:** Dell PowerEdge R450 or HPE ProLiant DL20 Gen11

**Configuration per server:**
```
CPU: 1× Intel Xeon E-2378 (8 cores, 2.6 GHz)
RAM: 32 GB DDR4 ECC
Storage: 2× 240 GB SSD (RAID 1)
Network: 4× 1 GbE (or 2× 10 GbE for high throughput)
PSU: Dual redundant
Remote Management: iDRAC/iLO
Warranty: 3-year NBD
```

**Cost per server:** $3,000 - $5,000  
**Total (2 servers):** $6,000 - $10,000

---

### **Kamailio SIP Proxies (2 units for HA)**

**Recommended Model:** Same as Load Balancers (Dell R450 / HPE DL20)

**Configuration:** Same as load balancers  
**Cost per server:** $3,000 - $5,000  
**Total (2 servers):** $6,000 - $10,000

---

### **Redis Cluster (3 units)**

**Recommended Model:** Dell PowerEdge R350 or HPE ProLiant DL20 Gen11

**Configuration per server:**
```
CPU: 1× Intel Xeon E-2378 (8 cores)
RAM: 64 GB DDR4 ECC (Redis is memory-intensive)
Storage: 2× 480 GB SSD (RAID 1)
Network: 4× 1 GbE
PSU: Dual redundant
Remote Management: iDRAC/iLO
Warranty: 3-year NBD
```

**Cost per server:** $3,500 - $5,500  
**Total (3 servers):** $10,500 - $16,500

---

### **Monitoring Server (1 unit)**

**Recommended Model:** Dell PowerEdge R750 or HPE DL380

**Configuration:**
```
CPU: 2× Intel Xeon Gold 5320 (26 cores each)
RAM: 256 GB DDR4 ECC (for Elasticsearch)
Storage:
  - 2× 480 GB SSD (RAID 1) - OS
  - 4× 3.84 TB SSD (RAID 10) - Logs/Metrics
Network: 4× 1 GbE
PSU: Dual redundant
Remote Management: iDRAC/iLO
Warranty: 3-year NBD
```

**Cost:** $12,000 - $18,000

---

### **Network Equipment**

#### **Core Switch (2 units for redundancy)**

**Recommended:** Cisco Catalyst 9300, Arista 7050SX, or Dell N3248TE-ON

**Specifications:**
```
Ports: 48× 1 GbE + 4× 10 GbE uplinks
Layer 3 routing: Yes
Throughput: 176 Gbps
Features: VLAN, QoS, LACP, HSRP/VRRP
Stacking: Yes (for redundancy)
Power: Dual redundant PSUs
Warranty: 3-year
```

**Cost per switch:** $5,000 - $8,000  
**Total (2 switches):** $10,000 - $16,000

---

#### **Firewall (2 units for HA)**

**Recommended:** Fortinet FortiGate 200F, Palo Alto PA-850, or pfSense on hardware

**Specifications:**
```
Throughput: 10 Gbps firewall, 2 Gbps VPN
Ports: 14× 1 GbE + 2× 10 GbE
Features:
  - Stateful inspection
  - IPS/IDS
  - VPN
  - SSL inspection
  - Application control
High Availability: Active-Passive
Warranty: 3-year
```

**Cost per firewall:** $5,000 - $10,000  
**Total (2 firewalls):** $10,000 - $20,000

**Budget Alternative:** pfSense on Netgate hardware ($2,000-3,000 each)

---

### **Storage (Optional - for centralized logging)**

**Recommended:** Synology NAS or Dell EMC storage

**Configuration:**
```
Model: Synology RS3621xs+ or Dell EMC Unity XT 380
Capacity: 24 TB usable (4× 8TB drives, RAID 10)
Network: 4× 1 GbE (bonded)
Features: NFS, CIFS, iSCSI
Warranty: 3-year
```

**Cost:** $8,000 - $15,000

---

### **UPS (Uninterruptible Power Supply)**

**Recommended:** APC Smart-UPS SRT 10000VA or Eaton 9PX

**Specifications:**
```
Capacity: 10 kVA / 10 kW
Runtime: 15-30 minutes (at full load)
Batteries: Hot-swappable
Network Card: Remote monitoring
Outlets: 8-10 (C13/C19)
Warranty: 3-year
```

**Cost per UPS:** $5,000 - $8,000  
**Total (2 UPS units recommended):** $10,000 - $16,000

---

### **Rack & Infrastructure**

**Server Rack (42U):**
```
Rack: 42U server rack with cable management
PDU: 2× Metered/Switched PDU (16-20 outlets each)
KVM: IP KVM switch (8-16 ports)
Cables:
  - Cat6a Ethernet cables (50-100)
  - Power cables (50)
  - Fiber optic cables (if using 10 GbE)
Cooling: Rack-mounted cooling if needed
```

**Cost:** $3,000 - $5,000

---

## 📦 Complete Hardware Bill of Materials (BOM)

| Component | Quantity | Unit Cost | Total Cost |
|-----------|----------|-----------|------------|
| **Compute** |
| Asterisk Servers (Dell R750) | 10 | $10,000 | $100,000 |
| Load Balancers (Dell R450) | 2 | $4,000 | $8,000 |
| Kamailio SIP Proxies (Dell R450) | 2 | $4,000 | $8,000 |
| Redis Cluster (Dell R350) | 3 | $4,500 | $13,500 |
| Monitoring Server (Dell R750) | 1 | $15,000 | $15,000 |
| **Network** |
| Core Switches (Cisco C9300) | 2 | $7,000 | $14,000 |
| Firewalls (Fortinet 200F) | 2 | $7,500 | $15,000 |
| **Power & Rack** |
| UPS (APC SRT 10kVA) | 2 | $6,500 | $13,000 |
| Server Rack (42U) | 1 | $2,000 | $2,000 |
| PDUs, KVM, Cables | - | $3,000 | $3,000 |
| **Storage (Optional)** |
| NAS for centralized logs | 1 | $12,000 | $12,000 |
| **Subtotal** | | | **$203,500** |
| **Contingency (10%)** | | | $20,350 |
| **TOTAL HARDWARE** | | | **$223,850** |

**Notes:**
- Prices are estimates, actual quotes may vary
- Mid-range configuration, can reduce costs with Supermicro or HP
- Can save $50,000+ with budget-friendly alternatives

---

## 🏢 Data Center Requirements

### **Physical Space**
```
Rack Space: 1× 42U rack (minimum)
  - Can fit all 18 servers + network gear

Floor Space: 8-10 sq ft (rack + access)
Ceiling Height: 8 ft minimum
Access: 24/7 for critical alerts
```

### **Power Requirements**

**Total Power Draw (estimate):**
```
Asterisk Servers: 10 × 500W = 5,000W
Load Balancers: 2 × 200W = 400W
Kamailio: 2 × 200W = 400W
Redis: 3 × 200W = 600W
Monitoring: 1 × 600W = 600W
Network Gear: 1,000W (switches, firewall)
-------------------------------------------------
Total: ~8,000W (8 kW)

With redundancy & margin: 12 kW circuit recommended
```

**Power Infrastructure:**
```
Primary Power: 2× 20A 208V circuits (or 1× 30A)
UPS: 2× 10kVA UPS (redundant)
PDU: 2× Metered PDU per rack
Generator: Optional (for extended outages)
```

### **Cooling Requirements**

**Heat Dissipation:**
```
8 kW power = ~8 kW heat (roughly 27,000 BTU/hour)

Cooling Capacity Needed:
- 2-3 tons of AC (1 ton = 12,000 BTU/hour)
- Hot aisle / Cold aisle configuration (if full data center)
- Rack-mounted cooling (if in server room)

Temperature Target: 18-27°C (64-80°F)
Humidity: 40-60% RH
```

### **Network Connectivity**

**Internet Connectivity:**
```
Primary Circuit:
  - 1 Gbps fiber (dedicated)
  - Provider: Tier 1 carrier
  - SLA: 99.9% uptime
  - Cost: ~$1,000-2,000/month

Backup Circuit (recommended):
  - 500 Mbps fiber (different provider, different path)
  - Cost: ~$500-1,000/month

Total: $1,500-3,000/month
```

**Public IP Addresses:**
```
Minimum: /29 subnet (6 usable IPs)
  - 1× HAProxy VIP (public)
  - 1× Firewall outside interface
  - 2× Spare

Recommended: /28 subnet (14 usable IPs)
  - Allows for future expansion
```

---

## 📅 Procurement & Deployment Timeline

### **Phase 0: Procurement (Week 1-12)**

#### **Week 1-2: Requirements & Quotes**
- [ ] Finalize hardware specifications
- [ ] Request quotes from vendors
  - [ ] Dell
  - [ ] HPE
  - [ ] Supermicro (budget option)
- [ ] Compare pricing and lead times
- [ ] Request quotes for network equipment
- [ ] Request quotes for UPS
- [ ] Get internet connectivity quotes

#### **Week 3-4: Purchase Orders**
- [ ] Obtain budget approval
- [ ] Issue purchase orders
- [ ] Confirm delivery dates
- [ ] Arrange payment terms
- [ ] Order spare parts (spare drives, RAM, PSU)

#### **Week 5-12: Hardware Delivery**
- [ ] **Lead Time:** 6-10 weeks typical for servers
- [ ] Track shipments
- [ ] Prepare data center space
- [ ] Install rack
- [ ] Install UPS
- [ ] Install PDUs
- [ ] Run power circuits
- [ ] Install network switches
- [ ] Run network cabling

#### **Week 10-12: Receiving & Staging**
- [ ] Receive hardware deliveries
- [ ] Inspect for damage
- [ ] Verify quantities match PO
- [ ] Stage equipment in data center
- [ ] Rack mount all servers
- [ ] Cable management
- [ ] Initial power-on tests

### **Phase 1: Base Installation (Week 13-14)**

#### **Network Setup**
- [ ] Install and configure core switches
  - [ ] Configure VLANs
  - [ ] Configure trunking
  - [ ] Configure LACP (link aggregation)
  - [ ] Configure spanning tree
- [ ] Install and configure firewalls
  - [ ] Configure HA (active-passive)
  - [ ] Configure WAN interfaces
  - [ ] Configure LAN interfaces
  - [ ] Configure basic firewall rules
  - [ ] Test failover

#### **Server Installation**
- [ ] Install OS on all servers (CentOS Stream 9 or Ubuntu 22.04 LTS)
  - [ ] Asterisk #1-10
  - [ ] Load Balancers #1-2
  - [ ] Kamailio #1-2
  - [ ] Redis #1-3
  - [ ] Monitoring server
- [ ] Configure RAID on all servers
- [ ] Configure remote management (iDRAC/iLO)
  - [ ] Assign IP addresses
  - [ ] Configure SNMP
  - [ ] Test remote console access
- [ ] Apply OS hardening
  - [ ] Disable unnecessary services
  - [ ] Configure firewalld/iptables
  - [ ] Install security updates
- [ ] Configure NTP (time synchronization)
- [ ] Configure DNS
- [ ] Create admin users

### **Phase 2-7: Software Deployment**
- [ ] Follow main ENTERPRISE_DEPLOYMENT_CHECKLIST.md
- [ ] Phases 2-7 (Week 15-20)

---

## 🔧 Hardware Vendor Contact Information

### **Recommended Vendors**

#### **Dell Technologies**
```
Website: www.dell.com/enterprise
Sales: 1-800-289-3355
Support: ProSupport Plus recommended
Lead Time: 6-8 weeks (configurable servers)
Financing: Dell Financial Services available
```

#### **HPE (Hewlett Packard Enterprise)**
```
Website: www.hpe.com
Sales: 1-888-237-8289
Support: HPE Pointnext Services
Lead Time: 6-10 weeks
Financing: HPE Financial Services
```

#### **Supermicro (Budget Option)**
```
Website: www.supermicro.com
Sales: 1-408-503-8000
Lead Time: 4-6 weeks (in-stock configs)
Cost Savings: 20-30% vs Dell/HPE
Note: Less comprehensive support
```

### **Network Equipment Vendors**

#### **Cisco**
```
Website: www.cisco.com
Partner: Contact Cisco Gold Partner
Lead Time: 4-8 weeks
Support: SmartNet recommended
```

#### **Fortinet**
```
Website: www.fortinet.com
Sales: Through authorized reseller
Lead Time: 4-6 weeks
Support: FortiCare Premium
```

---

## 🛠️ Spare Parts & Maintenance

### **Recommended Spare Parts (Year 1)**

```
Hardware Spares:
- 4× Hard drives (compatible with servers)
- 2× Power supplies (hot-swap)
- 4× RAM modules (16GB DIMMs)
- 2× Network cables (Cat6a, various lengths)
- 1× Spare server (same spec as Asterisk)

Cost: $5,000-8,000
```

### **Maintenance Contracts**

```
Dell/HPE ProSupport:
  - 24/7 phone support
  - 4-hour or NBD parts replacement
  - Remote diagnostics
  - Cost: ~10-15% of hardware cost/year
  - Total: ~$15,000-25,000/year

Network Equipment Support:
  - Cisco SmartNet or Fortinet FortiCare
  - Cost: ~$3,000-5,000/year
```

---

## 🔐 Physical Security

### **Data Center Access**
- [ ] Card reader / keypad access
- [ ] Security cameras
- [ ] Access log maintained
- [ ] Escort policy for visitors
- [ ] Equipment removal procedure

### **Environmental Monitoring**
- [ ] Temperature sensors
- [ ] Humidity sensors
- [ ] Water leak detection (if applicable)
- [ ] Door sensors
- [ ] Fire suppression system (if available)

---

## 📊 Capacity Upgrade Path

### **Year 1-2: Initial Deployment (5,000 calls)**
```
- 10× Asterisk servers
- Total capacity: 5,000 concurrent calls
- Utilization: 100%
```

### **Year 3: Growth to 7,500 calls (50% increase)**
```
- Add 5× Asterisk servers
- Total: 15× servers
- Capacity: 7,500 concurrent calls
- Additional investment: ~$50,000
```

### **Year 4-5: Growth to 10,000 calls (100% increase)**
```
- Add 5× more Asterisk servers
- Total: 20× servers
- Capacity: 10,000 concurrent calls
- Additional investment: ~$50,000
- May need: Second rack, additional network gear
```

---

## ⚠️ Critical On-Premise Considerations

### **Advantages of On-Premise**
✅ **Lower long-term costs** (after break-even ~3 years)  
✅ **Complete control** over infrastructure  
✅ **Data sovereignty** (no third-party data access)  
✅ **Predictable performance** (dedicated hardware)  
✅ **No cloud egress fees** (important for high bandwidth)  
✅ **Compliance** (easier for regulated industries)  

### **Challenges of On-Premise**
⚠️ **High upfront investment** ($136K-207K)  
⚠️ **Longer deployment time** (12-16 weeks vs 2-3 weeks cloud)  
⚠️ **Hardware refresh needed** (every 5 years)  
⚠️ **Staff expertise required** (hardware, data center)  
⚠️ **Disaster recovery** (requires off-site backup location)  
⚠️ **Scaling requires hardware purchase** (can't scale instantly)  

---

## 📋 On-Premise Pre-Deployment Checklist

**Before ordering hardware, verify:**

- [ ] Budget approved ($136K-207K initial + $118K/year operating)
- [ ] Data center space available (42U rack, 10 sq ft)
- [ ] Power available (12 kW circuit)
- [ ] Cooling adequate (2-3 tons AC)
- [ ] Internet connectivity ordered (1 Gbps + backup)
- [ ] Public IP addresses obtained (/28 subnet)
- [ ] IT staff available (1-2 people for deployment)
- [ ] Maintenance contracts budgeted
- [ ] Vendor lead times acceptable (6-12 weeks)
- [ ] Physical security adequate
- [ ] Environmental monitoring in place
- [ ] Fire suppression available (if data center)
- [ ] Backup power (UPS + generator for critical sites)

---

## 💡 Cost Optimization Tips

### **Hardware Cost Reduction**
1. **Use Supermicro instead of Dell/HPE:** Save 20-30%
2. **Buy refurbished servers:** Save 40-60% (1-year-old hardware)
3. **Lease instead of buy:** Lower upfront cost, includes warranty
4. **Negotiate volume discounts:** 10+ servers = 10-15% discount
5. **Buy direct vs reseller:** Sometimes cheaper

### **Operating Cost Reduction**
1. **Negotiate bandwidth:** Multi-year contracts save 20-30%
2. **Energy-efficient hardware:** Newer CPUs use less power
3. **Optimize cooling:** Hot aisle/cold aisle can save 30% cooling
4. **LED lighting:** If in private data center
5. **Power management:** Shutdown non-production during off-hours

### **Example Budget Configuration** ($100K total)
```
10× Supermicro Asterisk servers: $70,000
2× Load balancers (mid-range): $6,000
2× Kamailio (mid-range): $6,000
3× Redis (mid-range): $10,000
1× Monitoring (mid-range): $10,000
2× Switches (Dell/Arista): $10,000
2× Firewalls (pfSense hardware): $4,000
2× UPS: $10,000
Rack & cabling: $3,000
-------------------------------------------
Total: ~$130,000 (with contingency)
```

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Next Review:** After hardware procurement


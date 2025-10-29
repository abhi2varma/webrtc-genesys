# GWS + WebRTC SIP Endpoint - Integration Diagram

## 🎨 Visual Integration Overview

This document provides detailed visual representations of how Genesys Workspace Web Edition (GWS) integrates with the WebRTC SIP endpoint infrastructure.

---

## 1. Complete System Architecture

```
                                 AGENT WORKSTATION
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (Chrome/Firefox/Edge)                                           │
│                                                                           │
│  ┌───────────────────────────┐    ┌───────────────────────────────┐    │
│  │ Tab 1: GWS Agent Desktop  │    │ Tab 2: WebRTC SIP Client      │    │
│  │ http://localhost:8080     │    │ https://webrtc-server         │    │
│  │                            │    │                                │    │
│  │ ┌─────────────────────┐   │    │ ┌──────────────────────────┐ │    │
│  │ │ Agent Login         │   │    │ │ SIP Registration         │ │    │
│  │ │ Username: agent5001 │   │    │ │ DN: 5001                 │ │    │
│  │ └─────────────────────┘   │    │ │ Password: ********       │ │    │
│  │                            │    │ └──────────────────────────┘ │    │
│  │ ┌─────────────────────┐   │    │                                │    │
│  │ │ Call Controls       │   │    │ ┌──────────────────────────┐ │    │
│  │ │ • Answer            │   │    │ │ Audio Interface          │ │    │
│  │ │ • Hold              │   │    │ │ • Microphone Input       │ │    │
│  │ │ • Transfer          │   │    │ │ • Speaker Output         │ │    │
│  │ │ • Conference        │   │    │ │ • Volume Control         │ │    │
│  │ │ • Release           │   │    │ │ • Mute Button            │ │    │
│  │ └─────────────────────┘   │    │ └──────────────────────────┘ │    │
│  │                            │    │                                │    │
│  │ ┌─────────────────────┐   │    │ ┌──────────────────────────┐ │    │
│  │ │ Screen Pop          │   │    │ │ Call Status              │ │    │
│  │ │ • Customer Name     │   │    │ │ Registration: OK         │ │    │
│  │ │ • Account #         │   │    │ │ Call State: Connected    │ │    │
│  │ │ • Call History      │   │    │ │ Duration: 00:05:23       │ │    │
│  │ │ • Interaction Data  │   │    │ └──────────────────────────┘ │    │
│  │ └─────────────────────┘   │    │                                │    │
│  │                            │    │                                │    │
│  │ ┌─────────────────────┐   │    │                                │    │
│  │ │ Agent State         │   │    │                                │    │
│  │ │ Status: Ready       │   │    │                                │    │
│  │ └─────────────────────┘   │    │                                │    │
│  └───────────┬───────────────┘    └────────────┬───────────────────┘    │
│              │                                   │                         │
│              │ REST API                          │ WSS                     │
│              │ CometD (WebSocket)                │ (SIP over WebSocket)   │
└──────────────┼───────────────────────────────────┼─────────────────────────┘
               │                                   │
               │ HTTPS/WSS                        │ WSS
               │                                   │
        ┌──────▼───────────────────────────────────▼──────┐
        │                                                  │
        │         APPLICATION SERVER LAYER                │
        │                                                  │
        │  ┌──────────────────────────────────────────┐  │
        │  │  GWS Application (localhost:8080)        │  │
        │  │  h:\Abhishek\gws-main                    │  │
        │  │                                           │  │
        │  │  Components:                              │  │
        │  │  • Spring Boot Web Server                 │  │
        │  │  • REST API Endpoints                     │  │
        │  │  • CometD Server (Real-time push)         │  │
        │  │  • Session Management                     │  │
        │  │  • Agent Desktop UI                       │  │
        │  └────────────────┬──────────────────────────┘  │
        │                   │ PSDK                         │
        │                   │ (Platform SDK Protocol)      │
        └───────────────────┼──────────────────────────────┘
                            │
                            │ TCP
        ┌───────────────────▼──────────────────────────────┐
        │                                                   │
        │         WEBRTC/SIP INFRASTRUCTURE                │
        │         f:\Project\WebRTC                         │
        │         (192.168.77.131 or cloud)                │
        │                                                   │
        │  ┌────────────────────────────────────────────┐ │
        │  │  Nginx (Reverse Proxy)                     │ │
        │  │  Port: 443 (HTTPS/WSS)                     │ │
        │  │  • SSL/TLS Termination                      │ │
        │  │  • WebSocket Proxy                         │ │
        │  │  • Static File Serving                     │ │
        │  └────────────┬───────────────────────────────┘ │
        │               │ Proxy                            │
        │               │                                  │
        │  ┌────────────▼───────────────────────────────┐ │
        │  │  Asterisk (SIP/WebRTC Gateway)             │ │
        │  │  Ports: 5060 (SIP), 8089 (WSS)             │ │
        │  │        10000-20000 (RTP/SRTP)              │ │
        │  │                                             │ │
        │  │  • WebRTC ↔ SIP Translation                │ │
        │  │  • Agent DN Endpoints (5001-5999)          │ │
        │  │  • Codec Transcoding (Opus ↔ G.711)        │ │
        │  │  • Media Proxy (SRTP ↔ RTP)                │ │
        │  │  • NAT Traversal (STUN/TURN)               │ │
        │  └────────────┬───────────────────────────────┘ │
        │               │ SIP Trunk                        │
        └───────────────┼──────────────────────────────────┘
                        │
                        │ SIP (UDP/TCP)
        ┌───────────────▼──────────────────────────────────┐
        │                                                   │
        │         GENESYS ENGAGE PLATFORM                   │
        │         (Your Corporate Network)                  │
        │                                                   │
        │  ┌────────────────────────────────────────────┐ │
        │  │  Configuration Server                      │ │
        │  │  Port: 5000                                │ │
        │  │  • Agent Configuration                      │ │
        │  │  • DN Management                           │ │
        │  │  • Skills & Routing                        │ │
        │  │  • Switch Objects                          │ │
        │  └─────────────┬──────────────────────────────┘ │
        │                │                                 │
        │                │ Internal Genesys Protocol       │
        │                │                                 │
        │  ┌─────────────▼──────────────────────────────┐ │
        │  │  T-Server (Telephony Control)              │ │
        │  │  Port: 5025                                │ │
        │  │  • Call Control Commands                    │ │
        │  │  • Agent State Management                   │ │
        │  │  • CTI Events                              │ │
        │  │  • Call Routing                            │ │
        │  └─────────────┬──────────────────────────────┘ │
        │                │                                 │
        │                │ SIP Control                     │
        │                │                                 │
        │  ┌─────────────▼──────────────────────────────┐ │
        │  │  SIP Server                                │ │
        │  │  Port: 5060/5061                           │ │
        │  │  • DN Registration                          │ │
        │  │  • SIP Trunk Management                     │ │
        │  │  • Call Signaling                          │ │
        │  │  • Media Control                           │ │
        │  └─────────────┬──────────────────────────────┘ │
        │                │                                 │
        └────────────────┼─────────────────────────────────┘
                         │
                         │ SIP/RTP
        ┌────────────────▼─────────────────────────────────┐
        │  PSTN Gateway / Carrier                          │
        │  • External Call Connectivity                    │
        └──────────────────────────────────────────────────┘
```

---

## 2. Data Flow - Inbound Call

```
Step 1: Call Arrives
═══════════════════════════════════════════════════════
PSTN Customer (555-1234567)
    │
    │ Dials: 1-800-COMPANY
    │
    ▼
[PSTN Gateway]
    │
    │ SIP INVITE
    │ To: +18005551234
    │
    ▼
[Genesys SIP Server]
    │
    │ Route lookup
    │ DNIS: +18005551234 → Route Point: 5000
    │
    ▼
[T-Server]
    │
    │ EventRouteRequest
    │ Apply routing strategy
    │
    ▼
[URS - Universal Routing Server]
    │
    │ Skills-based routing
    │ Queue position: 1
    │ Agent selection: agent5001 (DN: 5001)
    │ Reason: Longest available, has required skills
    │
    ▼

Step 2: Agent Notification (DUAL PATH)
═══════════════════════════════════════════════════════

PATH A: GWS (Screen Pop)          │  PATH B: SIP (Audio)
                                   │
[T-Server]                         │  [Genesys SIP Server]
    │                              │      │
    │ EventRinging                 │      │ SIP INVITE
    │ ConnID: 00015ABC1234         │      │ To: sip:5001@asterisk
    │ ANI: 5551234567              │      │ From: 5551234567
    │ UserData: {                  │      │ P-Asserted-Identity: ...
    │   customer_id: 98765         │      │
    │   account_type: premium      │      ▼
    │   call_reason: support       │  [Asterisk]
    │ }                            │      │
    │                              │      │ Lookup DN: 5001
    ▼                              │      │ WebSocket endpoint found
[GWS Application]                  │      │
    │                              │      │ SIP INVITE
    │ Process EventRinging         │      │ Via: WSS
    │ Load customer data           │      │
    │ Create call object           │      ▼
    │                              │  [WebRTC Client (Browser)]
    │ CometD Push                  │      │
    │ Channel: /v2/me/calls        │      │ Incoming call detected!
    │ Payload: {                   │      │ Play ring tone
    │   callId: 00015ABC1234       │      │ Display notification
    │   state: "Ringing"           │      │
    │   ani: "5551234567"          │      │ Waiting for answer...
    │   userData: {...}            │      │
    │ }                            │      │
    │                              │      │
    ▼                              │      ▼
[Agent Browser - GWS UI]           │  [Agent Browser - WebRTC UI]
    │                              │      │
    │ Screen pop appears!          │      │ 🔔 Ring ring!
    │ ┌─────────────────────┐     │      │ ┌──────────────────┐
    │ │ Incoming Call       │     │      │ │ Incoming Call    │
    │ │ From: 555-123-4567  │     │      │ │ From: 5551234567 │
    │ │                     │     │      │ │ Duration: 00:00  │
    │ │ Customer: John Doe  │     │      │ └──────────────────┘
    │ │ Account: Premium    │     │      │
    │ │ Reason: Support     │     │      │
    │ │                     │     │      │
    │ │ [Answer] [Reject]   │     │      │
    │ └─────────────────────┘     │      │
    │                              │      │
    │                              │      │

Step 3: Agent Answers (Control via GWS)
═══════════════════════════════════════════════════════

[Agent clicks "Answer" in GWS UI]
    │
    │ REST API Call
    │ PUT /api/v2/me/calls/00015ABC1234
    │ { action: "answer" }
    │
    ▼
[GWS Application]
    │
    │ Validate request
    │ Get call object
    │
    │ PSDK Command
    │ RequestAnswerCall
    │ ConnID: 00015ABC1234
    │
    ▼
[T-Server]
    │
    │ Process answer request
    │ Update call state
    │
    │ SIP Control
    │
    ▼
[Genesys SIP Server]
    │
    │ Send SIP 200 OK
    │ (propagates to Asterisk → WebRTC)
    │
    ▼
[Asterisk]
    │
    │ SIP 200 OK
    │ Via: WSS
    │
    ▼
[WebRTC Client]
    │
    │ Call answered!
    │ Establish media streams
    │ Start RTP/SRTP
    │
    ▼

Step 4: Media Path Established
═══════════════════════════════════════════════════════

[PSTN Customer]
    ↕ RTP (G.711)
[Genesys SIP Server]
    ↕ RTP (G.711)
[Asterisk]
    │ Transcoding: G.711 ↔ Opus
    ↕ SRTP (Opus/WebRTC)
[Agent Browser (WebRTC Client)]

Audio flows in both directions simultaneously!

Step 5: Call State Updates
═══════════════════════════════════════════════════════

[T-Server]
    │
    │ EventEstablished
    │ ConnID: 00015ABC1234
    │ State: Connected
    │ StartTime: 2025-01-15T10:23:45Z
    │
    ▼
[GWS Application]
    │
    │ CometD Push
    │ Channel: /v2/me/calls
    │ Payload: {
    │   callId: 00015ABC1234
    │   state: "Established"
    │   duration: 0
    │ }
    │
    ▼
[GWS UI]
    │
    │ Update call state
    │ ┌─────────────────────────┐
    │ │ Active Call             │
    │ │ With: 555-123-4567      │
    │ │ Duration: 00:01:23      │
    │ │                         │
    │ │ [Hold] [Transfer] [End] │
    │ └─────────────────────────┘
    │
    │ Start call timer
    │ Enable call controls
```

---

## 3. Data Flow - Outbound Call (Click-to-Dial)

```
Step 1: Agent Initiates Call
═══════════════════════════════════════════════════════

[Agent in GWS UI]
    │
    │ Enters phone number: 555-987-6543
    │ Clicks "Dial" button
    │
    │ REST API Call
    │ POST /api/v2/me/calls
    │ {
    │   destination: "5559876543",
    │   userData: {
    │     customer_id: 12345,
    │     campaign: "sales"
    │   }
    │ }
    │
    ▼
[GWS Application]
    │
    │ Validate request
    │ Check agent state (must be Ready)
    │
    │ PSDK Command
    │ RequestMakeCall
    │ ThisDN: 5001
    │ OtherDN: 5559876543
    │ UserData: {...}
    │
    ▼
[T-Server]
    │
    │ Process make call request
    │ Create call object
    │ Generate ConnID: 00015ABC5678
    │
    │ Two-party call setup:
    │ 1. Call agent leg first
    │ 2. Then call customer
    │
    ▼

Step 2: Agent Leg Rings
═══════════════════════════════════════════════════════

[T-Server]
    │
    │ SIP INVITE to agent DN
    │
    ▼
[Genesys SIP Server]
    │
    │ SIP INVITE
    │ To: sip:5001@asterisk
    │
    ▼
[Asterisk]
    │
    │ Forward to WebRTC client
    │
    ▼
[WebRTC Client]
    │
    │ Auto-answer (configured for outbound)
    │ SIP 200 OK
    │
    │ Agent now connected to call
    │ Hears: ringing tone or music
    │
    ▼

Step 3: Customer Leg Dialed
═══════════════════════════════════════════════════════

[T-Server]
    │
    │ Dial external number
    │ Route via Genesys routing
    │
    ▼
[Genesys SIP Server]
    │
    │ SIP INVITE
    │ To: 5559876543
    │ Via: PSTN Gateway
    │
    ▼
[PSTN Gateway]
    │
    │ Place call to PSTN
    │
    ▼
[Customer Phone]
    │
    │ Ring ring! 📞
    │
    │

Step 4: Customer Answers
═══════════════════════════════════════════════════════

[Customer Phone]
    │
    │ Customer answers
    │
    ▼
[PSTN Gateway]
    │
    │ SIP 200 OK
    │
    ▼
[Genesys SIP Server]
    │
    │ 200 OK to T-Server
    │
    ▼
[T-Server]
    │
    │ Bridge both legs
    │ Agent ↔ Customer
    │
    │ EventEstablished
    │
    ▼
[GWS Application]
    │
    │ CometD Push
    │ Update call state: Established
    │
    ▼
[GWS UI]
    │
    │ Show: Connected to 555-987-6543
    │ Start call timer
    │ Enable controls
```

---

## 4. Protocol Stack Diagram

```
AGENT BROWSER          GWS SERVER          GENESYS          ASTERISK          PSTN
─────────────          ──────────          ───────          ────────          ────

┌──────────┐
│  HTTPS   │─────────────────────────────────┐
└──────────┘                                  │
                                              │
┌──────────┐           ┌──────────┐          │
│ CometD   │◄─────────►│ Bayeux   │          │
│ Client   │  WSS      │ Server   │          │
└──────────┘           └──────────┘          │
                                              │
┌──────────┐                                  │
│JavaScript│           ┌──────────┐          │
│SIP Client│           │REST API  │          │
│ (JsSIP)  │◄──────────│          │          │
└────┬─────┘           └─────┬────┘          │
     │                       │               │
     │WSS                    │PSDK           │
     │SIP                    │TCP            │
     │                       │               │
     │                  ┌────▼─────┐        │
     │                  │T-Server  │        │
     │                  │Protocol  │        │
     │                  └────┬─────┘        │
     │                       │              │
     │                       │SIP Control   │
     │                  ┌────▼─────┐       │
     │                  │Genesys   │       │
     │                  │SIP Server│       │
     │                  └────┬─────┘       │
     │                       │             │
     │ ┌─────────────────────┘             │
     │ │                                   │
     ▼ ▼                                   │
  ┌────────┐           ┌─────────┐        │
  │Asterisk│           │Asterisk │        │
  │WSS     │◄─────────►│PJSIP    │        │
  │Transport          │SIP Stack │        │
  └────────┘           └────┬────┘        │
                            │             │
                            │SIP          │
                            │             │
                       ┌────▼────┐        │
                       │Genesys  │        │
                       │SIP      │        │
                       │Server   │        │
                       └────┬────┘        │
                            │             │
                            │SIP          │
                            │             │
                       ┌────▼────┐        │
                       │PSTN     │        │
                       │Gateway  │        │
                       └─────────┘        │
                                          │
MEDIA PATH:                               │
───────────                               │
                                          │
Browser (SRTP) ◄─► Asterisk (RTP) ◄─► Genesys ◄─► PSTN
  Opus codec       Transcoding         G.711      G.711
  WebRTC           G.711 ↔ Opus
```

---

## 5. State Synchronization

```
Agent State Changes Flow
════════════════════════════════════════════════════════

USER ACTION        GWS                T-SERVER           EFFECT
───────────        ───                ────────           ──────

Click "Ready"  →   REST API       →   SetAgentState  →  DN 5001 available
                   /api/v2/me/state   (Ready)            for routing

Click "Not      →  REST API       →   SetAgentState  →  DN 5001 NOT
Ready"             /api/v2/me/state   (NotReady)         available

After Call      →  [Automatic]    →   SetAgentState  →  Agent in ACW
Work                                   (AfterCallWork)    (wrap-up)

Complete ACW    →  REST API       →   SetAgentState  →  Back to Ready
                   /api/v2/me/state   (Ready)            or NotReady


Call State Synchronization
════════════════════════════════════════════════════════

T-SERVER EVENT         GWS ACTION              UI UPDATE
──────────────         ──────────              ─────────

EventRinging       →   CometD Push         →   Show incoming call
                       /v2/me/calls             Screen pop appears

EventEstablished   →   CometD Push         →   Update to "Connected"
                       /v2/me/calls             Start call timer

EventHeld          →   CometD Push         →   Show "On Hold" status
                       /v2/me/calls             Disable some controls

EventRetrieved     →   CometD Push         →   Show "Active" again
                       /v2/me/calls             Enable controls

EventReleased      →   CometD Push         →   Clear call
                       /v2/me/calls             Show ACW panel


SIP Registration Synchronization
════════════════════════════════════════════════════════

COMPONENT              STATE                   SYNCHRONIZED BY
─────────              ─────                   ───────────────

WebRTC Client      →   Registered DN: 5001     SIP REGISTER
Asterisk           →   Endpoint 5001 active    PJSIP
Genesys SIP Server →   DN 5001 registered      SIP Registration
T-Server           →   DN 5001 in-service      Monitoring
GWS                →   Agent logged in DN:5001 Config Server lookup
```

---

## 6. Ports and Protocols Reference

```
┌────────────────────────────────────────────────────────────────────┐
│ AGENT WORKSTATION                                                  │
│                                                                     │
│  Browser                                                            │
│  ├─ HTTPS/443      → GWS Web Server                               │
│  ├─ WSS/443        → CometD Real-time                             │
│  ├─ WSS/443 (/ws)  → Asterisk SIP                                 │
│  └─ SRTP/Random    → Asterisk Media (via TURN if NAT)             │
└────────────────────────────────────────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────────┐
│ GWS SERVER (localhost or server)                                   │
│                                                                     │
│  Port 8080    - GWS Web Application (HTTP)                         │
│  Port 8080    - CometD WebSocket (WSS if HTTPS)                    │
│  Port varies  → Configuration Server :5000                         │
│  Port varies  → T-Server :5025                                     │
└────────────────────────────────────────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────────┐
│ WEBRTC/ASTERISK SERVER (192.168.77.131)                            │
│                                                                     │
│  Port 443         - Nginx HTTPS/WSS (external)                     │
│  Port 8089        - Asterisk WSS (internal)                        │
│  Port 5060        - Asterisk SIP (to Genesys)                      │
│  Port 10000-20000 - RTP/SRTP (media)                               │
│  Port 3478        - TURN/STUN                                      │
└────────────────────────────────────────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────────┐
│ GENESYS ENGAGE PLATFORM (Corporate Network)                        │
│                                                                     │
│  Port 5000        - Configuration Server                           │
│  Port 5025        - T-Server                                       │
│  Port 5060        - Genesys SIP Server                             │
│  Port 2020        - Stat Server (optional)                         │
│  Port 8080        - URS (optional)                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. Message Flow - Transfer Call

```
BLIND TRANSFER (from GWS UI)
════════════════════════════════════════════════════════

Agent in call with Customer
Agent wants to transfer to DN: 5002

[Agent clicks "Transfer" in GWS]
    │
    │ Enters: 5002
    │ Clicks: "Transfer"
    │
    │ REST API
    │ POST /api/v2/me/calls/00015ABC1234/transfer
    │ {
    │   destination: "5002",
    │   type: "blind"
    │ }
    │
    ▼
[GWS Application]
    │
    │ PSDK Command
    │ RequestSingleStepTransfer
    │ ConnID: 00015ABC1234
    │ Destination: 5002
    │
    ▼
[T-Server]
    │
    │ Process transfer
    │ Update call routing
    │
    │ SIP Control
    │ REFER sip:5002
    │
    ▼
[Genesys SIP Server]
    │
    │ Execute SIP transfer
    │ INVITE to 5002
    │
    ▼
[Target Agent DN: 5002]
    │
    │ Ring at target agent
    │
    │ Original agent released
    │ Call transferred!
```

---

## 8. Monitoring Dashboard View

```
REAL-TIME SYSTEM STATUS
═══════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│ GWS Application Health                              │
├─────────────────────────────────────────────────────┤
│ Status: ● RUNNING                                   │
│ Uptime: 2h 34m 12s                                  │
│ Port: 8080                                          │
│                                                      │
│ Connections:                                        │
│ ├─ Config Server:  ✓ CONNECTED (192.168.1.100)    │
│ ├─ T-Server:       ✓ CONNECTED (192.168.1.101)    │
│ └─ Database:       ✓ CONNECTED                     │
│                                                      │
│ Active Sessions: 5                                  │
│ CometD Clients: 5                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Asterisk/WebRTC Status                              │
├─────────────────────────────────────────────────────┤
│ Status: ● RUNNING                                   │
│                                                      │
│ Registered Endpoints: 5                             │
│ ├─ 5001 (agent5001) - ✓ REGISTERED                │
│ ├─ 5002 (agent5002) - ✓ REGISTERED                │
│ ├─ 5003 (agent5003) - ✓ REGISTERED                │
│ ├─ 5004 (agent5004) - ✓ REGISTERED                │
│ └─ 5005 (agent5005) - ✓ REGISTERED                │
│                                                      │
│ Active Calls: 2                                     │
│ Trunk Status: ✓ UP (to Genesys)                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Agent States (via T-Server)                         │
├─────────────────────────────────────────────────────┤
│ Ready:          3 agents                            │
│ Not Ready:      1 agent                             │
│ On Call:        2 agents                            │
│ After Call Work: 1 agent                            │
│ Logged Out:     18 agents                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Call Statistics (Last Hour)                         │
├─────────────────────────────────────────────────────┤
│ Inbound Calls:     127                              │
│ Outbound Calls:     45                              │
│ Avg Handle Time:   5m 23s                           │
│ Abandoned:          8 (6.3%)                        │
└─────────────────────────────────────────────────────┘
```

---

This integration diagram provides a complete visual reference for understanding how all components work together in your contact center infrastructure!




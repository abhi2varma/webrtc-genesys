# GWS Folder Structure Analysis

## Overview

Genesys Workspace Web Edition (WWE/GWS) **Version 8.5.2** - Spring Boot application with embedded Jetty server.

---

## 📁 Top-Level Directory Structure

```
D:\WWE-Local\gws\
├── gws.jar                    # Main executable JAR (Spring Boot)
├── gws_2.jar                  # Alternative/backup JAR
├── MANIFEST.MF                # JAR manifest
│
├── config\                    # Configuration files (YAML, JSON)
├── BOOT-INF\                  # Spring Boot application classes and resources
├── META-INF\                  # Maven metadata
├── org\                       # Spring Boot launcher classes
├── lib\                       # Java library dependencies (JARs)
│
├── data\                      # Cassandra schema files
├── elasticsearch\             # Elasticsearch index templates
├── routing-templates\         # Call routing SCXML templates
├── config-templates\          # Sample configuration files
├── tools\                     # Admin scripts (GDPR, ES rebuild)
│
├── etc\                       # Service configuration
├── logs\                      # Application logs
├── tmp\                       # Temporary files
└── temp_jar\                  # Extracted JAR contents (duplicate)
```

---

## 🔧 Configuration Files (`config/`)

### 1. `application.yaml` - Main Configuration

**Key Settings:**

```yaml
# Genesys Configuration Server Connection
onPremiseSettings:
  cmeHost: 10.78.3.90
  cmePort: 2020
  countryCode: INDIA

# HTTP Server (Jetty)
jetty:
  host: 192.168.18.109
  port: 8090
  sessionMaxInactiveInterval: 1800
  cookies:
    httpOnly: true
    secure: false
    sameSite: Lax

# Cassandra Database
cassandraCluster:
  keyspace: sipfs
  nodes: 192.168.18.109
  replication_factor: 1

# Server URLs
serverSettings:
  externalApiUrlV2: http://192.168.18.104:8090/api/v2
  internalApiUrlV2: http://192.168.18.109:8090/internal-api

# CometD (Real-time Messaging)
cometD:
  enabled: true
  path: /genesys/cometd
  transports:
    - websocket        # Listed but not supported
    - long-polling     # Actually used
  
cometDSettings:
  cookieHttpOnly: true
  cookieSecure: false
  cookieSameSite: Lax

# CORS (Cross-Origin Resource Sharing)
crossOriginSettings:
  allowedOrigins: http://*
  allowedMethods: GET,POST,PUT,DELETE,OPTIONS
  allowedHeaders: "X-Requested-With,Content-Type,Accept,Origin,Cookie,authorization,ssid,surl,ContactCenterId,X-CSRF-TOKEN"
  allowCredentials: true

# Security
serverSettings:
  enableCsrfProtection: "false"
  
# CME Credentials
serverSettings:
  applicationName: WWE_Node_LTFS
  applicationType: CFGGenericClient
  cmeUserName: wwe
  cmePassword: wwe
  
# OPS Account
serverSettings:
  opsUserName: ops
  opsUserPassword: ops

# Elasticsearch
serverSettings:
  enableElasticSearchIndexing: "true"
  crClusterName: "test_cluster"
  
elasticSearchSettings:
  clientNode: "false"
  indexPerContactCenter: "true"
  useTransportClient: "true"
  transportClient:
    nodes:
      - {host: 192.168.18.109, port: 9300}
```

### 2. `feature-definitions.json` - Feature Flags

Defines available API features:
- `api-voice` - Voice API
- `api-devices-webrtc` - **WebRTC Support**
- `api-multimedia-chat` - Chat API
- `api-multimedia-email` - Email API
- `api-supervisor-monitoring` - Supervisor monitoring
- `api-voice-instant-messaging` - Agent-to-Agent chat

### 3. `elasticsearch.yml` - Elasticsearch Configuration

### 4. `logback.xml` - Logging Configuration

### 5. `statistics.yaml` - Reporting/Statistics Settings

### 6. `hystrix.properties` - Circuit Breaker Settings

---

## 📦 Application Code (`BOOT-INF/classes/`)

### Java Packages Structure

```
com/genesyslab/cloud/
├── CometDSettings.class                    # CometD configuration
├── ServerSettings.class                    # Server configuration
├── OAuth2Settings.class                    # OAuth authentication
├── SamlSettings.class                      # SAML authentication
├── CrossOriginSettings.class               # CORS configuration
├── ElasticSearchSettings.class             # Elasticsearch config
├── cassandra/                              # Cassandra data layer
├── v2/                                     # REST API v2 (2551 classes!)
├── web/                                    # Web controllers
│   └── broker/                             # Message broker
├── tel/                                    # Telephony services
│   ├── CallManagementService.class
│   ├── TelephonyService.class
│   ├── PartyManagementService.class
│   └── model/
├── rtreporting/                            # Real-time reporting (82 classes)
├── internal/                               # Internal APIs (174 classes)
├── user/                                   # User management
├── application/                            # Application startup
└── validation/                             # Input validation
```

### Key Classes

1. **CometD Integration**
   - `CometDSettings.class` - Configuration
   - `CometDExceptionFilter.class` - Error handling
   - `StaleCometDSessionsMonitorSettings.class` - Session monitoring

2. **Telephony (CTI)**
   - `CallManagementService.class` - Call control
   - `TelephonyService.class` - T-Server integration
   - `DeviceMessage.class` - DN events
   - `CallState.class` - Call states (Ringing, Established, etc.)

3. **Web Services**
   - `web/broker/` - Message routing
   - `v2/` - REST API v2 endpoints

---

## 🌐 Static UI Resources (`BOOT-INF/classes/static/ui/`)

### Agent Desktop (`ad/v1/`)

**Main Files:**
- `index.html` - Main entry point
- `main.js` - Application bootstrap
- `api.js` - API client
- `wwe-service-client-api.js` - Service integration API

**Configuration:**
- `config.json` - Agent Desktop config
- `config-default.json` - Default settings

**Libraries (`lib/`):**
```
lib/
├── org/
│   ├── cometd.js                    # CometD 3.1.12 client
│   └── cometd-3.1.12.js
├── jquery/
│   └── jquery.cometd.js             # jQuery CometD binding
├── backbone/                        # Backbone.js MVC framework
├── underscore/                      # Underscore.js utilities
├── requirejs/                       # RequireJS module loader
├── bootstrap/                       # Bootstrap UI framework
├── moment/                          # Date/time library
└── jquery/                          # jQuery
```

**Modules (`module/`):**
- `wwe-voice/` - Voice interaction handling
- `wwe-webrtc/` - **WebRTC SIP endpoint module**
- `wwe-chat/` - Chat interactions
- `wwe-email/` - Email interactions
- `wwe-workitem/` - Workitem handling
- `wwe-im/` - Instant messaging (agent-to-agent)
- `wwe-main/` - Main workspace UI
- `wwe-login/` - Login module
- `wwe-team-lead/` - Supervisor features
- `wwe-outbound/` - Outbound campaigns

**Assets:**
- `img/` - Images, icons, sprites
- `sound/` - DTMF tones, ring tones, alerts
- `style/` - CSS stylesheets
- `less/` - LESS source files

### Dashboard (`dashboard/`)

Supervisor/admin dashboard UI with:
- Real-time statistics
- Agent monitoring
- Queue status
- Reports

### CRM Integrations
- `crm-adapter/` - Generic CRM adapter
- `crm-workspace/` - CRM workspace UI

---

## 🗄️ Data Layer (`data/`)

### Cassandra Schema Files

```
data/
├── ks-schema-local.cql              # Local/dev keyspace schema
├── ks-schema-prod.cql               # Production keyspace schema
├── ks-schema-prod_HA.cql            # High-availability schema
├── cf-schema.cql                    # Column family definitions
└── updates/
    ├── cf-schema-8.5.201.84.cql     # Schema updates per version
    ├── cf-schema-8.5.202.34.cql
    └── cf-schema-8.5.202.81.cql
```

**Keyspace:** `sipfs` (Session Information Platform File System)

---

## 🔍 Elasticsearch (`elasticsearch/`)

### Index Templates

```
elasticsearch/templates/
├── call_recording_template.json
├── call_recordingv2_template.json
├── screen_recording_template.json
├── common_resourcev2_template.json
├── resourcev2_template.json
├── histstats_template.json
└── billing_recording_usagev1_template.json
```

Used for:
- Call recording metadata
- Screen recording metadata
- Historical statistics
- Resource indexing (contacts, interactions)

---

## 🛤️ Routing Templates (`routing-templates/`)

SCXML (State Chart XML) routing strategies:
```
09_VCC4SF_RouteToSpecDestination_1_0_1.scxml
10_VCC4SF_PlayGreetingRouteToSpecDestination_1_0_1.scxml
11_VCC4SF_SegmentCallerRouteToSpecDestination_1_0_1.scxml
```

Used for Salesforce CRM routing integration.

---

## 🔧 Service Configuration (`etc/`)

### `gws.conf`

```ini
[Service]
WorkingDirectory=E:\WWE-Local\gws
GWS_HOST=192.168.18.104
GWS_PORT=8090
GWS_HOME=E:\WWE-Local\gws
GWS_LOGS=E:\WWE-Local\gws\logs
GWS_TEMP=E:\WWE-Local\gws\gwstmp
GWS_CONF=E:\WWE-Local\gws\config
```

### `service`

Windows/Linux service script for auto-start.

---

## 🛠️ Tools (`tools/`)

### `gdpr_forget_me.py`

Python script to anonymize/delete user data for GDPR compliance.

### `rebuild-es-index.sh`

Shell script to rebuild Elasticsearch indices.

---

## 📊 Maven Project Info (`META-INF/maven/`)

### `pom.xml`

**Project Details:**
- **GroupId:** `com.genesyslab.cloud`
- **ArtifactId:** `gws`
- **Version:** `8.5.2`
- **Main Class:** `com.genesyslab.cloud.application.CloudWebApplication`

**Key Dependencies:**
- **CometD:** 3.1.12
- **Spring Boot:** (with Jetty)
- **Jackson:** 2.10.0 (JSON)
- **Cassandra:** 1.2.19
- **Elasticsearch:** 1.0.1
- **Jetty:** 9.4.25
- **Genesys Platform SDK:** 900.7.0
- **Hystrix:** 1.3.16 (Circuit Breaker)
- **OAuth2:** 2.0.8
- **SAML2:** 1.0.9

---

## 🔐 Security Features

### Authentication Methods
1. **Basic Auth** - Username/password
2. **SAML 2.0** - Enterprise SSO
3. **OAuth 2.0** - Token-based auth

### Security Settings
- CSRF Protection (configurable)
- CORS with credential support
- Secure cookies (configurable)
- Session timeout (30 min default)

---

## 🚀 How GWS Works

### Startup Sequence

```
1. Spring Boot Launcher (org/springframework/boot/loader/)
   ↓
2. CloudWebApplication.main()
   ↓
3. Load config/application.yaml
   ↓
4. Connect to CME (Configuration Server)
   ↓
5. Connect to Cassandra database
   ↓
6. Connect to Elasticsearch
   ↓
7. Initialize CometD server
   ↓
8. Start Jetty HTTP server (port 8090)
   ↓
9. Serve Agent Desktop UI (/ui/ad/v1/index.html)
   ↓
10. Ready for agent login
```

### Request Flow

```
Agent Browser
   ↓ HTTP
Jetty Server (port 8090)
   ↓
Spring MVC Controllers (web/)
   ↓
Service Layer (application/, tel/, etc.)
   ↓
├── T-Server (CTI) ←→ PSDK Protocol
├── Interaction Server (Multimedia) ←→ PSDK Protocol
├── Configuration Server (CME) ←→ PSDK Protocol
└── Cassandra (Data persistence)
```

### CometD Message Flow

```
T-Server Event (e.g., Call Ringing)
   ↓
TelephonyService receives event
   ↓
Convert to internal CallMessage
   ↓
Publish to CometD channel (/v2/me/calls)
   ↓
Long-polling connection returns to browser
   ↓
Agent Desktop JavaScript processes event
   ↓
UI updates (show incoming call notification)
```

---

## 🎯 WebRTC Integration Points

### 1. Built-in WebRTC Module

GWS has a **WebRTC module** at:
```
BOOT-INF/classes/static/ui/ad/v1/module/wwe-webrtc/
```

This module provides:
- SIP endpoint integration
- WebRTC call controls
- Audio/video handling

### 2. CometD Integration

Your external WebRTC client can connect to:
```
URL: http://192.168.210.54:8090/genesys/cometd
Channels:
  - /v2/me/calls      (Voice events)
  - /v2/me/state      (Agent state)
  - /v2/me/interactions (Multimedia)
```

### 3. REST API v2

Available endpoints (from `v2/` package):
```
/api/v2/me/calls           - Call control
/api/v2/me/state           - Agent state
/api/v2/me/dn              - DN configuration
/api/v2/me/interactions    - Multimedia interactions
/api/v2/me/voice           - Voice-specific APIs
```

### 4. Widget API

Embed custom WebRTC client using:
```javascript
window.genesys.wwe.service.registerWidget({
  id: 'webrtc-client',
  title: 'WebRTC Phone',
  url: 'http://192.168.210.54/index.html'
});
```

---

## 📋 Configuration Checklist for WebRTC Integration

### ✅ Already Configured
- [x] CometD enabled
- [x] CORS allows all HTTP origins
- [x] Cookies allow credentials
- [x] CSRF protection disabled (for testing)
- [x] WebRTC feature flag enabled (`api-devices-webrtc`)

### ⚙️ May Need Configuration
- [ ] Update `allowedOrigins` to specific domains (production)
- [ ] Enable CSRF protection (production)
- [ ] Configure SSL/TLS (`cookieSecure: true`)
- [ ] Add WebRTC SIP endpoint DN configuration in CME
- [ ] Configure T-Server for WebRTC DN registration

---

## 📚 Key Files for Integration

### Configuration
- `config/application.yaml` - All settings
- `config/feature-definitions.json` - Feature flags

### CometD Client Libraries
- `BOOT-INF/classes/static/ui/ad/v1/lib/org/cometd.js`
- `BOOT-INF/classes/static/ui/ad/v1/lib/jquery/jquery.cometd.js`

### Agent Desktop UI
- `BOOT-INF/classes/static/ui/ad/v1/index.html`
- `BOOT-INF/classes/static/ui/ad/v1/main.js`
- `BOOT-INF/classes/static/ui/ad/v1/wwe-service-client-api.js`

### WebRTC Module
- `BOOT-INF/classes/static/ui/ad/v1/module/wwe-webrtc/`

---

## 🎯 Summary

**GWS is a comprehensive Spring Boot application that:**

1. **Connects to Genesys Infrastructure:**
   - Configuration Server (CME)
   - T-Server (Voice CTI)
   - Interaction Server (Multimedia)
   
2. **Provides Real-Time Messaging:**
   - CometD with HTTP long-polling
   - Pub/sub channels for CTI events
   
3. **Serves Agent Desktop UI:**
   - Rich JavaScript SPA (Single Page Application)
   - Backbone.js MVC framework
   - RequireJS module loading
   
4. **Exposes REST APIs:**
   - `/api/v2/` for all CTI operations
   - Voice, chat, email, workitem, reporting
   
5. **Supports Multiple Authentication:**
   - Basic, OAuth2, SAML2
   
6. **Persists Data:**
   - Cassandra for interactions/transactions
   - Elasticsearch for search/reporting

**For WebRTC integration, you can:**
- Use the built-in `wwe-webrtc` module
- Connect standalone client via CometD
- Embed custom client as GWS widget
- Call REST APIs for CTI operations

**CometD Endpoint:**
```
http://192.168.210.54:8090/genesys/cometd
```

**Agent Desktop:**
```
http://192.168.210.54:8090/ui/ad/v1/index.html
```


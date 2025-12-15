# Using Docker Images with Kubernetes
## How Kubernetes Orchestrates Your Docker Containers

---

## 🎯 The Relationship: Docker + Kubernetes

**Docker** = Builds and packages your application into containers  
**Kubernetes** = Orchestrates, deploys, scales, and manages those containers

```
┌────────────────────────────────────────────────┐
│  Your Development Machine (Windows)            │
│                                                │
│  1. Build Docker Images:                      │
│     docker build -t myapp:v1.0 .              │
│                                                │
│  2. Push to Registry:                         │
│     docker push myregistry.com/myapp:v1.0     │
│                                                │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│  Container Registry (Docker Hub / ECR / GCR)   │
│  - Stores your Docker images                  │
│  - Kubernetes pulls images from here          │
└────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────┐
│  Kubernetes Cluster                            │
│                                                │
│  1. Pulls Docker images                       │
│  2. Creates Pods (runs containers)            │
│  3. Manages lifecycle (restart, scale)        │
│  4. Load balances traffic                     │
│  5. Auto-scales based on load                 │
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Pod 1   │  │  Pod 2   │  │  Pod 3   │    │
│  │ (Docker) │  │ (Docker) │  │ (Docker) │    │
│  └──────────┘  └──────────┘  └──────────┘    │
│                                                │
└────────────────────────────────────────────────┘
```

**Key Point:** Kubernetes doesn't replace Docker - it uses Docker images and manages them at scale!

---

## 📦 Your Docker Images for WebRTC Gateway

You already have these Docker images from your POC:

### **1. Asterisk** (Public Image)
```yaml
image: andrius/asterisk:latest
```
- **Source:** Docker Hub (public)
- **Used for:** SIP gateway, WebRTC handling
- **No build needed** - Kubernetes pulls directly

### **2. Redis** (Public Image)
```yaml
image: redis:7-alpine
```
- **Source:** Docker Hub (public)
- **Used for:** State storage, DN mapping
- **No build needed**

### **3. Kamailio** (Public Image)
```yaml
image: kamailio/kamailio:5.7-alpine
```
- **Source:** Docker Hub (public)
- **Used for:** SIP proxy, load balancing
- **No build needed**

### **4. Coturn** (Public Image)
```yaml
image: coturn/coturn:latest
```
- **Source:** Docker Hub (public)
- **Used for:** TURN server, NAT traversal
- **No build needed**

### **5. Nginx** (Public Image)
```yaml
image: nginx:alpine
```
- **Source:** Docker Hub (public)
- **Used for:** Web server, reverse proxy
- **No build needed**

### **6. Registration Monitor** (Your Custom Image)
```dockerfile
# Built from: registration-monitor/Dockerfile
image: webrtc-registration-monitor:latest
```
- **Source:** Built by you
- **Used for:** Dynamic DN registration
- **Needs to be pushed to registry**

### **7. Dashboard API** (Your Custom Image)
```dockerfile
# Built from: dashboard/Dockerfile
image: webrtc-dashboard-api:latest
```
- **Source:** Built by you
- **Used for:** Monitoring dashboard
- **Needs to be pushed to registry**

---

## 🚀 Workflow: Docker → Kubernetes

### **Step 1: Build Your Custom Docker Images**

```bash
cd D:\Abhi\WebRTC\webrtc-genesys

# Build registration monitor
docker build -t webrtc-registration-monitor:1.0 registration-monitor/

# Build dashboard API
docker build -t webrtc-dashboard-api:1.0 dashboard/

# Verify images
docker images | grep webrtc
```

### **Step 2: Tag Images for Your Registry**

You need to push your custom images to a container registry so Kubernetes can pull them.

**Option A: Docker Hub (Free, Public)**
```bash
# Login
docker login

# Tag images with your Docker Hub username
docker tag webrtc-registration-monitor:1.0 yourusername/webrtc-registration-monitor:1.0
docker tag webrtc-dashboard-api:1.0 yourusername/webrtc-dashboard-api:1.0

# Push to Docker Hub
docker push yourusername/webrtc-registration-monitor:1.0
docker push yourusername/webrtc-dashboard-api:1.0
```

**Option B: AWS ECR (Private, Recommended for Production)**
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create repositories
aws ecr create-repository --repository-name webrtc-registration-monitor
aws ecr create-repository --repository-name webrtc-dashboard-api

# Tag images
docker tag webrtc-registration-monitor:1.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-registration-monitor:1.0
docker tag webrtc-dashboard-api:1.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-dashboard-api:1.0

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-registration-monitor:1.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-dashboard-api:1.0
```

**Option C: Google GCR**
```bash
# Login
gcloud auth configure-docker

# Tag images
docker tag webrtc-registration-monitor:1.0 gcr.io/your-project-id/webrtc-registration-monitor:1.0
docker tag webrtc-dashboard-api:1.0 gcr.io/your-project-id/webrtc-dashboard-api:1.0

# Push to GCR
docker push gcr.io/your-project-id/webrtc-registration-monitor:1.0
docker push gcr.io/your-project-id/webrtc-dashboard-api:1.0
```

### **Step 3: Update Kubernetes Manifests**

Update the image references in your Kubernetes YAML files:

**kubernetes/deployments/registration-monitor.yaml:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: registration-monitor
        # Change this to your registry
        image: yourusername/webrtc-registration-monitor:1.0
        # or
        # image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-registration-monitor:1.0
```

**kubernetes/deployments/dashboard.yaml:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: dashboard-api
        # Change this to your registry
        image: yourusername/webrtc-dashboard-api:1.0
```

### **Step 4: Deploy to Kubernetes**

Kubernetes will automatically pull these Docker images and run them:

```bash
# Create namespace
kubectl apply -f kubernetes/namespace.yaml

# Kubernetes pulls Docker images and creates pods
kubectl apply -f kubernetes/deployments/

# Watch Kubernetes pull and start your Docker containers
kubectl get pods -w
```

---

## 🔄 What Kubernetes Does With Your Docker Containers

### **1. Pulls Docker Images**
```bash
# Kubernetes automatically runs:
# docker pull yourusername/webrtc-registration-monitor:1.0
```

### **2. Creates Pods (Runs Containers)**
```bash
# Each pod is essentially:
# docker run -d --name registration-monitor-xyz \
#   -e ASTERISK_HOST=127.0.0.1 \
#   yourusername/webrtc-registration-monitor:1.0
```

### **3. Manages Container Lifecycle**
```bash
# If container crashes, Kubernetes automatically restarts it
# Like running: docker restart registration-monitor-xyz

# If node fails, Kubernetes moves container to another node
```

### **4. Scales Containers**
```bash
# When you run: kubectl scale deployment registration-monitor --replicas=20
# Kubernetes runs your Docker container 20 times across nodes

# Equivalent to:
# docker run ... registration-monitor-1
# docker run ... registration-monitor-2
# ... × 20
```

### **5. Load Balances Traffic**
```bash
# Kubernetes Service acts like docker-compose ports mapping
# But distributes traffic across all replicas
```

---

## 📋 Comparison: Docker Compose vs Kubernetes

### **Your POC (Docker Compose):**
```yaml
# docker-compose.yml
services:
  asterisk:
    image: andrius/asterisk:latest
    container_name: webrtc-asterisk
    ports:
      - "5060:5060"
    volumes:
      - ./asterisk/etc:/etc/asterisk
    environment:
      - ASTERISK_UID=1000
```

**What Docker Compose Does:**
1. Pulls `andrius/asterisk:latest` image
2. Runs container with specific ports/volumes
3. Manages on single host
4. Manual scaling only

### **Your Production (Kubernetes):**
```yaml
# kubernetes/deployments/asterisk.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: asterisk
spec:
  replicas: 10
  template:
    spec:
      containers:
      - name: asterisk
        image: andrius/asterisk:latest  # Same Docker image!
        ports:
        - containerPort: 5060
        volumeMounts:
        - name: asterisk-config
          mountPath: /etc/asterisk
        env:
        - name: ASTERISK_UID
          value: "1000"
```

**What Kubernetes Does:**
1. Pulls same `andrius/asterisk:latest` image
2. Runs 10 containers (replicas: 10) across 20 nodes
3. Manages across cluster
4. Auto-scales from 10 to 30 based on CPU
5. Auto-restarts if container crashes
6. Load balances traffic across all 10 containers

**Key Point:** Same Docker image, same configuration - Kubernetes just manages it at scale!

---

## 🎛️ Managing Your Docker Containers via Kubernetes

### **View Running Containers:**
```bash
# Like "docker ps"
kubectl get pods

# Detailed view
kubectl get pods -o wide
```

### **View Container Logs:**
```bash
# Like "docker logs"
kubectl logs asterisk-0

# Follow logs
kubectl logs -f asterisk-0

# All containers with label
kubectl logs -l app=asterisk --tail=100
```

### **Execute Commands in Container:**
```bash
# Like "docker exec -it"
kubectl exec -it asterisk-0 -- /bin/bash
kubectl exec -it asterisk-0 -- asterisk -rvvv
```

### **Restart Container:**
```bash
# Like "docker restart"
kubectl delete pod asterisk-0
# Kubernetes automatically creates new pod with same config
```

### **Update Container Image:**
```bash
# Build new version
docker build -t yourusername/webrtc-registration-monitor:2.0 registration-monitor/
docker push yourusername/webrtc-registration-monitor:2.0

# Update Kubernetes (rolling update - zero downtime)
kubectl set image deployment/registration-monitor \
  registration-monitor=yourusername/webrtc-registration-monitor:2.0

# Like "docker-compose down && docker-compose up" but with zero downtime
```

### **Scale Containers:**
```bash
# Like running "docker run" multiple times
kubectl scale statefulset asterisk --replicas=20

# Kubernetes runs your Docker container 20 times
```

### **View Container Resource Usage:**
```bash
# Like "docker stats"
kubectl top pods
kubectl top nodes
```

---

## 🏗️ Image Build & Update Workflow

### **Development Cycle:**

```bash
# 1. Make code changes
vim registration-monitor/registration_monitor.py

# 2. Build Docker image
docker build -t yourusername/webrtc-registration-monitor:1.1 registration-monitor/

# 3. Test locally with Docker Compose (optional)
docker-compose up -d registration-monitor

# 4. Push to registry
docker push yourusername/webrtc-registration-monitor:1.1

# 5. Update Kubernetes
kubectl set image deployment/registration-monitor \
  registration-monitor=yourusername/webrtc-registration-monitor:1.1

# 6. Verify rollout
kubectl rollout status deployment/registration-monitor

# 7. Check new pods are running
kubectl get pods -l app=registration-monitor
```

### **Rollback if Issues:**
```bash
# Kubernetes keeps history of previous Docker image versions
kubectl rollout undo deployment/registration-monitor

# Or rollback to specific version
kubectl rollout undo deployment/registration-monitor --to-revision=2
```

---

## 🎯 Summary: Docker + Kubernetes Together

| What Docker Does | What Kubernetes Does |
|------------------|---------------------|
| Builds images | Pulls images |
| Packages apps | Deploys apps |
| Runs containers (single host) | Runs containers (cluster) |
| Manual scaling | Auto-scaling |
| Manual restart | Auto-restart |
| Single point of failure | High availability |
| docker-compose.yml | YAML manifests |

**Your Workflow:**
1. ✅ **Build** Docker images (on your Windows machine)
2. ✅ **Push** to container registry (Docker Hub / ECR / GCR)
3. ✅ **Deploy** via Kubernetes (pulls and manages your Docker containers)
4. ✅ **Scale** automatically (Kubernetes runs more copies of your containers)
5. ✅ **Monitor** via Kubernetes commands (same as docker logs/exec/stats)

---

## 📝 Next Steps

### **For POC (Current - Docker Compose):**
```bash
# Continue using Docker Compose on 192.168.210.54
cd /opt/gcti_apps/webrtc
sudo docker-compose up -d

# Your Docker images run directly via Docker Engine
```

### **For Production (Future - Kubernetes):**
```bash
# 1. Build and push custom images
docker build -t yourusername/webrtc-registration-monitor:1.0 registration-monitor/
docker push yourusername/webrtc-registration-monitor:1.0

docker build -t yourusername/webrtc-dashboard-api:1.0 dashboard/
docker push yourusername/webrtc-dashboard-api:1.0

# 2. Update Kubernetes manifests with your registry
# Edit: kubernetes/deployments/registration-monitor.yaml
# Edit: kubernetes/deployments/dashboard.yaml

# 3. Create Kubernetes cluster
eksctl create cluster --name webrtc-gateway --nodes 20

# 4. Deploy (Kubernetes pulls your Docker images)
kubectl apply -f kubernetes/

# 5. Kubernetes now manages your Docker containers at scale!
```

---

**Key Takeaway:** You keep building Docker images the same way. Kubernetes just **orchestrates** them across multiple servers with auto-scaling, load balancing, and high availability! 🚀


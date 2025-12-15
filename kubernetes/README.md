# Kubernetes Deployment for WebRTC Gateway
## Enterprise Scale - 5000 Concurrent Calls

**Deployment Type:** Kubernetes  
**Target Capacity:** 5,000 simultaneous calls  
**Architecture:** Distributed with auto-scaling

---

## 🎯 Why Kubernetes?

### **Benefits for Enterprise Scale:**
- ✅ **Auto-scaling:** Automatically add/remove Asterisk pods based on load
- ✅ **High Availability:** Built-in pod restart, health checks, rolling updates
- ✅ **Load Balancing:** Native service load balancing
- ✅ **Resource Management:** CPU/memory limits and requests
- ✅ **Easy Updates:** Rolling updates with zero downtime
- ✅ **Multi-cloud:** Works on AWS EKS, Azure AKS, GCP GKE, or on-premise
- ✅ **Observability:** Built-in metrics, logging, and monitoring

---

## 📦 Architecture Overview

```
                    Kubernetes Cluster
┌────────────────────────────────────────────────────┐
│                                                    │
│   ┌──────────────────────────────────────┐        │
│   │  Ingress (NGINX)                     │        │
│   │  - External load balancer            │        │
│   │  - SSL termination                   │        │
│   └──────────────────────────────────────┘        │
│               │                                    │
│   ┌───────────┴───────────┐                       │
│   │   Service: nginx      │                       │
│   └───────────────────────┘                       │
│               │                                    │
│   ┌───────────┴───────────┐                       │
│   │  Deployment: Nginx    │                       │
│   │  Replicas: 2          │                       │
│   └───────────────────────┘                       │
│                                                    │
│   ┌──────────────────────────────────────┐        │
│   │  StatefulSet: Asterisk               │        │
│   │  Replicas: 10-20 (auto-scale)        │        │
│   │  - asterisk-0, asterisk-1, ...       │        │
│   │  - Each handles 500 calls            │        │
│   └──────────────────────────────────────┘        │
│               │                                    │
│   ┌───────────┴───────────┐                       │
│   │  Service: asterisk    │                       │
│   │  Type: ClusterIP      │                       │
│   └───────────────────────┘                       │
│                                                    │
│   ┌──────────────────────────────────────┐        │
│   │  StatefulSet: Redis                  │        │
│   │  Replicas: 3 (master + 2 replicas)   │        │
│   └──────────────────────────────────────┘        │
│                                                    │
│   ┌──────────────────────────────────────┐        │
│   │  Deployment: Kamailio                │        │
│   │  Replicas: 2                         │        │
│   └──────────────────────────────────────┘        │
│                                                    │
│   ┌──────────────────────────────────────┐        │
│   │  DaemonSet: Coturn                   │        │
│   │  (One per node for TURN)             │        │
│   └──────────────────────────────────────┘        │
│                                                    │
│   ┌──────────────────────────────────────┐        │
│   │  Deployment: Dashboard               │        │
│   │  Replicas: 2                         │        │
│   └──────────────────────────────────────┘        │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

### **Kubernetes Cluster:**
- **Option 1:** Managed Kubernetes
  - AWS EKS (Recommended for cloud)
  - Azure AKS
  - Google GKE
- **Option 2:** On-Premise with kubeadm ⭐ **RECOMMENDED FOR YOUR SETUP**
  - Kubernetes 1.28+ (installed via kubeadm)
  - 3 master nodes + 20 worker nodes
  - CentOS/RHEL 7.9
  - NFS storage for persistent volumes
  - **See:** `KUBEADM_ONPREMISE_GUIDE.md` for complete setup

### **Tools Required:**
```bash
# kubectl (Kubernetes CLI)
kubectl version

# Helm (package manager for Kubernetes)
helm version

# Optional: kustomize for advanced config
kustomize version
```

---

## 🚀 Quick Start

### **1. Create Namespace:**
```bash
kubectl create namespace webrtc-gateway
kubectl config set-context --current --namespace=webrtc-gateway
```

### **2. Create ConfigMaps:**
```bash
kubectl apply -f kubernetes/configmaps/
```

### **3. Create Persistent Volumes:**
```bash
kubectl apply -f kubernetes/pv/
```

### **4. Deploy Services:**
```bash
# Deploy in order
kubectl apply -f kubernetes/deployments/redis.yaml
kubectl apply -f kubernetes/deployments/asterisk.yaml
kubectl apply -f kubernetes/deployments/kamailio.yaml
kubectl apply -f kubernetes/deployments/coturn.yaml
kubectl apply -f kubernetes/deployments/nginx.yaml
kubectl apply -f kubernetes/deployments/dashboard.yaml
kubectl apply -f kubernetes/deployments/registration-monitor.yaml
```

### **5. Verify Deployment:**
```bash
kubectl get pods
kubectl get services
kubectl get ingress
```

---

## 📊 Resource Requirements

### **Per Component:**

| Component | Replicas | CPU Request | CPU Limit | RAM Request | RAM Limit |
|-----------|----------|-------------|-----------|-------------|-----------|
| Asterisk | 10-20 | 2 cores | 4 cores | 4 GB | 8 GB |
| Redis | 3 | 1 core | 2 cores | 2 GB | 4 GB |
| Kamailio | 2 | 1 core | 2 cores | 1 GB | 2 GB |
| Coturn | 1/node | 1 core | 2 cores | 512 MB | 1 GB |
| Nginx | 2 | 500m | 1 core | 256 MB | 512 MB |
| Dashboard | 2 | 250m | 500m | 256 MB | 512 MB |
| Monitor | 10-20 | 250m | 500m | 256 MB | 512 MB |

### **Total Cluster Resources (20 Asterisk pods):**
```
CPU: 60-80 cores
RAM: 120-160 GB
Storage: 500 GB - 1 TB (logs, persistent data)
```

---

## 🔄 Auto-Scaling Configuration

### **Horizontal Pod Autoscaler (HPA):**

```yaml
# Automatically scale Asterisk pods based on CPU usage
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: asterisk-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: StatefulSet
    name: asterisk
  minReplicas: 10
  maxReplicas: 30
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 🌐 Networking

### **Services:**

```yaml
# External LoadBalancer (for WebRTC clients)
apiVersion: v1
kind: Service
metadata:
  name: nginx-external
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 443
    name: https
  - port: 80
    targetPort: 80
    name: http
  selector:
    app: nginx
```

### **Ingress:**
```yaml
# NGINX Ingress for HTTPS/WSS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webrtc-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/websocket-services: "asterisk"
spec:
  tls:
  - hosts:
    - webrtc.yourcompany.com
    secretName: webrtc-tls
  rules:
  - host: webrtc.yourcompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nginx
            port:
              number: 80
```

---

## 💾 Storage

### **Persistent Volume Claims:**

```yaml
# Redis data persistence
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd

# Asterisk logs
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: asterisk-logs
spec:
  accessModes:
    - ReadWriteMany  # Shared across pods
  resources:
    requests:
      storage: 100Gi
  storageClassName: shared-nfs
```

---

## 🔧 Configuration Management

### **ConfigMaps:**

All configuration files are stored as ConfigMaps:
- `asterisk-config` - pjsip.conf, extensions.conf, etc.
- `kamailio-config` - kamailio.cfg, dispatcher.list
- `nginx-config` - nginx.conf
- `redis-config` - redis.conf

**Update Config:**
```bash
# Edit config
kubectl edit configmap asterisk-config

# Reload (rolling restart)
kubectl rollout restart statefulset/asterisk
```

---

## 📈 Monitoring & Observability

### **Prometheus Metrics:**
```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: asterisk-metrics
spec:
  selector:
    matchLabels:
      app: asterisk
  endpoints:
  - port: metrics
    interval: 30s
```

### **Grafana Dashboards:**
- Asterisk call metrics
- WebRTC client connections
- SIP registration status
- Resource utilization

---

## 🔒 Security

### **Network Policies:**
```yaml
# Restrict traffic between pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: asterisk-policy
spec:
  podSelector:
    matchLabels:
      app: asterisk
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
    - podSelector:
        matchLabels:
          app: kamailio
```

### **Secrets:**
```bash
# Store sensitive data as secrets
kubectl create secret generic asterisk-secrets \
  --from-literal=ami-password=admin123 \
  --from-literal=genesys-password=yourpassword
```

---

## 📋 Deployment Checklist

### **Pre-Deployment:**
- [ ] Kubernetes cluster provisioned (10-20 nodes)
- [ ] kubectl configured and connected
- [ ] Namespace created (`webrtc-gateway`)
- [ ] Storage class configured
- [ ] Ingress controller installed (NGINX)
- [ ] cert-manager installed (for SSL)
- [ ] Monitoring stack installed (Prometheus/Grafana)

### **Deployment:**
- [ ] ConfigMaps created
- [ ] Secrets created
- [ ] PVCs provisioned
- [ ] Redis StatefulSet deployed
- [ ] Asterisk StatefulSet deployed (10 pods)
- [ ] Kamailio Deployment deployed
- [ ] Coturn DaemonSet deployed
- [ ] Nginx Deployment deployed
- [ ] Ingress configured
- [ ] DNS pointed to LoadBalancer IP

### **Post-Deployment:**
- [ ] All pods running (`kubectl get pods`)
- [ ] Services created (`kubectl get svc`)
- [ ] Ingress has IP (`kubectl get ingress`)
- [ ] SSL certificate issued
- [ ] Test WebRTC client connection
- [ ] Test call flow
- [ ] Monitor metrics in Grafana

---

## 🛠️ Common Commands

### **Scaling:**
```bash
# Manual scale Asterisk
kubectl scale statefulset asterisk --replicas=20

# Enable auto-scaling
kubectl autoscale statefulset asterisk --min=10 --max=30 --cpu-percent=70
```

### **Rolling Updates:**
```bash
# Update image
kubectl set image statefulset/asterisk asterisk=asterisk:new-version

# Check rollout status
kubectl rollout status statefulset/asterisk

# Rollback if needed
kubectl rollout undo statefulset/asterisk
```

### **Logs:**
```bash
# View logs
kubectl logs -f asterisk-0
kubectl logs -f -l app=asterisk  # All pods

# Aggregated logs (if using EFK stack)
kubectl logs -f deployment/fluentd
```

### **Debugging:**
```bash
# Exec into pod
kubectl exec -it asterisk-0 -- /bin/bash
kubectl exec -it asterisk-0 -- asterisk -rvvv

# Port forwarding for testing
kubectl port-forward asterisk-0 8088:8088
kubectl port-forward svc/redis 6379:6379

# Describe resources
kubectl describe pod asterisk-0
kubectl describe svc asterisk
```

---

## 💰 Cost Estimation

### **AWS EKS Example:**

```
Worker Nodes: 20× m5.xlarge (4 vCPU, 16 GB)
  - $0.192/hour × 20 × 730 hours = $2,803/month

EKS Control Plane: $73/month

Load Balancer: $25/month

EBS Storage (1 TB): $100/month

Data Transfer: $500/month (estimate)

Total: ~$3,500/month
```

### **GKE/AKS:** Similar pricing, ~$3,000-4,000/month

### **On-Premise:** 
- Hardware: $156K-230K initial (as per ON_PREMISE_DEPLOYMENT_GUIDE.md)
- Operating: $118K/year

---

## 📚 File Structure

```
kubernetes/
├── README.md (this file)
├── namespace.yaml
├── configmaps/
│   ├── asterisk-config.yaml
│   ├── kamailio-config.yaml
│   ├── nginx-config.yaml
│   └── redis-config.yaml
├── secrets/
│   └── asterisk-secrets.yaml
├── pv/
│   ├── redis-pvc.yaml
│   └── logs-pvc.yaml
├── deployments/
│   ├── redis.yaml
│   ├── asterisk.yaml
│   ├── kamailio.yaml
│   ├── coturn.yaml
│   ├── nginx.yaml
│   ├── dashboard.yaml
│   └── registration-monitor.yaml
├── services/
│   ├── redis.yaml
│   ├── asterisk.yaml
│   ├── kamailio.yaml
│   ├── nginx.yaml
│   └── dashboard.yaml
├── ingress/
│   └── webrtc-ingress.yaml
├── hpa/
│   └── asterisk-hpa.yaml
└── monitoring/
    ├── servicemonitor.yaml
    └── grafana-dashboard.json
```

---

## 🚀 Next Steps

1. **Create all Kubernetes manifests** (see separate YAML files)
2. **Test on small cluster** (3 nodes, 3 Asterisk pods)
3. **Scale up** to production (20 nodes, 20 Asterisk pods)
4. **Enable monitoring** (Prometheus/Grafana)
5. **Configure auto-scaling** (HPA)
6. **Setup CI/CD** (GitOps with ArgoCD/Flux)

---

**Document Version:** 1.0  
**Last Updated:** December 16, 2025  
**Status:** Ready for Kubernetes Deployment


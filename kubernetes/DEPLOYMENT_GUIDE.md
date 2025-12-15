# Kubernetes Deployment Guide
## WebRTC Gateway - Step-by-Step

**Target:** Enterprise deployment for 5000 concurrent calls  
**Platform:** Kubernetes (EKS/AKS/GKE or On-Premise)  
**Time:** 2-4 hours

---

## 📋 Prerequisites

### **1. Kubernetes Cluster**

**Option A: AWS EKS (Recommended)**
```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create cluster (20 nodes for 5000 calls)
eksctl create cluster \
  --name webrtc-gateway \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type m5.xlarge \
  --nodes 20 \
  --nodes-min 10 \
  --nodes-max 30 \
  --managed

# Connect kubectl
aws eks update-kubeconfig --region us-east-1 --name webrtc-gateway
```

**Option B: Google GKE**
```bash
# Create cluster
gcloud container clusters create webrtc-gateway \
  --zone us-central1-a \
  --machine-type n1-standard-4 \
  --num-nodes 20 \
  --min-nodes 10 \
  --max-nodes 30 \
  --enable-autoscaling

# Connect kubectl
gcloud container clusters get-credentials webrtc-gateway --zone us-central1-a
```

**Option C: On-Premise Kubernetes**
```bash
# Requires existing Kubernetes 1.25+
kubectl version --short
# Client Version: v1.28.0
# Server Version: v1.28.0
```

### **2. Install Required Tools**

```bash
# kubectl (Kubernetes CLI)
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client

# Helm (Package Manager)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version

# cert-manager (for SSL)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/cloud/deploy.yaml
```

### **3. Verify Cluster**

```bash
# Check nodes
kubectl get nodes

# Should show 20 nodes Ready

# Check storage class
kubectl get storageclass

# You should see at least one StorageClass (e.g., gp2, gp3, standard)
```

---

## 🚀 Deployment Steps

### **Step 1: Create Namespace**

```bash
cd kubernetes/
kubectl apply -f namespace.yaml

# Set default namespace
kubectl config set-context --current --namespace=webrtc-gateway

# Verify
kubectl get namespace webrtc-gateway
```

### **Step 2: Create ConfigMaps**

You need to create ConfigMaps for Asterisk, Kamailio, and Nginx configurations.

```bash
# Create Asterisk ConfigMap from local files
kubectl create configmap asterisk-config \
  --from-file=../asterisk/etc/pjsip.conf \
  --from-file=../asterisk/etc/extensions.conf \
  --from-file=../asterisk/etc/extensions-sip-endpoint.conf \
  --from-file=../asterisk/etc/rtp.conf \
  --from-file=../asterisk/etc/http.conf \
  --from-file=../asterisk/etc/asterisk.conf \
  --from-file=../asterisk/etc/logger.conf \
  --from-file=../asterisk/etc/manager.conf \
  --namespace=webrtc-gateway

# Verify
kubectl get configmap asterisk-config -o yaml

# Create Kamailio ConfigMap
kubectl create configmap kamailio-config \
  --from-file=../kamailio/kamailio.cfg \
  --from-file=../kamailio/dispatcher.list \
  --namespace=webrtc-gateway

# Create Nginx ConfigMap
kubectl create configmap nginx-config \
  --from-file=../nginx/nginx.conf \
  --namespace=webrtc-gateway
```

### **Step 3: Create Secrets**

```bash
# Asterisk AMI credentials
kubectl create secret generic asterisk-secrets \
  --from-literal=ami-user=admin \
  --from-literal=ami-password=admin123 \
  --from-literal=genesys-username=asterisk \
  --from-literal=genesys-password=yourpassword \
  --namespace=webrtc-gateway

# Verify (don't show values)
kubectl get secrets
```

### **Step 4: Deploy Redis (State Store)**

```bash
# Deploy Redis StatefulSet
kubectl apply -f deployments/redis.yaml

# Wait for Redis to be ready (3 pods)
kubectl wait --for=condition=ready pod -l app=redis --timeout=300s

# Check status
kubectl get pods -l app=redis
kubectl get pvc -l app=redis

# Test Redis
kubectl exec redis-0 -- redis-cli ping
# Expected: PONG
```

### **Step 5: Deploy Asterisk (SIP Gateway)**

```bash
# Deploy Asterisk StatefulSet (10 pods initially)
kubectl apply -f deployments/asterisk.yaml

# This will take 3-5 minutes to pull images and start
kubectl get pods -l app=asterisk -w

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app=asterisk --timeout=600s

# Check all Asterisk pods
kubectl get pods -l app=asterisk

# Test first Asterisk pod
kubectl exec asterisk-0 -- asterisk -rx "core show version"
kubectl exec asterisk-0 -- asterisk -rx "pjsip show endpoints"
```

### **Step 6: Deploy Kamailio (SIP Proxy)**

```bash
# Deploy Kamailio
kubectl apply -f deployments/kamailio.yaml

# Wait for ready
kubectl wait --for=condition=ready pod -l app=kamailio --timeout=300s

# Check status
kubectl get pods -l app=kamailio

# Test Kamailio
kubectl exec -it $(kubectl get pod -l app=kamailio -o jsonpath="{.items[0].metadata.name}") -- kamailioctl dispatcher dump
```

### **Step 7: Update Kamailio Dispatcher List**

Kamailio needs to know about all Asterisk pods:

```bash
# Get all Asterisk pod IPs
kubectl get pods -l app=asterisk -o wide

# Update dispatcher.list with all Asterisk pod IPs
# In Kubernetes, Asterisk pods are accessible via:
# asterisk-0.asterisk.webrtc-gateway.svc.cluster.local
# asterisk-1.asterisk.webrtc-gateway.svc.cluster.local
# ... etc

# Create updated dispatcher list
cat > /tmp/dispatcher.list << 'EOF'
# Asterisk pods in Kubernetes
1 sip:asterisk-0.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-1.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-2.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-3.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-4.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-5.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-6.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-7.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-8.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
1 sip:asterisk-9.asterisk.webrtc-gateway.svc.cluster.local:5060 0 0 weight=100
EOF

# Update ConfigMap
kubectl create configmap kamailio-config \
  --from-file=../kamailio/kamailio.cfg \
  --from-file=/tmp/dispatcher.list \
  --namespace=webrtc-gateway \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Kamailio to reload
kubectl rollout restart deployment/kamailio
```

### **Step 8: Deploy Coturn, Nginx, Dashboard**

These deployments are in the repository but not yet created. Create them:

```bash
# Deploy Nginx
kubectl apply -f deployments/nginx.yaml

# Deploy Dashboard API
kubectl apply -f deployments/dashboard.yaml

# Deploy Registration Monitor
kubectl apply -f deployments/registration-monitor.yaml

# Deploy Coturn (TURN server)
kubectl apply -f deployments/coturn.yaml

# Wait for all
kubectl wait --for=condition=ready pod -l app=nginx --timeout=300s
kubectl wait --for=condition=ready pod -l app=dashboard-api --timeout=300s
```

### **Step 9: Create Services**

```bash
# Apply all services
kubectl apply -f services/services.yaml

# Check services
kubectl get svc

# Wait for LoadBalancers to get external IPs (AWS/GCP)
kubectl get svc nginx-external -w
# Wait until EXTERNAL-IP shows an IP address (not <pending>)

# Note the external IP
export EXTERNAL_IP=$(kubectl get svc nginx-external -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "WebRTC Gateway External IP: $EXTERNAL_IP"
```

### **Step 10: Configure Ingress**

```bash
# Update your DNS
# Create A record: webrtc.yourcompany.com -> $EXTERNAL_IP

# Apply Ingress
kubectl apply -f ingress/webrtc-ingress.yaml

# Check ingress
kubectl get ingress

# Wait for certificate (cert-manager will auto-provision)
kubectl get certificate
kubectl describe certificate webrtc-tls
```

### **Step 11: Enable Auto-Scaling**

```bash
# Install Metrics Server (if not already installed)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Apply HPA for Asterisk
kubectl apply -f hpa/asterisk-hpa.yaml

# Check HPA status
kubectl get hpa

# Watch auto-scaling in action
kubectl get hpa asterisk-hpa -w
```

---

## ✅ Verification

### **1. Check All Pods**

```bash
kubectl get pods

# Expected output:
# NAME                           READY   STATUS    RESTARTS
# asterisk-0                     1/1     Running   0
# asterisk-1                     1/1     Running   0
# ...
# asterisk-9                     1/1     Running   0
# redis-0                        1/1     Running   0
# redis-1                        1/1     Running   0
# redis-2                        1/1     Running   0
# kamailio-xxxxx                 1/1     Running   0
# kamailio-yyyyy                 1/1     Running   0
# nginx-xxxxx                    1/1     Running   0
# dashboard-api-xxxxx            1/1     Running   0
# registration-monitor-xxxxx     1/1     Running   0
# coturn-xxxxx                   1/1     Running   0
```

### **2. Check Services**

```bash
kubectl get svc

# You should see external IPs for LoadBalancer services
```

### **3. Test WebRTC Client**

```bash
# Access via browser
https://webrtc.yourcompany.com/

# Expected: WebRTC client loads successfully
```

### **4. Test SIP Registration**

```bash
# Check any Asterisk pod
kubectl exec asterisk-0 -- asterisk -rx "pjsip show contacts"

# Register from WebRTC client (user: 5001, password: pass5001)
# Then check again
kubectl exec asterisk-0 -- asterisk -rx "pjsip show contacts"
# Should show registered contact for 5001
```

### **5. Test Dashboard**

```bash
# API test
curl https://webrtc.yourcompany.com/api/registrations

# Dashboard UI
https://webrtc.yourcompany.com/dashboard.html
```

### **6. Check Auto-Scaling**

```bash
# Current HPA status
kubectl get hpa

# Should show:
# NAME           REFERENCE             TARGETS    MINPODS   MAXPODS   REPLICAS
# asterisk-hpa   StatefulSet/asterisk  45%/70%    10        30        10
```

---

## 📊 Monitoring

### **View Logs:**

```bash
# Asterisk logs
kubectl logs asterisk-0 -f
kubectl logs -l app=asterisk --tail=100

# Redis logs
kubectl logs redis-0 -f

# Kamailio logs
kubectl logs -l app=kamailio -f

# All logs from a specific component
kubectl logs -l app=asterisk --all-containers=true
```

### **Resource Usage:**

```bash
# Per pod
kubectl top pods

# Per node
kubectl top nodes

# Detailed pod info
kubectl describe pod asterisk-0
```

### **Events:**

```bash
# Recent cluster events
kubectl get events --sort-by='.lastTimestamp'

# Events for a specific pod
kubectl describe pod asterisk-0 | grep Events -A 20
```

---

## 🔧 Common Operations

### **Scale Asterisk Manually:**

```bash
# Scale up to 20 pods
kubectl scale statefulset asterisk --replicas=20

# Check status
kubectl get pods -l app=asterisk

# Scale down to 10
kubectl scale statefulset asterisk --replicas=10
```

### **Rolling Update:**

```bash
# Update Asterisk image
kubectl set image statefulset/asterisk asterisk=andrius/asterisk:18.20.0

# Check rollout status
kubectl rollout status statefulset/asterisk

# Rollback if needed
kubectl rollout undo statefulset/asterisk
```

### **Restart Services:**

```bash
# Restart all Asterisk pods (rolling restart)
kubectl rollout restart statefulset/asterisk

# Restart Kamailio
kubectl rollout restart deployment/kamailio

# Restart specific pod
kubectl delete pod asterisk-0
# StatefulSet will automatically recreate it
```

### **Update Configuration:**

```bash
# Edit ConfigMap
kubectl edit configmap asterisk-config

# Or update from file
kubectl create configmap asterisk-config \
  --from-file=../asterisk/etc/ \
  --dry-run=client -o yaml | kubectl apply -f -

# Rolling restart to pick up changes
kubectl rollout restart statefulset/asterisk
```

### **Backup & Restore:**

```bash
# Backup Redis data
kubectl exec redis-0 -- redis-cli SAVE
kubectl cp redis-0:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb

# Backup Asterisk logs
kubectl exec asterisk-0 -- tar czf /tmp/asterisk-logs.tar.gz /var/log/asterisk
kubectl cp asterisk-0:/tmp/asterisk-logs.tar.gz ./asterisk-logs-$(date +%Y%m%d).tar.gz
```

---

## 🚨 Troubleshooting

### **Pod Won't Start:**

```bash
# Check pod status
kubectl describe pod asterisk-0

# Check logs
kubectl logs asterisk-0

# Check previous logs (if crashlooping)
kubectl logs asterisk-0 --previous

# Check events
kubectl get events --field-selector involvedObject.name=asterisk-0
```

### **ConfigMap Not Loading:**

```bash
# Verify ConfigMap exists
kubectl get configmap asterisk-config

# Check contents
kubectl describe configmap asterisk-config

# Verify volume mount in pod
kubectl describe pod asterisk-0 | grep -A 10 Mounts
```

### **Service Not Accessible:**

```bash
# Check service
kubectl get svc asterisk

# Check endpoints
kubectl get endpoints asterisk

# Port forward for testing
kubectl port-forward asterisk-0 8088:8088
curl http://localhost:8088/ws
```

### **High CPU/Memory:**

```bash
# Check resource usage
kubectl top pods

# Describe pod to see limits
kubectl describe pod asterisk-0 | grep -A 5 Limits

# Check if pod is being throttled
kubectl describe pod asterisk-0 | grep -i throttl
```

---

## 📈 Performance Tuning

### **For 5000 Concurrent Calls:**

1. **Asterisk Pods:** Start with 20 (500 calls each)
2. **Worker Nodes:** 20-25 nodes (m5.xlarge or equivalent)
3. **Redis:** 3-node cluster with 4 GB RAM each
4. **Kamailio:** 2-3 replicas
5. **Network:** Use enhanced networking on cloud providers

### **Resource Limits:**

```yaml
# Asterisk pods
resources:
  requests:
    cpu: 2000m      # 2 cores
    memory: 4Gi
  limits:
    cpu: 4000m      # 4 cores max
    memory: 8Gi

# Tune based on actual usage (kubectl top pods)
```

---

## 🎯 Production Readiness Checklist

- [ ] SSL certificates configured (cert-manager + Let's Encrypt)
- [ ] DNS pointed to LoadBalancer IPs
- [ ] Auto-scaling enabled (HPA for Asterisk)
- [ ] Monitoring configured (Prometheus + Grafana)
- [ ] Alerting configured (Alertmanager)
- [ ] Backup strategy in place (Redis, configs)
- [ ] Disaster recovery plan documented
- [ ] Load testing completed (5000 concurrent calls)
- [ ] Security policies applied (NetworkPolicies, PodSecurityPolicies)
- [ ] Resource limits tuned
- [ ] Logging aggregation configured (ELK/EFK stack)
- [ ] CI/CD pipeline set up (GitOps with ArgoCD/Flux)

---

## 📚 Additional Resources

- **Kubernetes Documentation:** https://kubernetes.io/docs/
- **Helm Charts:** https://helm.sh/
- **AWS EKS:** https://docs.aws.amazon.com/eks/
- **GCP GKE:** https://cloud.google.com/kubernetes-engine/docs
- **Azure AKS:** https://docs.microsoft.com/en-us/azure/aks/

---

**Deployment Guide Version:** 1.0  
**Last Updated:** December 16, 2025  
**Status:** Production Ready


# On-Premise Kubernetes Deployment with kubeadm
## WebRTC Gateway - 5000 Concurrent Calls

**Infrastructure:** On-Premise Data Center  
**Kubernetes Tool:** kubeadm  
**Operating System:** CentOS 7.9 / RHEL 7.9  
**Target Capacity:** 5,000 simultaneous calls

---

## 🎯 Overview

This guide deploys Kubernetes on your **on-premise infrastructure** using **kubeadm**, then deploys the WebRTC Gateway stack.

```
Your Data Center
┌────────────────────────────────────────────────────┐
│                                                    │
│  Master Node (1-3 nodes for HA)                   │
│  - Control Plane                                  │
│  - etcd database                                  │
│  - API Server                                     │
│                                                    │
│  Worker Nodes (20 nodes)                          │
│  - Asterisk pods                                  │
│  - Redis cluster                                  │
│  - Kamailio, Coturn, Nginx                       │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 📋 Hardware Requirements

### **Master Nodes (3 for High Availability):**
```
CPU: 4 cores (8 recommended)
RAM: 8 GB (16 GB recommended)
Disk: 100 GB SSD
Network: 1 Gbps
OS: CentOS 7.9 / RHEL 7.9

IPs (example):
- master-1: 192.168.210.101
- master-2: 192.168.210.102
- master-3: 192.168.210.103
```

### **Worker Nodes (20 for 5000 calls):**
```
CPU: 4 cores
RAM: 16 GB
Disk: 200 GB SSD
Network: 1 Gbps
OS: CentOS 7.9 / RHEL 7.9

IPs (example):
- worker-1:  192.168.210.111
- worker-2:  192.168.210.112
- worker-3:  192.168.210.113
...
- worker-20: 192.168.210.130
```

### **Load Balancer (Optional but Recommended):**
```
HAProxy or hardware load balancer for master nodes
VIP: 192.168.210.100
```

---

## 🚀 Phase 1: Prepare All Nodes (Master + Workers)

Run these steps on **ALL** nodes (masters and workers):

### **Step 1.1: Update /etc/hosts**

```bash
# SSH to each node and edit /etc/hosts
sudo vi /etc/hosts

# Add all nodes:
192.168.210.100  k8s-api           # Load balancer VIP
192.168.210.101  master-1
192.168.210.102  master-2
192.168.210.103  master-3
192.168.210.111  worker-1
192.168.210.112  worker-2
192.168.210.113  worker-3
# ... add all 20 workers
192.168.210.130  worker-20
```

### **Step 1.2: Disable SELinux and Firewall (Temporarily)**

```bash
# Disable SELinux
sudo setenforce 0
sudo sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config

# Disable firewalld (we'll configure it later)
sudo systemctl stop firewalld
sudo systemctl disable firewalld

# Or configure firewalld with required ports (see below)
```

### **Step 1.3: Disable Swap**

```bash
# Kubernetes requires swap to be disabled
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# Verify swap is off
free -h
# Swap line should show 0
```

### **Step 1.4: Load Kernel Modules**

```bash
# Load required kernel modules
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# Verify
lsmod | grep br_netfilter
lsmod | grep overlay
```

### **Step 1.5: Configure Sysctl**

```bash
# Set up required sysctl params
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

# Apply sysctl params
sudo sysctl --system

# Verify
sysctl net.bridge.bridge-nf-call-iptables net.bridge.bridge-nf-call-ip6tables net.ipv4.ip_forward
```

### **Step 1.6: Install Container Runtime (containerd)**

```bash
# Install containerd
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y containerd.io

# Configure containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# Enable SystemdCgroup
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# Start containerd
sudo systemctl enable containerd
sudo systemctl start containerd
sudo systemctl status containerd
```

### **Step 1.7: Install kubeadm, kubelet, kubectl**

```bash
# Add Kubernetes repository
cat <<EOF | sudo tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.28/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.28/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF

# Install Kubernetes components
sudo yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes

# Enable kubelet
sudo systemctl enable kubelet
sudo systemctl start kubelet

# Verify installation
kubeadm version
kubelet --version
kubectl version --client
```

---

## 🎛️ Phase 2: Initialize First Master Node

Run on **master-1** ONLY:

### **Step 2.1: Initialize Cluster**

```bash
# Initialize Kubernetes cluster
sudo kubeadm init \
  --control-plane-endpoint="k8s-api:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.210.101

# This will take 2-3 minutes

# Expected output:
# Your Kubernetes control-plane has initialized successfully!
# 
# To start using your cluster, run:
#   mkdir -p $HOME/.kube
#   sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
#   sudo chown $(id -u):$(id -g) $HOME/.kube/config
#
# You can now join any number of control-plane nodes by running:
#   kubeadm join k8s-api:6443 --token <token> \
#     --discovery-token-ca-cert-hash sha256:<hash> \
#     --control-plane --certificate-key <key>
#
# Join worker nodes with:
#   kubeadm join k8s-api:6443 --token <token> \
#     --discovery-token-ca-cert-hash sha256:<hash>

# SAVE THE OUTPUT! You'll need the join commands.
```

### **Step 2.2: Configure kubectl for root**

```bash
# Set up kubectl for current user
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Verify
kubectl get nodes
# NAME       STATUS     ROLES           AGE   VERSION
# master-1   NotReady   control-plane   30s   v1.28.0

# NotReady is normal - we need to install CNI next
```

### **Step 2.3: Install CNI (Calico)**

```bash
# Install Calico for pod networking
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.26.0/manifests/calico.yaml

# Wait for Calico to be ready (2-3 minutes)
kubectl wait --for=condition=ready pod -l k8s-app=calico-node -n kube-system --timeout=300s

# Verify node is now Ready
kubectl get nodes
# NAME       STATUS   ROLES           AGE   VERSION
# master-1   Ready    control-plane   3m    v1.28.0
```

---

## 👥 Phase 3: Join Additional Master Nodes (Optional - HA)

Run on **master-2** and **master-3**:

```bash
# Use the join command from kubeadm init output
sudo kubeadm join k8s-api:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash> \
  --control-plane --certificate-key <key>

# Set up kubectl on these masters too
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Verify from master-1
kubectl get nodes
# NAME       STATUS   ROLES           AGE     VERSION
# master-1   Ready    control-plane   10m     v1.28.0
# master-2   Ready    control-plane   2m      v1.28.0
# master-3   Ready    control-plane   1m      v1.28.0
```

---

## 🖥️ Phase 4: Join Worker Nodes

Run on **ALL 20 worker nodes** (worker-1 through worker-20):

### **Step 4.1: Join Cluster**

```bash
# Use the worker join command from kubeadm init output
sudo kubeadm join k8s-api:6443 --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>

# This takes 1-2 minutes per node
```

### **Step 4.2: Verify All Nodes**

From **master-1**:

```bash
# Check all nodes are Ready
kubectl get nodes -o wide

# Expected output (20 workers + 3 masters = 23 nodes):
# NAME       STATUS   ROLES           AGE   VERSION   INTERNAL-IP       OS-IMAGE
# master-1   Ready    control-plane   20m   v1.28.0   192.168.210.101   CentOS Linux 7
# master-2   Ready    control-plane   12m   v1.28.0   192.168.210.102   CentOS Linux 7
# master-3   Ready    control-plane   11m   v1.28.0   192.168.210.103   CentOS Linux 7
# worker-1   Ready    <none>          5m    v1.28.0   192.168.210.111   CentOS Linux 7
# worker-2   Ready    <none>          5m    v1.28.0   192.168.210.112   CentOS Linux 7
# ...
# worker-20  Ready    <none>          5m    v1.28.0   192.168.210.130   CentOS Linux 7

# All should show STATUS = Ready
```

### **Step 4.3: Label Worker Nodes**

```bash
# Label nodes for better organization
for i in {1..20}; do
  kubectl label node worker-$i node-role.kubernetes.io/worker=worker
done

# Verify
kubectl get nodes
# Now workers will show ROLES = worker
```

---

## 💾 Phase 5: Set Up Storage (NFS)

Kubernetes on-premise needs a storage solution. We'll use NFS.

### **Step 5.1: Set Up NFS Server**

On a dedicated NFS server (or use master-1):

```bash
# Install NFS server
sudo yum install -y nfs-utils

# Create NFS export directory
sudo mkdir -p /nfs/kubernetes

# Set permissions
sudo chmod 777 /nfs/kubernetes

# Configure NFS exports
echo "/nfs/kubernetes *(rw,sync,no_root_squash,no_subtree_check)" | sudo tee -a /etc/exports

# Start NFS
sudo systemctl enable nfs-server
sudo systemctl start nfs-server

# Export shares
sudo exportfs -a

# Verify
sudo exportfs -v
```

### **Step 5.2: Install NFS Client on All Nodes**

On **ALL nodes** (masters + workers):

```bash
# Install NFS client
sudo yum install -y nfs-utils

# Test mount (from any worker)
sudo mount -t nfs 192.168.210.101:/nfs/kubernetes /mnt
ls /mnt
sudo umount /mnt
```

### **Step 5.3: Install NFS Provisioner in Kubernetes**

From **master-1**:

```bash
# Install Helm (if not installed)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add NFS provisioner Helm repo
helm repo add nfs-subdir-external-provisioner https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/

# Install NFS provisioner
helm install nfs-provisioner nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
  --set nfs.server=192.168.210.101 \
  --set nfs.path=/nfs/kubernetes \
  --set storageClass.defaultClass=true \
  --namespace kube-system

# Verify storage class
kubectl get storageclass
# NAME                   PROVISIONER
# nfs-client (default)   cluster.local/nfs-provisioner

# Test with a PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 1Gi
EOF

# Check PVC
kubectl get pvc test-pvc
# STATUS should be Bound

# Clean up test
kubectl delete pvc test-pvc
```

---

## 🌐 Phase 6: Install Ingress Controller (NGINX)

From **master-1**:

```bash
# Install NGINX Ingress Controller (bare metal version)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/baremetal/deploy.yaml

# Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx

# The service will be NodePort (not LoadBalancer on bare metal)
# NAME                                 TYPE        PORT(S)
# ingress-nginx-controller             NodePort    80:XXXXX/TCP,443:XXXXX/TCP

# Note the NodePort numbers (e.g., 80:31234, 443:31567)
```

### **Configure External Access:**

You have two options:

**Option A: Use NodePort directly**
- Access via any node IP + NodePort (e.g., `http://192.168.210.111:31234`)

**Option B: Use external load balancer (Recommended)**
- Configure HAProxy or hardware LB to forward 80/443 to NodePorts on all workers

```bash
# HAProxy example config:
frontend http_frontend
  bind *:80
  default_backend k8s_http

frontend https_frontend
  bind *:443
  default_backend k8s_https

backend k8s_http
  balance roundrobin
  server worker1 192.168.210.111:31234 check
  server worker2 192.168.210.112:31234 check
  # ... all 20 workers

backend k8s_https
  balance roundrobin
  server worker1 192.168.210.111:31567 check
  server worker2 192.168.210.112:31567 check
  # ... all 20 workers
```

---

## 🔐 Phase 7: Install cert-manager (SSL Certificates)

From **master-1**:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=300s

# Verify
kubectl get pods -n cert-manager
```

---

## 📦 Phase 8: Deploy WebRTC Gateway Application

Now deploy your WebRTC Gateway stack!

### **Step 8.1: Clone Your Repository**

```bash
# Clone from GitHub
cd ~
git clone https://github.com/abhi2varma/webrtc-genesys.git
cd webrtc-genesys
```

### **Step 8.2: Create Namespace**

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl config set-context --current --namespace=webrtc-gateway
```

### **Step 8.3: Create ConfigMaps**

```bash
# Asterisk config
kubectl create configmap asterisk-config \
  --from-file=asterisk/etc/pjsip.conf \
  --from-file=asterisk/etc/extensions.conf \
  --from-file=asterisk/etc/extensions-sip-endpoint.conf \
  --from-file=asterisk/etc/rtp.conf \
  --from-file=asterisk/etc/http.conf \
  --from-file=asterisk/etc/asterisk.conf \
  --from-file=asterisk/etc/logger.conf \
  --from-file=asterisk/etc/manager.conf

# Kamailio config
kubectl create configmap kamailio-config \
  --from-file=kamailio/kamailio.cfg \
  --from-file=kamailio/dispatcher.list

# Nginx config
kubectl create configmap nginx-config \
  --from-file=nginx/nginx.conf

# Nginx HTML
kubectl create configmap nginx-html \
  --from-file=nginx/html/

# Coturn config
kubectl create configmap coturn-config \
  --from-file=coturn/turnserver.conf
```

### **Step 8.4: Create Secrets**

```bash
kubectl create secret generic asterisk-secrets \
  --from-literal=ami-user=admin \
  --from-literal=ami-password=admin123 \
  --from-literal=genesys-username=asterisk \
  --from-literal=genesys-password=yourpassword
```

### **Step 8.5: Build and Push Docker Images**

From your **Windows machine**:

```powershell
# Set your Docker Hub username
$env:DOCKER_HUB_USERNAME = "yourusername"

# Build and push
cd D:\Abhi\WebRTC\webrtc-genesys\kubernetes\scripts
.\push-images.ps1 -RegistryType docker-hub -Version 1.0

# Output will show:
# image: yourusername/webrtc-registration-monitor:1.0
# image: yourusername/webrtc-dashboard-api:1.0
```

### **Step 8.6: Update Kubernetes Manifests**

Edit these files to use your Docker Hub images:

```bash
# On master-1
cd ~/webrtc-genesys

# Update registration-monitor image
sed -i 's|image: webrtc-registration-monitor:latest|image: yourusername/webrtc-registration-monitor:1.0|' \
  kubernetes/deployments/registration-monitor.yaml

# Update dashboard image
sed -i 's|image: webrtc-dashboard-api:latest|image: yourusername/webrtc-dashboard-api:1.0|' \
  kubernetes/deployments/dashboard.yaml
```

### **Step 8.7: Update Kamailio Dispatcher List**

```bash
# Update dispatcher list with worker node IPs
cat > kamailio/dispatcher.list << 'EOF'
# Asterisk pods - use pod DNS names
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

# Update configmap
kubectl delete configmap kamailio-config
kubectl create configmap kamailio-config --from-file=kamailio/
```

### **Step 8.8: Deploy All Services**

```bash
# Deploy in order
kubectl apply -f kubernetes/deployments/redis.yaml
sleep 30

kubectl apply -f kubernetes/deployments/asterisk.yaml
sleep 60

kubectl apply -f kubernetes/deployments/kamailio.yaml
kubectl apply -f kubernetes/deployments/coturn.yaml
kubectl apply -f kubernetes/deployments/nginx.yaml
kubectl apply -f kubernetes/deployments/dashboard.yaml
kubectl apply -f kubernetes/deployments/registration-monitor.yaml

# Apply services
kubectl apply -f kubernetes/services/services.yaml

# Apply ingress
kubectl apply -f kubernetes/ingress/webrtc-ingress.yaml

# Apply HPA
kubectl apply -f kubernetes/hpa/asterisk-hpa.yaml
```

### **Step 8.9: Verify Deployment**

```bash
# Check all pods
kubectl get pods -o wide

# Expected (initial 10 Asterisk pods):
# NAME                          READY   STATUS    NODE
# asterisk-0                    1/1     Running   worker-1
# asterisk-1                    1/1     Running   worker-2
# ...
# asterisk-9                    1/1     Running   worker-10
# redis-0                       1/1     Running   worker-11
# redis-1                       1/1     Running   worker-12
# redis-2                       1/1     Running   worker-13
# kamailio-xxxxx                1/1     Running   worker-14
# kamailio-yyyyy                1/1     Running   worker-15
# nginx-xxxxx                   1/1     Running   worker-16
# dashboard-api-xxxxx           1/1     Running   worker-17
# registration-monitor-xxxxx    1/1     Running   worker-18
# ...

# Check services
kubectl get svc

# Check ingress
kubectl get ingress
```

---

## 🔧 Phase 9: Configure External Access

### **Update DNS:**

```bash
# Point your domain to ingress NodePort or load balancer IP
# If using external LB:
webrtc.yourcompany.com → 192.168.210.100 (LB VIP)

# If using NodePort directly:
webrtc.yourcompany.com → 192.168.210.111:31234 (any worker + NodePort)
```

### **Test Access:**

```bash
# From any machine
curl http://webrtc.yourcompany.com

# Should return WebRTC client HTML

# Test WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://webrtc.yourcompany.com/ws
```

---

## 📊 Phase 10: Enable Monitoring

### **Install Prometheus & Grafana:**

```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus + Grafana stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Wait for pods
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n monitoring --timeout=300s

# Get Grafana password
kubectl get secret -n monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo

# Port forward to access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# Access: http://localhost:3000
# Username: admin
# Password: (from above command)
```

---

## ✅ Verification Checklist

- [ ] All 23 nodes (3 masters + 20 workers) are Ready
- [ ] CNI (Calico) is running on all nodes
- [ ] NFS storage class is available and working
- [ ] Ingress controller is running
- [ ] cert-manager is installed
- [ ] All WebRTC pods are Running (check `kubectl get pods`)
- [ ] Services have ClusterIP assigned
- [ ] Ingress has address assigned
- [ ] Can access WebRTC client via browser
- [ ] Can register SIP extension (5001)
- [ ] Dashboard shows registrations
- [ ] Asterisk pods can reach Genesys SIP server (192.168.210.81)
- [ ] Monitoring stack is running

---

## 🔥 Troubleshooting

### **Node NotReady:**
```bash
# Check kubelet
sudo systemctl status kubelet
sudo journalctl -u kubelet -f

# Check CNI
kubectl get pods -n kube-system | grep calico
```

### **Pod CrashLoopBackOff:**
```bash
# Check logs
kubectl logs <pod-name>
kubectl describe pod <pod-name>

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### **PVC Pending:**
```bash
# Check storage class
kubectl get storageclass

# Check NFS provisioner
kubectl get pods -n kube-system | grep nfs

# Test NFS mount manually
sudo mount -t nfs 192.168.210.101:/nfs/kubernetes /mnt
```

### **Ingress Not Working:**
```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check service
kubectl get svc -n ingress-nginx

# Check ingress resource
kubectl describe ingress webrtc-ingress
```

---

## 🎯 Next Steps

1. ✅ **Cluster is ready** - All nodes joined and healthy
2. ✅ **Storage configured** - NFS provisioner working
3. ✅ **Networking configured** - Calico + Ingress
4. ✅ **Application deployed** - All pods running
5. 📊 **Load test** - Gradually increase to 5000 calls
6. 🔒 **Harden security** - Enable SELinux, configure firewall rules
7. 📦 **Backup strategy** - etcd backups, PV backups
8. 🚨 **Alerting** - Configure Alertmanager

---

## 📚 Additional Resources

- **kubeadm docs:** https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/
- **Calico docs:** https://docs.tigera.io/calico/latest/about
- **NFS provisioner:** https://github.com/kubernetes-sigs/nfs-subdir-external-provisioner
- **NGINX Ingress (bare metal):** https://kubernetes.github.io/ingress-nginx/deploy/#bare-metal-clusters

---

**Total Time:** 4-6 hours (initial setup + deployment)  
**Cluster Size:** 23 nodes (3 masters + 20 workers)  
**Capacity:** 5,000+ concurrent calls  
**Status:** Production Ready! 🚀

---

**Guide Version:** 1.0  
**Last Updated:** December 16, 2025  
**Infrastructure:** On-Premise with kubeadm


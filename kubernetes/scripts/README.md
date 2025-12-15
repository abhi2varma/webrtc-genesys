# Kubernetes Deployment Scripts

Helper scripts for building and pushing Docker images to container registries.

---

## 📦 Available Scripts

### **1. setup-node-kubeadm.sh** (kubeadm Node Preparation)
Prepares CentOS/RHEL nodes for Kubernetes with kubeadm.
- Disables SELinux and swap
- Installs containerd, kubeadm, kubelet, kubectl
- Configures kernel modules and sysctl
- Run on ALL nodes (masters + workers)

### **2. push-images.sh** (Linux/macOS/Git Bash)
Builds and pushes Docker images to your chosen registry.

### **3. push-images.ps1** (PowerShell/Windows)
Same functionality for Windows PowerShell.

---

## 🎯 For On-Premise kubeadm Setup

### **Prepare All Kubernetes Nodes:**

```bash
# Copy script to all nodes (masters + workers)
scp setup-node-kubeadm.sh root@master-1:/root/
scp setup-node-kubeadm.sh root@worker-1:/root/
# ... repeat for all nodes

# SSH to each node and run:
ssh root@master-1
cd /root
chmod +x setup-node-kubeadm.sh
sudo ./setup-node-kubeadm.sh

# Repeat for ALL nodes (3 masters + 20 workers)
```

**Then follow:** `kubernetes/KUBEADM_ONPREMISE_GUIDE.md` for cluster initialization and WebRTC deployment.

---

## 🚀 Quick Start - Docker Images

### **Option 1: Docker Hub** (Free, Public)

**Windows (PowerShell):**
```powershell
# Set your Docker Hub username
$env:DOCKER_HUB_USERNAME = "yourusername"

# Build and push
cd D:\Abhi\WebRTC\webrtc-genesys\kubernetes\scripts
.\push-images.ps1 -RegistryType docker-hub -Version 1.0
```

**Linux/macOS:**
```bash
# Set your Docker Hub username
export DOCKER_HUB_USERNAME=yourusername

# Build and push
cd kubernetes/scripts
chmod +x push-images.sh
./push-images.sh docker-hub
```

**Then update Kubernetes manifests:**
```yaml
# kubernetes/deployments/registration-monitor.yaml
image: yourusername/webrtc-registration-monitor:1.0

# kubernetes/deployments/dashboard.yaml
image: yourusername/webrtc-dashboard-api:1.0
```

---

### **Option 2: AWS ECR** (Private, Recommended for Production)

**Windows (PowerShell):**
```powershell
# Set AWS credentials
$env:AWS_REGION = "us-east-1"
$env:AWS_ACCOUNT_ID = "123456789012"  # Get with: aws sts get-caller-identity

# Build and push
.\push-images.ps1 -RegistryType ecr -Version 1.0
```

**Linux/macOS:**
```bash
# Set AWS credentials
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=123456789012  # Get with: aws sts get-caller-identity --query Account --output text

# Build and push
./push-images.sh ecr
```

**Then update Kubernetes manifests:**
```yaml
# kubernetes/deployments/registration-monitor.yaml
image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-registration-monitor:1.0

# kubernetes/deployments/dashboard.yaml
image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/webrtc-dashboard-api:1.0
```

---

### **Option 3: Google GCR** (Private)

**Windows (PowerShell):**
```powershell
# Set GCP project
$env:GCP_PROJECT_ID = "your-project-id"

# Build and push
.\push-images.ps1 -RegistryType gcr -Version 1.0
```

**Linux/macOS:**
```bash
# Set GCP project
export GCP_PROJECT_ID=your-project-id

# Build and push
./push-images.sh gcr
```

**Then update Kubernetes manifests:**
```yaml
# kubernetes/deployments/registration-monitor.yaml
image: gcr.io/your-project-id/webrtc-registration-monitor:1.0

# kubernetes/deployments/dashboard.yaml
image: gcr.io/your-project-id/webrtc-dashboard-api:1.0
```

---

## 📝 What These Scripts Do

1. **Build Docker images** locally on your machine
2. **Tag images** with version numbers and `latest`
3. **Push images** to your chosen container registry
4. **Display** the image URLs to use in Kubernetes manifests

---

## 🔄 Versioning

Always tag images with versions for easy rollbacks:

```powershell
# Build v1.0
.\push-images.ps1 -Version 1.0

# Later, build v1.1 with bug fixes
.\push-images.ps1 -Version 1.1

# Deploy v1.1 to Kubernetes
kubectl set image deployment/registration-monitor registration-monitor=yourusername/webrtc-registration-monitor:1.1

# Rollback to v1.0 if issues
kubectl set image deployment/registration-monitor registration-monitor=yourusername/webrtc-registration-monitor:1.0
```

---

## 🎯 After Pushing Images

### **1. Update Kubernetes Manifests**

Edit `kubernetes/deployments/registration-monitor.yaml`:
```yaml
spec:
  template:
    spec:
      containers:
      - name: registration-monitor
        image: yourusername/webrtc-registration-monitor:1.0  # Update this
```

Edit `kubernetes/deployments/dashboard.yaml`:
```yaml
spec:
  template:
    spec:
      containers:
      - name: dashboard-api
        image: yourusername/webrtc-dashboard-api:1.0  # Update this
```

### **2. Deploy to Kubernetes**

```bash
# Apply updated manifests
kubectl apply -f kubernetes/deployments/registration-monitor.yaml
kubectl apply -f kubernetes/deployments/dashboard.yaml

# Verify pods are running
kubectl get pods -l app=registration-monitor
kubectl get pods -l app=dashboard-api

# Check images are correct
kubectl describe pod <pod-name> | grep Image:
```

---

## 🔐 Registry Authentication

### **Docker Hub:**
- Public images: No authentication needed in Kubernetes
- Private images: Create `imagePullSecrets`

```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=yourusername \
  --docker-password=yourpassword \
  --docker-email=your@email.com

# Add to deployment
spec:
  template:
    spec:
      imagePullSecrets:
      - name: dockerhub-secret
```

### **AWS ECR:**
Kubernetes automatically authenticates if using EKS with proper IAM roles.

For non-EKS clusters:
```bash
# Create ECR secret
kubectl create secret docker-registry ecr-secret \
  --docker-server=123456789012.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1)
```

### **Google GCR:**
Kubernetes automatically authenticates if using GKE with proper service account.

---

## 📚 Examples

### **Complete Workflow: Build → Push → Deploy**

**1. On your Windows machine:**
```powershell
# Build and push to Docker Hub
$env:DOCKER_HUB_USERNAME = "abhi2varma"
cd D:\Abhi\WebRTC\webrtc-genesys\kubernetes\scripts
.\push-images.ps1 -RegistryType docker-hub -Version 1.0

# Output:
# ✓ Images pushed to Docker Hub
# Update Kubernetes manifests with:
#   image: abhi2varma/webrtc-registration-monitor:1.0
#   image: abhi2varma/webrtc-dashboard-api:1.0
```

**2. Update manifests:**
```powershell
# Edit files
code ..\deployments\registration-monitor.yaml
code ..\deployments\dashboard.yaml

# Change:
#   image: webrtc-registration-monitor:latest
# To:
#   image: abhi2varma/webrtc-registration-monitor:1.0
```

**3. Commit and push to GitHub:**
```powershell
cd D:\Abhi\WebRTC\webrtc-genesys
git add kubernetes/deployments/
git commit -m "Update Kubernetes manifests with Docker Hub images"
git push origin main
```

**4. Deploy to Kubernetes:**
```bash
# On Kubernetes cluster
kubectl apply -f kubernetes/deployments/registration-monitor.yaml
kubectl apply -f kubernetes/deployments/dashboard.yaml

# Wait for deployment
kubectl rollout status deployment/registration-monitor
kubectl rollout status deployment/dashboard-api

# Verify
kubectl get pods
kubectl logs -l app=registration-monitor
```

---

## 🛠️ Troubleshooting

### **Image Pull Error:**
```
Error: ErrImagePull
```

**Solutions:**
1. Verify image exists in registry
2. Check image name is correct (case-sensitive)
3. Add `imagePullSecrets` if private registry
4. Check `imagePullPolicy` (use `Always` or `IfNotPresent`)

### **Login Failed:**
```
Error saving credentials: error storing credentials
```

**Solutions:**
- Windows: Install Docker Credential Helper
- Linux: `sudo apt-get install pass gnupg2`

### **AWS ECR: No Basic Auth Credentials:**
```
Error response from daemon: Get https://123456789012.dkr.ecr.us-east-1.amazonaws.com/v2/: no basic auth credentials
```

**Solution:**
```bash
# Re-login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
```

---

## 📖 Additional Resources

- **Docker Documentation:** https://docs.docker.com/
- **Docker Hub:** https://hub.docker.com/
- **AWS ECR:** https://docs.aws.amazon.com/ecr/
- **Google GCR:** https://cloud.google.com/container-registry/docs
- **Kubernetes Image Pull:** https://kubernetes.io/docs/concepts/containers/images/

---

**Scripts Version:** 1.0  
**Last Updated:** December 16, 2025


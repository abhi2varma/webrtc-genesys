#!/bin/bash
#
# Prepare Node for Kubernetes (kubeadm)
# Run this on ALL nodes (masters and workers)
#
# Usage: sudo ./setup-node-kubeadm.sh
#

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run as root (sudo)"
   exit 1
fi

echo "========================================"
echo "Kubernetes Node Preparation Script"
echo "For kubeadm on CentOS/RHEL 7.9"
echo "========================================"
echo ""

# Get hostname
HOSTNAME=$(hostname)
echo "Setting up node: $HOSTNAME"
echo ""

# Step 1: Disable SELinux
echo "[1/8] Disabling SELinux..."
setenforce 0
sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config
echo "✓ SELinux disabled"
echo ""

# Step 2: Disable Swap
echo "[2/8] Disabling swap..."
swapoff -a
sed -i '/ swap / s/^/#/' /etc/fstab
echo "✓ Swap disabled"
echo ""

# Step 3: Load kernel modules
echo "[3/8] Loading kernel modules..."
cat <<EOF | tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
modprobe overlay
modprobe br_netfilter
echo "✓ Kernel modules loaded"
echo ""

# Step 4: Configure sysctl
echo "[4/8] Configuring sysctl..."
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system > /dev/null 2>&1
echo "✓ Sysctl configured"
echo ""

# Step 5: Install containerd
echo "[5/8] Installing containerd..."
yum install -y yum-utils > /dev/null 2>&1
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo > /dev/null 2>&1
yum install -y containerd.io > /dev/null 2>&1

# Configure containerd
mkdir -p /etc/containerd
containerd config default > /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# Start containerd
systemctl enable containerd > /dev/null 2>&1
systemctl start containerd
echo "✓ containerd installed and started"
echo ""

# Step 6: Install kubeadm, kubelet, kubectl
echo "[6/8] Installing Kubernetes components..."
cat <<EOF | tee /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://pkgs.k8s.io/core:/stable:/v1.28/rpm/
enabled=1
gpgcheck=1
gpgkey=https://pkgs.k8s.io/core:/stable:/v1.28/rpm/repodata/repomd.xml.key
exclude=kubelet kubeadm kubectl cri-tools kubernetes-cni
EOF

yum install -y kubelet kubeadm kubectl --disableexcludes=kubernetes > /dev/null 2>&1

# Enable kubelet
systemctl enable kubelet > /dev/null 2>&1
systemctl start kubelet
echo "✓ Kubernetes components installed"
echo ""

# Step 7: Install NFS client
echo "[7/8] Installing NFS client..."
yum install -y nfs-utils > /dev/null 2>&1
echo "✓ NFS client installed"
echo ""

# Step 8: Configure firewall (optional)
echo "[8/8] Configuring firewall..."
read -p "Do you want to disable firewalld? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl stop firewalld
    systemctl disable firewalld
    echo "✓ Firewalld disabled"
else
    echo "Firewalld not changed (you'll need to open required ports manually)"
fi
echo ""

# Verify
echo "========================================"
echo "Verification"
echo "========================================"
echo ""
echo "Containerd version:"
containerd --version
echo ""
echo "Kubeadm version:"
kubeadm version -o short
echo ""
echo "Kubelet version:"
kubelet --version
echo ""
echo "Kubectl version:"
kubectl version --client --short
echo ""

echo "========================================"
echo "Node preparation complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "If this is a MASTER node:"
echo "  sudo kubeadm init --control-plane-endpoint=\"k8s-api:6443\" \\"
echo "    --upload-certs \\"
echo "    --pod-network-cidr=10.244.0.0/16 \\"
echo "    --apiserver-advertise-address=<THIS_NODE_IP>"
echo ""
echo "If this is a WORKER node:"
echo "  Wait for master to be initialized, then:"
echo "  sudo kubeadm join <master-ip>:6443 --token <token> \\"
echo "    --discovery-token-ca-cert-hash sha256:<hash>"
echo ""
echo "See KUBEADM_ONPREMISE_GUIDE.md for complete instructions"
echo ""


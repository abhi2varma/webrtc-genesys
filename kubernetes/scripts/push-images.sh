#!/bin/bash
#
# Push Docker Images to Container Registry
# Usage: ./push-images.sh [docker-hub|ecr|gcr]
#

set -e

# Configuration
VERSION="${VERSION:-1.0}"
REGISTRY_TYPE="${1:-docker-hub}"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Docker Image Push Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Function to build images
build_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    cd "$(dirname "$0")/../.."
    
    # Build registration monitor
    echo "Building webrtc-registration-monitor:${VERSION}..."
    docker build -t webrtc-registration-monitor:${VERSION} registration-monitor/
    
    # Build dashboard API
    echo "Building webrtc-dashboard-api:${VERSION}..."
    docker build -t webrtc-dashboard-api:${VERSION} dashboard/
    
    echo -e "${GREEN}✓ Images built successfully${NC}"
    echo ""
}

# Docker Hub
push_to_docker_hub() {
    echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
    
    # Check if username is set
    if [ -z "$DOCKER_HUB_USERNAME" ]; then
        echo -e "${RED}Error: DOCKER_HUB_USERNAME not set${NC}"
        echo "Set it with: export DOCKER_HUB_USERNAME=yourusername"
        exit 1
    fi
    
    # Login
    echo "Logging in to Docker Hub..."
    docker login
    
    # Tag images
    echo "Tagging images..."
    docker tag webrtc-registration-monitor:${VERSION} ${DOCKER_HUB_USERNAME}/webrtc-registration-monitor:${VERSION}
    docker tag webrtc-dashboard-api:${VERSION} ${DOCKER_HUB_USERNAME}/webrtc-dashboard-api:${VERSION}
    
    # Tag latest
    docker tag webrtc-registration-monitor:${VERSION} ${DOCKER_HUB_USERNAME}/webrtc-registration-monitor:latest
    docker tag webrtc-dashboard-api:${VERSION} ${DOCKER_HUB_USERNAME}/webrtc-dashboard-api:latest
    
    # Push images
    echo "Pushing images..."
    docker push ${DOCKER_HUB_USERNAME}/webrtc-registration-monitor:${VERSION}
    docker push ${DOCKER_HUB_USERNAME}/webrtc-registration-monitor:latest
    docker push ${DOCKER_HUB_USERNAME}/webrtc-dashboard-api:${VERSION}
    docker push ${DOCKER_HUB_USERNAME}/webrtc-dashboard-api:latest
    
    echo -e "${GREEN}✓ Images pushed to Docker Hub${NC}"
    echo ""
    echo "Update Kubernetes manifests with:"
    echo "  image: ${DOCKER_HUB_USERNAME}/webrtc-registration-monitor:${VERSION}"
    echo "  image: ${DOCKER_HUB_USERNAME}/webrtc-dashboard-api:${VERSION}"
}

# AWS ECR
push_to_ecr() {
    echo -e "${YELLOW}Pushing to AWS ECR...${NC}"
    
    # Check if region and account are set
    if [ -z "$AWS_REGION" ]; then
        echo -e "${RED}Error: AWS_REGION not set${NC}"
        echo "Set it with: export AWS_REGION=us-east-1"
        exit 1
    fi
    
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        echo -e "${RED}Error: AWS_ACCOUNT_ID not set${NC}"
        echo "Get it with: aws sts get-caller-identity --query Account --output text"
        exit 1
    fi
    
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    
    # Login to ECR
    echo "Logging in to ECR..."
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
    
    # Create repositories if they don't exist
    echo "Creating ECR repositories..."
    aws ecr describe-repositories --repository-names webrtc-registration-monitor --region ${AWS_REGION} 2>/dev/null || \
        aws ecr create-repository --repository-name webrtc-registration-monitor --region ${AWS_REGION}
    
    aws ecr describe-repositories --repository-names webrtc-dashboard-api --region ${AWS_REGION} 2>/dev/null || \
        aws ecr create-repository --repository-name webrtc-dashboard-api --region ${AWS_REGION}
    
    # Tag images
    echo "Tagging images..."
    docker tag webrtc-registration-monitor:${VERSION} ${ECR_REGISTRY}/webrtc-registration-monitor:${VERSION}
    docker tag webrtc-dashboard-api:${VERSION} ${ECR_REGISTRY}/webrtc-dashboard-api:${VERSION}
    docker tag webrtc-registration-monitor:${VERSION} ${ECR_REGISTRY}/webrtc-registration-monitor:latest
    docker tag webrtc-dashboard-api:${VERSION} ${ECR_REGISTRY}/webrtc-dashboard-api:latest
    
    # Push images
    echo "Pushing images..."
    docker push ${ECR_REGISTRY}/webrtc-registration-monitor:${VERSION}
    docker push ${ECR_REGISTRY}/webrtc-registration-monitor:latest
    docker push ${ECR_REGISTRY}/webrtc-dashboard-api:${VERSION}
    docker push ${ECR_REGISTRY}/webrtc-dashboard-api:latest
    
    echo -e "${GREEN}✓ Images pushed to AWS ECR${NC}"
    echo ""
    echo "Update Kubernetes manifests with:"
    echo "  image: ${ECR_REGISTRY}/webrtc-registration-monitor:${VERSION}"
    echo "  image: ${ECR_REGISTRY}/webrtc-dashboard-api:${VERSION}"
}

# Google GCR
push_to_gcr() {
    echo -e "${YELLOW}Pushing to Google GCR...${NC}"
    
    # Check if project is set
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo -e "${RED}Error: GCP_PROJECT_ID not set${NC}"
        echo "Set it with: export GCP_PROJECT_ID=your-project-id"
        exit 1
    fi
    
    GCR_REGISTRY="gcr.io/${GCP_PROJECT_ID}"
    
    # Configure docker
    echo "Configuring Docker for GCR..."
    gcloud auth configure-docker
    
    # Tag images
    echo "Tagging images..."
    docker tag webrtc-registration-monitor:${VERSION} ${GCR_REGISTRY}/webrtc-registration-monitor:${VERSION}
    docker tag webrtc-dashboard-api:${VERSION} ${GCR_REGISTRY}/webrtc-dashboard-api:${VERSION}
    docker tag webrtc-registration-monitor:${VERSION} ${GCR_REGISTRY}/webrtc-registration-monitor:latest
    docker tag webrtc-dashboard-api:${VERSION} ${GCR_REGISTRY}/webrtc-dashboard-api:latest
    
    # Push images
    echo "Pushing images..."
    docker push ${GCR_REGISTRY}/webrtc-registration-monitor:${VERSION}
    docker push ${GCR_REGISTRY}/webrtc-registration-monitor:latest
    docker push ${GCR_REGISTRY}/webrtc-dashboard-api:${VERSION}
    docker push ${GCR_REGISTRY}/webrtc-dashboard-api:latest
    
    echo -e "${GREEN}✓ Images pushed to Google GCR${NC}"
    echo ""
    echo "Update Kubernetes manifests with:"
    echo "  image: ${GCR_REGISTRY}/webrtc-registration-monitor:${VERSION}"
    echo "  image: ${GCR_REGISTRY}/webrtc-dashboard-api:${VERSION}"
}

# Main
build_images

case "$REGISTRY_TYPE" in
    docker-hub)
        push_to_docker_hub
        ;;
    ecr)
        push_to_ecr
        ;;
    gcr)
        push_to_gcr
        ;;
    *)
        echo -e "${RED}Unknown registry type: $REGISTRY_TYPE${NC}"
        echo "Usage: $0 [docker-hub|ecr|gcr]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${GREEN}========================================${NC}"


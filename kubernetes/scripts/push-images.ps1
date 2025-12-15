# Push Docker Images to Container Registry
# Usage: .\push-images.ps1 -RegistryType docker-hub -Version 1.0

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('docker-hub', 'ecr', 'gcr')]
    [string]$RegistryType = 'docker-hub',
    
    [Parameter(Mandatory=$false)]
    [string]$Version = '1.0'
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "Docker Image Push Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Build images
function Build-Images {
    Write-Host "Building Docker images..." -ForegroundColor Yellow
    
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $rootPath = Join-Path $scriptPath "..\..\"
    Push-Location $rootPath
    
    # Build registration monitor
    Write-Host "Building webrtc-registration-monitor:$Version..."
    docker build -t webrtc-registration-monitor:$Version registration-monitor/
    
    # Build dashboard API
    Write-Host "Building webrtc-dashboard-api:$Version..."
    docker build -t webrtc-dashboard-api:$Version dashboard/
    
    Pop-Location
    
    Write-Host "✓ Images built successfully" -ForegroundColor Green
    Write-Host ""
}

# Docker Hub
function Push-ToDockerHub {
    Write-Host "Pushing to Docker Hub..." -ForegroundColor Yellow
    
    # Check if username is set
    $dockerHubUsername = $env:DOCKER_HUB_USERNAME
    if ([string]::IsNullOrEmpty($dockerHubUsername)) {
        Write-Host "Error: DOCKER_HUB_USERNAME not set" -ForegroundColor Red
        Write-Host 'Set it with: $env:DOCKER_HUB_USERNAME="yourusername"'
        exit 1
    }
    
    # Login
    Write-Host "Logging in to Docker Hub..."
    docker login
    
    # Tag images
    Write-Host "Tagging images..."
    docker tag webrtc-registration-monitor:$Version ${dockerHubUsername}/webrtc-registration-monitor:$Version
    docker tag webrtc-dashboard-api:$Version ${dockerHubUsername}/webrtc-dashboard-api:$Version
    docker tag webrtc-registration-monitor:$Version ${dockerHubUsername}/webrtc-registration-monitor:latest
    docker tag webrtc-dashboard-api:$Version ${dockerHubUsername}/webrtc-dashboard-api:latest
    
    # Push images
    Write-Host "Pushing images..."
    docker push ${dockerHubUsername}/webrtc-registration-monitor:$Version
    docker push ${dockerHubUsername}/webrtc-registration-monitor:latest
    docker push ${dockerHubUsername}/webrtc-dashboard-api:$Version
    docker push ${dockerHubUsername}/webrtc-dashboard-api:latest
    
    Write-Host "✓ Images pushed to Docker Hub" -ForegroundColor Green
    Write-Host ""
    Write-Host "Update Kubernetes manifests with:"
    Write-Host "  image: ${dockerHubUsername}/webrtc-registration-monitor:$Version"
    Write-Host "  image: ${dockerHubUsername}/webrtc-dashboard-api:$Version"
}

# AWS ECR
function Push-ToECR {
    Write-Host "Pushing to AWS ECR..." -ForegroundColor Yellow
    
    # Check if region and account are set
    $awsRegion = $env:AWS_REGION
    $awsAccountId = $env:AWS_ACCOUNT_ID
    
    if ([string]::IsNullOrEmpty($awsRegion)) {
        Write-Host "Error: AWS_REGION not set" -ForegroundColor Red
        Write-Host 'Set it with: $env:AWS_REGION="us-east-1"'
        exit 1
    }
    
    if ([string]::IsNullOrEmpty($awsAccountId)) {
        Write-Host "Error: AWS_ACCOUNT_ID not set" -ForegroundColor Red
        Write-Host "Get it with: aws sts get-caller-identity --query Account --output text"
        exit 1
    }
    
    $ecrRegistry = "${awsAccountId}.dkr.ecr.${awsRegion}.amazonaws.com"
    
    # Login to ECR
    Write-Host "Logging in to ECR..."
    $loginPassword = aws ecr get-login-password --region $awsRegion
    $loginPassword | docker login --username AWS --password-stdin $ecrRegistry
    
    # Create repositories if they don't exist
    Write-Host "Creating ECR repositories..."
    aws ecr describe-repositories --repository-names webrtc-registration-monitor --region $awsRegion 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name webrtc-registration-monitor --region $awsRegion
    }
    
    aws ecr describe-repositories --repository-names webrtc-dashboard-api --region $awsRegion 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name webrtc-dashboard-api --region $awsRegion
    }
    
    # Tag images
    Write-Host "Tagging images..."
    docker tag webrtc-registration-monitor:$Version ${ecrRegistry}/webrtc-registration-monitor:$Version
    docker tag webrtc-dashboard-api:$Version ${ecrRegistry}/webrtc-dashboard-api:$Version
    docker tag webrtc-registration-monitor:$Version ${ecrRegistry}/webrtc-registration-monitor:latest
    docker tag webrtc-dashboard-api:$Version ${ecrRegistry}/webrtc-dashboard-api:latest
    
    # Push images
    Write-Host "Pushing images..."
    docker push ${ecrRegistry}/webrtc-registration-monitor:$Version
    docker push ${ecrRegistry}/webrtc-registration-monitor:latest
    docker push ${ecrRegistry}/webrtc-dashboard-api:$Version
    docker push ${ecrRegistry}/webrtc-dashboard-api:latest
    
    Write-Host "✓ Images pushed to AWS ECR" -ForegroundColor Green
    Write-Host ""
    Write-Host "Update Kubernetes manifests with:"
    Write-Host "  image: ${ecrRegistry}/webrtc-registration-monitor:$Version"
    Write-Host "  image: ${ecrRegistry}/webrtc-dashboard-api:$Version"
}

# Google GCR
function Push-ToGCR {
    Write-Host "Pushing to Google GCR..." -ForegroundColor Yellow
    
    # Check if project is set
    $gcpProjectId = $env:GCP_PROJECT_ID
    if ([string]::IsNullOrEmpty($gcpProjectId)) {
        Write-Host "Error: GCP_PROJECT_ID not set" -ForegroundColor Red
        Write-Host 'Set it with: $env:GCP_PROJECT_ID="your-project-id"'
        exit 1
    }
    
    $gcrRegistry = "gcr.io/${gcpProjectId}"
    
    # Configure docker
    Write-Host "Configuring Docker for GCR..."
    gcloud auth configure-docker
    
    # Tag images
    Write-Host "Tagging images..."
    docker tag webrtc-registration-monitor:$Version ${gcrRegistry}/webrtc-registration-monitor:$Version
    docker tag webrtc-dashboard-api:$Version ${gcrRegistry}/webrtc-dashboard-api:$Version
    docker tag webrtc-registration-monitor:$Version ${gcrRegistry}/webrtc-registration-monitor:latest
    docker tag webrtc-dashboard-api:$Version ${gcrRegistry}/webrtc-dashboard-api:latest
    
    # Push images
    Write-Host "Pushing images..."
    docker push ${gcrRegistry}/webrtc-registration-monitor:$Version
    docker push ${gcrRegistry}/webrtc-registration-monitor:latest
    docker push ${gcrRegistry}/webrtc-dashboard-api:$Version
    docker push ${gcrRegistry}/webrtc-dashboard-api:latest
    
    Write-Host "✓ Images pushed to Google GCR" -ForegroundColor Green
    Write-Host ""
    Write-Host "Update Kubernetes manifests with:"
    Write-Host "  image: ${gcrRegistry}/webrtc-registration-monitor:$Version"
    Write-Host "  image: ${gcrRegistry}/webrtc-dashboard-api:$Version"
}

# Main
Build-Images

switch ($RegistryType) {
    'docker-hub' { Push-ToDockerHub }
    'ecr' { Push-ToECR }
    'gcr' { Push-ToGCR }
    default {
        Write-Host "Unknown registry type: $RegistryType" -ForegroundColor Red
        Write-Host "Usage: .\push-images.ps1 -RegistryType [docker-hub|ecr|gcr] -Version 1.0"
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green


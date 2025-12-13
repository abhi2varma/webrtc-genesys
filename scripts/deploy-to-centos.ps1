# PowerShell Script to Deploy WebRTC System to CentOS
# Run this script from your Windows machine

param(
    [string]$CentOSIP,
    [string]$CentOSUser,
    [string]$SkipTransfer = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Header {
    param([string]$Message)
    Write-Host "======================================" -ForegroundColor Green
    Write-Host "  $Message" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host ">>> $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Err {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "! $Message" -ForegroundColor Yellow
}

Write-Header "CentOS Deployment Script for WebRTC System"

# Collect deployment information
Write-Host ""
Write-Warning "Please provide the following information:"
Write-Host ""

if ([string]::IsNullOrEmpty($CentOSIP)) {
    $script:CentOSIP = Read-Host "CentOS Server IP"
}

if ([string]::IsNullOrEmpty($CentOSUser)) {
    $script:CentOSUser = Read-Host "CentOS Username"
}

$Domain = Read-Host "Domain name (or IP)"
$PublicIP = Read-Host "Public IP address"
$PrivateIP = Read-Host "Private IP address [$PublicIP]"
if ([string]::IsNullOrEmpty($PrivateIP)) {
    $PrivateIP = $PublicIP
}

Write-Host ""
$GenesysHost = Read-Host "Genesys SIP Host"
$GenesysPort = Read-Host "Genesys SIP Port [5060]"
if ([string]::IsNullOrEmpty($GenesysPort)) {
    $GenesysPort = "5060"
}
$GenesysUser = Read-Host "Genesys Username"
$GenesysPass = Read-Host "Genesys Password" -AsSecureString
$GenesysPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($GenesysPass)
)

# Generate TURN secret
$TURNSecret = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$TURNDomain = $Domain

Write-Host ""

# Step 2: Test SSH connection
Write-Step "Testing SSH connection to CentOS server..."

# Check if OpenSSH is available
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Err "SSH command not found. Please install OpenSSH or use Git Bash."
    exit 1
}

# Test connection
try {
    ssh -o ConnectTimeout=5 -o BatchMode=yes "${CentOSUser}@${CentOSIP}" "exit" 2>$null
    Write-Success "SSH connection successful"
} catch {
    Write-Err "Cannot connect to CentOS server"
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "1. Ensure SSH is enabled on CentOS"
    Write-Host "2. Check firewall allows port 22"
    Write-Host "3. Verify username and IP are correct"
    Write-Host ""
    $continue = Read-Host "Do you want to continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Step 3: Transfer files (if not skipped)
if (-not $SkipTransfer) {
    Write-Step "Transferring files to CentOS server..."
    
    # Get current directory
    $ProjectRoot = $PSScriptRoot | Split-Path -Parent
    
    # Create .env file content safely (avoid here-string parsing issues)
    $envLines = @(
        "# Domain Configuration",
        "DOMAIN=$Domain",
        "PUBLIC_IP=$PublicIP",
        "PRIVATE_IP=$PrivateIP",
        "",
        "# Genesys SIP Configuration",
        "GENESYS_SIP_HOST=$GenesysHost",
        "GENESYS_SIP_PORT=$GenesysPort",
        "GENESYS_USERNAME=$GenesysUser",
        "GENESYS_PASSWORD=$GenesysPassPlain",
        "",
        "# TURN Server Configuration",
        "TURN_SECRET=$TURNSecret",
        "TURN_REALM=$TURNDomain",
        "",
        "# Asterisk Configuration",
        "ASTERISK_HTTP_PORT=8088",
        "ASTERISK_HTTPS_PORT=8089",
        "",
        "# Docker Configuration",
        "COMPOSE_PROJECT_NAME=webrtc",
        "",
        "# Security",
        "ADMIN_USER=admin"
    )
    $envContent = $envLines -join "`n"

    # Create temporary file with .env
    $envFilePath = Join-Path -Path $env:TEMP -ChildPath 'webrtc.env'
    $envContent | Out-File -FilePath $envFilePath -Encoding utf8 -Force
    
    # Transfer files using scp
    Write-Host "Copying files to CentOS..."
    
    # Create remote directory
    ssh "${CentOSUser}@${CentOSIP}" "mkdir -p ~/webrtc"
    
    # Use rsync if available, otherwise scp
    if (Get-Command rsync -ErrorAction SilentlyContinue) {
        rsync -avz --exclude='.git' --exclude='node_modules' --exclude='*.log' "${ProjectRoot}/" "${CentOSUser}@${CentOSIP}:~/webrtc/"
    } else {
        # Use SCP (slower but works)
        scp -r "${ProjectRoot}" "${CentOSUser}@${CentOSIP}:~/"
        ssh "${CentOSUser}@${CentOSIP}" "mv ~/webrtc-genesys ~/webrtc"
    }
    
    # Copy .env file
    scp "$envFilePath" "${CentOSUser}@${CentOSIP}:~/webrtc/.env"
    Remove-Item $envFilePath -Force
    
    Write-Success "Files transferred"
} else {
    Write-Warning "Skipping file transfer (use -SkipTransfer:$false to transfer files)"
}

# Step 4: Run setup on CentOS
Write-Step "Running setup on CentOS server..."

$setupScript = @"
#!/bin/bash
set -e

cd ~/webrtc

# Make scripts executable
chmod +x scripts/*.sh

# Run CentOS setup
echo ">>> Running CentOS system setup..."
sudo ./scripts/centos-setup.sh

# Generate self-signed certificates
echo ">>> Generating SSL certificates..."
DOMAIN="$Domain" ./scripts/generate-certs.sh development

# Update configuration files
echo ">>> Updating configuration files..."

# Update Asterisk pjsip.conf
sed -i "s/YOUR_PUBLIC_IP_HERE/$PublicIP/g" asterisk/etc/pjsip.conf
sed -i "s/GENESYS_SIP_HOST/$GenesysHost/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_USERNAME/$GenesysUser/g" asterisk/etc/pjsip.conf
sed -i "s/YOUR_GENESYS_PASSWORD/$GenesysPassPlain/g" asterisk/etc/pjsip.conf

# Update Nginx configuration
sed -i "s/your-domain.com/$Domain/g" nginx/nginx.conf

# Update TURN server configuration
sed -i "s/YOUR_PUBLIC_IP_HERE/$PublicIP/g" coturn/turnserver.conf
sed -i "s/your-domain.com/$Domain/g" coturn/turnserver.conf
sed -i "s/your-turn-secret-key/$TURNSecret/g" coturn/turnserver.conf

# Update Kamailio configuration (if exists)
if [ -f kamailio/kamailio.cfg ]; then
    sed -i "s/YOUR_PUBLIC_IP_HERE/$PublicIP/g" kamailio/kamailio.cfg
    sed -i "s/your-domain.com/$Domain/g" kamailio/kamailio.cfg
fi

echo "✓ Configuration files updated"

# Start services
echo ">>> Starting Docker containers..."
docker-compose up -d

# Wait for services to start
sleep 10

# Check status
echo ">>> Service status:"
docker-compose ps

echo "✓ Deployment completed on CentOS server"
"@

# Write script to remote and execute
$tempScript = Join-Path -Path $env:TEMP -ChildPath 'deploy-remote.sh'
$setupScript | Out-File -FilePath $tempScript -Encoding utf8 -NoNewline -Force
scp "$tempScript" "${CentOSUser}@${CentOSIP}:~/webrtc/deploy-remote.sh"
ssh "${CentOSUser}@${CentOSIP}" "chmod +x ~/webrtc/deploy-remote.sh; ~/webrtc/deploy-remote.sh"
Remove-Item $tempScript -Force -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
    Write-Success "Deployment completed successfully!"
} else {
    Write-Err "Deployment failed"
    exit 1
}

# Summary
Write-Host ""
Write-Header "Deployment Summary"

Write-Host "✅ Files transferred to CentOS"
Write-Host "✅ System setup completed"
Write-Host "✅ SSL certificates generated"
Write-Host "✅ Configuration files updated"
Write-Host "✅ Services started"
Write-Host ""
Write-Host "📋 Access Information:"
Write-Host ""
Write-Host "  WebRTC Client URL:"
Write-Host "    https://$Domain"
Write-Host "    or"
Write-Host "    https://$CentOSIP"
Write-Host ""
Write-Host "  WebSocket URL:"
Write-Host "    wss://$Domain/ws"
Write-Host ""
Write-Host "  Test Credentials:"
Write-Host "    Username: 1000"
Write-Host "    Password: webrtc1000pass"
Write-Host ""
Write-Host "📞 SSH to CentOS:"
Write-Host "    ssh $CentOSUser@$CentOSIP"
Write-Host ""
Write-Host "🔍 Useful Commands:"
Write-Host ""
Write-Host "    # View logs"
Write-Host "    ssh $CentOSUser@$CentOSIP 'cd ~/webrtc && docker-compose logs -f'"
Write-Host ""
Write-Host "    # Check service status"
Write-Host "    ssh $CentOSUser@$CentOSIP 'cd ~/webrtc && docker-compose ps'"
Write-Host ""
Write-Host "    # Restart services"
Write-Host "    ssh $CentOSUser@$CentOSIP 'cd ~/webrtc && docker-compose restart'"
Write-Host ""
Write-Host "    # Access Asterisk CLI"
Write-Host "    ssh $CentOSUser@$CentOSIP 'docker exec -it webrtc-asterisk asterisk -r'"
Write-Host ""

Write-Warning "Next Steps:"
Write-Host ""
Write-Host "1. Access the WebRTC client at https://$Domain"
Write-Host "2. Register as user 1000 with password webrtc1000pass"
Write-Host "3. Test echo by dialing 600"
Write-Host "4. Test internal call by calling 1001 from another browser"
Write-Host "5. Test Genesys integration by making external call"
Write-Host "6. Review and update default passwords"
Write-Host "7. Configure your DIDs in asterisk/etc/extensions.conf"
Write-Host "8. Set up monitoring and backups"
Write-Host ""

Write-Success "Deployment completed!"
Write-Host ""


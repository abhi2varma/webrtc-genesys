# Simple PowerShell Deployment Script for WebRTC to CentOS

param(
    [string]$ServerUser = "abhishek",
    [string]$ServerHost = "localhost",
    [int]$ServerPort = 22
)

$RemoteDir = "/home/$ServerUser/WebRTC"

Write-Host "======================================"  -ForegroundColor Green
Write-Host " WebRTC Deployment to CentOS"  -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Server: $ServerUser@$ServerHost (port $ServerPort)" -ForegroundColor Yellow
Write-Host "Remote Directory: $RemoteDir" -ForegroundColor Yellow
Write-Host ""

$response = Read-Host "Continue? (y/n)"
if ($response -ne "y") { exit }

Write-Host ""
Write-Host "[1/8] Testing SSH connection..." -ForegroundColor Cyan
ssh -p $ServerPort "$ServerUser@$ServerHost" "echo 'SSH OK'"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: SSH connection failed!" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: SSH connected" -ForegroundColor Green

Write-Host ""
Write-Host "[2/8] Creating remote directory..." -ForegroundColor Cyan
ssh -p $ServerPort "$ServerUser@$ServerHost" "mkdir -p $RemoteDir"
Write-Host "SUCCESS: Directory created" -ForegroundColor Green

Write-Host ""
Write-Host "[3/8] Transferring files (this may take a few minutes)..." -ForegroundColor Cyan
scp -r -P $ServerPort -o "StrictHostKeyChecking=no" * "$ServerUser@$ServerHost`:$RemoteDir/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Some files may not have transferred" -ForegroundColor Yellow
}
Write-Host "SUCCESS: Files transferred" -ForegroundColor Green

Write-Host ""
Write-Host "[4/8] Setting permissions..." -ForegroundColor Cyan
ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; chmod +x scripts/*.sh"
Write-Host "SUCCESS: Permissions set" -ForegroundColor Green

Write-Host ""
Write-Host "[5/8] Installing Docker and dependencies..." -ForegroundColor Cyan
$installResponse = Read-Host "Run CentOS setup script? (y/n)"
if ($installResponse -eq "y") {
    Write-Host "Installing Docker, configuring firewall..." -ForegroundColor Yellow
    ssh -t -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sudo ./scripts/centos-setup.sh"
    Write-Host "SUCCESS: CentOS setup completed" -ForegroundColor Green
} else {
    Write-Host "SKIPPED: You'll need to run this manually later" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[6/8] Configuration" -ForegroundColor Cyan
$configResponse = Read-Host "Configure system now? (y/n)"
if ($configResponse -eq "y") {
    $domain = Read-Host "Domain name (or localhost)"
    $publicIP = Read-Host "Public IP address"
    $genesysHost = Read-Host "Genesys SIP Host"
    $genesysUser = Read-Host "Genesys Username"
    $genesysPass = Read-Host "Genesys Password" -AsSecureString
    $passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($genesysPass))
    
    # Create env content
    $envContent = @"
DOMAIN=$domain
PUBLIC_IP=$publicIP
PRIVATE_IP=$publicIP
GENESYS_SIP_HOST=$genesysHost
GENESYS_USERNAME=$genesysUser
GENESYS_PASSWORD=$passPlain
TURN_SECRET=$(Get-Random -Count 16 | ForEach-Object {'{0:X2}' -f $_} | Join-String)
"@
    
    # Save locally
    $localEnv = "temp-env-file.txt"
    $envContent | Out-File -FilePath $localEnv -Encoding ASCII
    
    # Transfer
    scp -P $ServerPort $localEnv "$ServerUser@$ServerHost`:$RemoteDir/.env"
    Remove-Item $localEnv
    
    # Update config files
    Write-Host "Updating configuration files..." -ForegroundColor Yellow
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sed -i 's/YOUR_PUBLIC_IP_HERE/$publicIP/g' asterisk/etc/pjsip.conf"
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sed -i 's/GENESYS_SIP_HOST/$genesysHost/g' asterisk/etc/pjsip.conf"
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sed -i 's/YOUR_GENESYS_USERNAME/$genesysUser/g' asterisk/etc/pjsip.conf"
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sed -i 's/YOUR_GENESYS_PASSWORD/$passPlain/g' asterisk/etc/pjsip.conf"
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sed -i 's/YOUR_PUBLIC_IP_HERE/$publicIP/g' kamailio/kamailio.cfg"
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sed -i 's/your-domain.com/$domain/g' kamailio/kamailio.cfg nginx/nginx.conf nginx/html/index.html"
    
    Write-Host "SUCCESS: Configuration updated" -ForegroundColor Green
} else {
    Write-Host "SKIPPED: Manual configuration required" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[7/8] SSL Certificates" -ForegroundColor Cyan
$certResponse = Read-Host "Generate SSL certificates? (1=self-signed, 2=Let's Encrypt, n=skip)"
if ($certResponse -eq "1") {
    ssh -t -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; ./scripts/generate-certs.sh development"
    Write-Host "SUCCESS: Self-signed certificates generated" -ForegroundColor Green
} elseif ($certResponse -eq "2") {
    ssh -t -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; sudo ./scripts/generate-certs.sh production"
    Write-Host "SUCCESS: Let's Encrypt certificates generated" -ForegroundColor Green
}

Write-Host ""
Write-Host "[8/8] Starting Services" -ForegroundColor Cyan
$startResponse = Read-Host "Start Docker services? (y/n)"
if ($startResponse -eq "y") {
    ssh -t -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; docker-compose up -d"
    Write-Host "Waiting for services..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    ssh -p $ServerPort "$ServerUser@$ServerHost" "cd $RemoteDir `; docker-compose ps"
    Write-Host "SUCCESS: Services started" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access your system at: https://$domain" -ForegroundColor Cyan
Write-Host "WebSocket URL: wss://$domain/ws" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default login:" -ForegroundColor Yellow
Write-Host "  Username: 1000" -ForegroundColor Yellow
Write-Host "  Password: webrtc1000pass" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test extensions:" -ForegroundColor Yellow
Write-Host "  600 = Echo test" -ForegroundColor Yellow
Write-Host "  601 = Music on hold" -ForegroundColor Yellow
Write-Host "  700 = Conference" -ForegroundColor Yellow
Write-Host ""
Write-Host "SSH to server: ssh -p $ServerPort $ServerUser@$ServerHost" -ForegroundColor Cyan
Write-Host ""





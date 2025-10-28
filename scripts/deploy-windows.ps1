# PowerShell Deployment Script for Windows
# Deploy WebRTC system to remote CentOS server

param(
    [string]$ServerUser = "user",
    [string]$ServerHost = "localhost",
    [int]$ServerPort = 22,
    [string]$RemoteDir = "/home/user/WebRTC"
)

Write-Host "======================================" -ForegroundColor Green
Write-Host "  Remote WebRTC Deployment" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

Write-Host "Deployment Configuration:" -ForegroundColor Yellow
Write-Host "  Server: ${ServerUser}@${ServerHost}:${ServerPort}"
Write-Host "  Remote Directory: $RemoteDir"
Write-Host ""

$continue = Read-Host "Continue with deployment? (y/n)"
if ($continue -ne "y") {
    exit
}

# Check if pscp (PuTTY SCP) is available
$pscpAvailable = Get-Command pscp -ErrorAction SilentlyContinue

if (-not $pscpAvailable) {
    Write-Host "PSCP not found. Using SCP via ssh.exe (requires OpenSSH)" -ForegroundColor Yellow
    
    # Check if ssh is available
    $sshAvailable = Get-Command ssh -ErrorAction SilentlyContinue
    if (-not $sshAvailable) {
        Write-Host "ERROR: Neither pscp nor ssh found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install one of the following:" -ForegroundColor Yellow
        Write-Host "1. OpenSSH Client (Windows 10/11): Settings > Apps > Optional Features > OpenSSH Client"
        Write-Host "2. PuTTY (includes pscp): https://www.putty.org/"
        Write-Host "3. Use Git Bash or WSL instead"
        exit
    }
}

Write-Host ""
Write-Host "Step 1: Testing SSH connection..." -ForegroundColor Green

try {
    $testConnection = ssh -p $ServerPort "$ServerUser@$ServerHost" "echo 'SSH connection successful'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ SSH connection successful" -ForegroundColor Green
    } else {
        throw "SSH connection failed"
    }
} catch {
    Write-Host "✗ SSH connection failed" -ForegroundColor Red
    Write-Host "Please check your credentials and ensure SSH is working" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Step 2: Creating remote directory..." -ForegroundColor Green
ssh -p $ServerPort "$ServerUser@$ServerHost" "mkdir -p $RemoteDir"
Write-Host "✓ Remote directory created" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Transferring files..." -ForegroundColor Green
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

# Create a temporary exclude list
$excludeList = @(
    ".git",
    "certs",
    "asterisk/logs",
    "asterisk/sounds",
    "asterisk/keys",
    "backups",
    "mysql-data",
    ".env"
)

# Use scp to transfer files
Write-Host "Transferring project files..." -ForegroundColor Yellow

if ($pscpAvailable) {
    # Using pscp
    pscp -r -P $ServerPort -batch "$PWD\*" "${ServerUser}@${ServerHost}:${RemoteDir}/"
} else {
    # Using scp
    scp -r -P $ServerPort "$PWD\*" "${ServerUser}@${ServerHost}:${RemoteDir}/"
}

Write-Host "✓ Files transferred" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Setting up permissions..." -ForegroundColor Green
ssh -p $ServerPort "${ServerUser}@${ServerHost}" "cd $RemoteDir; chmod +x scripts/*.sh"
Write-Host "✓ Permissions set" -ForegroundColor Green

Write-Host ""
Write-Host "Step 5: Running CentOS setup..." -ForegroundColor Green
Write-Host "This will install Docker, configure firewall, etc." -ForegroundColor Yellow
Write-Host ""

$runSetup = Read-Host "Run automated setup on server? (y/n)"
if ($runSetup -eq "y") {
    ssh -t -p $ServerPort "${ServerUser}@${ServerHost}" "cd $RemoteDir; sudo ./scripts/centos-setup.sh"
    Write-Host "✓ CentOS setup completed" -ForegroundColor Green
} else {
    Write-Host "! Skipped automated setup" -ForegroundColor Yellow
    Write-Host "You can run it manually later:" -ForegroundColor Yellow
    Write-Host "  ssh -p $ServerPort ${ServerUser}@${ServerHost}"
    Write-Host "  cd $RemoteDir"
    Write-Host "  sudo ./scripts/centos-setup.sh"
}

Write-Host ""
Write-Host "Step 6: Configuration" -ForegroundColor Green
Write-Host ""

$configure = Read-Host "Do you want to configure the system now? (y/n)"
if ($configure -eq "y") {
    Write-Host ""
    Write-Host "Enter your configuration:" -ForegroundColor Yellow
    $domain = Read-Host "Domain name (or localhost for testing)"
    $publicIP = Read-Host "Public IP address"
    $genesysHost = Read-Host "Genesys SIP Host"
    $genesysUser = Read-Host "Genesys Username"
    $genesysPass = Read-Host "Genesys Password" -AsSecureString
    
    # Convert secure string to plain text for transmission
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($genesysPass)
    $genesysPassPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    # Generate TURN secret
    $turnSecret = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    
    # Create .env file content
    $envContent = @"
DOMAIN=$domain
PUBLIC_IP=$publicIP
PRIVATE_IP=$publicIP
ASTERISK_SIP_PORT=5060
ASTERISK_PJSIP_PORT=5061
ASTERISK_WSS_PORT=8089
ASTERISK_HTTP_PORT=8088
ASTERISK_RTP_START=10000
ASTERISK_RTP_END=20000
KAMAILIO_SIP_PORT=5060
KAMAILIO_SIPS_PORT=5061
KAMAILIO_WS_PORT=8080
KAMAILIO_WSS_PORT=4443
TURN_PORT=3478
TURN_TLS_PORT=5349
TURN_REALM=$domain
TURN_SECRET=$turnSecret
GENESYS_SIP_HOST=$genesysHost
GENESYS_SIP_PORT=5060
GENESYS_USERNAME=$genesysUser
GENESYS_PASSWORD=$genesysPassPlain
GENESYS_CONTEXT=genesys-context
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=kamailio
MYSQL_USER=kamailio
MYSQL_PASSWORD=kamailiopass
"@
    
    # Save to temp file and transfer
    $tempFile = Join-Path $env:TEMP "webrtc.env"
    $envContent | Out-File -FilePath $tempFile -Encoding ASCII -NoNewline
    
    # Transfer .env file
    if ($pscpAvailable) {
        pscp -P $ServerPort $tempFile "${ServerUser}@${ServerHost}:${RemoteDir}/.env"
    } else {
        scp -P $ServerPort $tempFile "${ServerUser}@${ServerHost}:${RemoteDir}/.env"
    }
    
    Remove-Item $tempFile
    
    # Update configuration files on server
    $updateScript = @"
cd $RemoteDir
sed -i 's/YOUR_PUBLIC_IP_HERE/$publicIP/g' asterisk/etc/pjsip.conf
sed -i 's/GENESYS_SIP_HOST/$genesysHost/g' asterisk/etc/pjsip.conf
sed -i 's/YOUR_GENESYS_USERNAME/$genesysUser/g' asterisk/etc/pjsip.conf
sed -i 's/YOUR_GENESYS_PASSWORD/$genesysPassPlain/g' asterisk/etc/pjsip.conf
sed -i 's/YOUR_PUBLIC_IP_HERE/$publicIP/g' kamailio/kamailio.cfg
sed -i 's/your-domain.com/$domain/g' kamailio/kamailio.cfg
sed -i 's/your-domain.com/$domain/g' nginx/nginx.conf
sed -i 's/your-domain.com/$domain/g' nginx/html/index.html
sed -i 's/YOUR_PUBLIC_IP_HERE/$publicIP/g' coturn/turnserver.conf
sed -i 's/your-domain.com/$domain/g' coturn/turnserver.conf
"@
    ssh -p $ServerPort "${ServerUser}@${ServerHost}" $updateScript
    
    Write-Host "CheckMark Configuration updated" -ForegroundColor Green
} else {
    Write-Host "! Configuration skipped" -ForegroundColor Yellow
    Write-Host "You need to configure manually before starting services" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 7: SSL Certificates" -ForegroundColor Green
Write-Host ""

$generateCerts = Read-Host "Generate SSL certificates? (y/n)"
if ($generateCerts -eq "y") {
    Write-Host "1) Self-signed (testing)"
    Write-Host "2) Let's Encrypt (production)"
    $certChoice = Read-Host "Choose [1-2]"
    
    if ($certChoice -eq "1") {
        ssh -t -p $ServerPort "${ServerUser}@${ServerHost}" "cd $RemoteDir; ./scripts/generate-certs.sh development"
    } else {
        ssh -t -p $ServerPort "${ServerUser}@${ServerHost}" "cd $RemoteDir; sudo ./scripts/generate-certs.sh production"
    }
    
    Write-Host "CheckMark Certificates generated" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 8: Start Services" -ForegroundColor Green
Write-Host ""

$startServices = Read-Host "Start Docker services now? (y/n)"
if ($startServices -eq "y") {
    ssh -t -p $ServerPort "${ServerUser}@${ServerHost}" "cd $RemoteDir; docker-compose up -d"
    
    Write-Host ""
    Write-Host "Waiting for services to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    Write-Host ""
    Write-Host "Service Status:" -ForegroundColor Green
    ssh -p $ServerPort "${ServerUser}@${ServerHost}" "cd $RemoteDir; docker-compose ps"
    
    Write-Host "CheckMark Services started" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

Write-Host "Access your system:" -ForegroundColor Yellow
Write-Host "  Web Client: https://$domain (or https://$publicIP)"
Write-Host "  WebSocket: wss://$domain/ws"
Write-Host ""

Write-Host "SSH to server:" -ForegroundColor Yellow
Write-Host "  ssh -p $ServerPort ${ServerUser}@${ServerHost}"
Write-Host ""

Write-Host "Useful commands (run on server):" -ForegroundColor Yellow
Write-Host "  cd $RemoteDir"
Write-Host "  docker-compose ps              # Check status"
Write-Host "  docker-compose logs -f         # View logs"
Write-Host "  ./scripts/monitor.sh           # Monitor system"
Write-Host ""

Write-Host "Default WebRTC credentials:" -ForegroundColor Cyan
Write-Host "  Username: 1000"
Write-Host "  Password: webrtc1000pass"
Write-Host ""

Write-Host "Test extensions:" -ForegroundColor Cyan
Write-Host "  600 - Echo test"
Write-Host "  601 - Music on hold"
Write-Host "  700 - Conference room"
Write-Host ""

Write-Host "Happy calling!" -ForegroundColor Green
Write-Host ""


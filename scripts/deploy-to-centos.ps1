# WebRTC Genesys Deployment Script for CentOS
# Deploys from Windows to CentOS server at 192.168.210.54

param(
    [string]$ServerIP = "192.168.210.54",
    [int]$Port = 69,
    [string]$Username = "Gencct",
    [string]$RemotePath = "/opt/gcti_apps/webrtc-genesys"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WebRTC Genesys Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Server: $Username@$ServerIP`:$Port" -ForegroundColor Yellow
Write-Host "Remote Path: $RemotePath" -ForegroundColor Yellow
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "ERROR: Please run this script from the project root directory!" -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Creating remote directories..." -ForegroundColor Green

# Create directory structure on remote server
$directories = @(
    "$RemotePath",
    "$RemotePath/asterisk",
    "$RemotePath/asterisk/etc",
    "$RemotePath/asterisk/sounds",
    "$RemotePath/asterisk/keys",
    "$RemotePath/asterisk/logs",
    "$RemotePath/nginx",
    "$RemotePath/nginx/html",
    "$RemotePath/coturn",
    "$RemotePath/certs",
    "$RemotePath/scripts"
)

foreach ($dir in $directories) {
    Write-Host "  Creating: $dir" -ForegroundColor Gray
    ssh -p $Port "$Username@$ServerIP" "mkdir -p $dir"
}

Write-Host "  ✓ Directories created" -ForegroundColor Green
Write-Host ""

# Copy Asterisk configuration files
Write-Host "[2/5] Copying Asterisk configuration files..." -ForegroundColor Green
$asteriskFiles = @(
    "asterisk/etc/pjsip.conf",
    "asterisk/etc/logger.conf",
    "asterisk/etc/asterisk.conf",
    "asterisk/etc/extensions-sip-endpoint.conf",
    "asterisk/etc/http.conf",
    "asterisk/etc/rtp.conf"
)

foreach ($file in $asteriskFiles) {
    if (Test-Path $file) {
        Write-Host "  Copying: $file" -ForegroundColor Gray
        scp -P $Port $file "$Username@$ServerIP`:$RemotePath/$file"
    } else {
        Write-Host "  Skipping: $file (not found)" -ForegroundColor Yellow
    }
}
Write-Host "  ✓ Asterisk files copied" -ForegroundColor Green
Write-Host ""

# Copy Nginx files
Write-Host "[3/5] Copying Nginx files..." -ForegroundColor Green
$nginxFiles = @(
    "nginx/nginx.conf",
    "nginx/html/index.html",
    "nginx/html/app.js",
    "nginx/html/style.css",
    "nginx/html/jssip.min.js"
)

foreach ($file in $nginxFiles) {
    if (Test-Path $file) {
        Write-Host "  Copying: $file" -ForegroundColor Gray
        scp -P $Port $file "$Username@$ServerIP`:$RemotePath/$file"
    } else {
        Write-Host "  Skipping: $file (not found)" -ForegroundColor Yellow
    }
}
Write-Host "  ✓ Nginx files copied" -ForegroundColor Green
Write-Host ""

# Copy certificates
Write-Host "[4/5] Copying SSL certificates..." -ForegroundColor Green
if (Test-Path "certs/*.pem") {
    Write-Host "  Copying certificate files..." -ForegroundColor Gray
    scp -P $Port certs/*.pem "$Username@$ServerIP`:$RemotePath/certs/"
    Write-Host "  ✓ Certificates copied" -ForegroundColor Green
} else {
    Write-Host "  ! No certificates found, will generate on server" -ForegroundColor Yellow
}
Write-Host ""

# Copy Docker and other files
Write-Host "[5/5] Copying Docker and documentation files..." -ForegroundColor Green
$otherFiles = @(
    "docker-compose.yml",
    "TEST_DN_REGISTRATION.md",
    "GENESYS_GWS_INTEGRATION.md",
    "README.md"
)

foreach ($file in $otherFiles) {
    if (Test-Path $file) {
        Write-Host "  Copying: $file" -ForegroundColor Gray
        scp -P $Port $file "$Username@$ServerIP`:$RemotePath/$file"
    } else {
        Write-Host "  Skipping: $file (not found)" -ForegroundColor Yellow
    }
}
Write-Host "  ✓ Files copied" -ForegroundColor Green
Write-Host ""

# Generate certificates on server if needed
Write-Host "[OPTIONAL] Generating SSL certificates on server..." -ForegroundColor Cyan
$certScript = "cd $RemotePath && if [ ! -f certs/cert.pem ]; then echo '  Generating self-signed certificates...' && docker run --rm -v `$(pwd)/certs:/certs alpine/openssl req -x509 -newkey rsa:2048 -keyout /certs/key.pem -out /certs/cert.pem -days 365 -nodes -subj '/CN=192.168.210.54' && cp certs/cert.pem certs/ca.pem && echo '  ✓ Certificates generated'; else echo '  ✓ Certificates already exist'; fi"
ssh -p $Port "$Username@$ServerIP" $certScript
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ All files copied to $ServerIP`:$RemotePath" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. SSH to server:" -ForegroundColor White
Write-Host "   ssh -p $Port $Username@$ServerIP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Navigate to project:" -ForegroundColor White
Write-Host "   cd $RemotePath" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start services:" -ForegroundColor White
Write-Host "   docker-compose down" -ForegroundColor Gray
Write-Host "   docker-compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Check status:" -ForegroundColor White
Write-Host "   docker-compose ps" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test WebRTC client:" -ForegroundColor White
Write-Host "   http://$ServerIP/" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Ask if user wants to restart services automatically
Write-Host ""
$restart = Read-Host "Do you want to restart services on the server now? (y/n)"

if ($restart -eq "y" -or $restart -eq "Y") {
    Write-Host ""
    Write-Host "Restarting services on server..." -ForegroundColor Green
    
    $restartScript = "cd $RemotePath && echo 'Stopping services...' && docker-compose down && echo 'Starting services...' && docker-compose up -d && echo '' && echo 'Service Status:' && docker-compose ps"
    ssh -p $Port "$Username@$ServerIP" $restartScript
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✓ Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "WebRTC Client: http://$ServerIP/" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deployment files copied. Please restart services manually." -ForegroundColor Yellow
    Write-Host ""
}

# Simple Deployment Script - No SSH, just SCP
# Copy files to CentOS server

$ServerIP = "192.168.210.54"
$Port = 69
$Username = "Gencct"
$RemotePath = "/opt/gcti_apps/webrtc-genesys"

Write-Host "Deploying to $Username@$ServerIP..." -ForegroundColor Cyan

# Create directories first (manual step)
Write-Host "`nStep 1: Creating directories on server..." -ForegroundColor Yellow
$createDirs = "mkdir -p $RemotePath/asterisk/etc $RemotePath/nginx/html $RemotePath/certs"
ssh -p $Port "$Username@$ServerIP" $createDirs

# Copy files
Write-Host "`nStep 2: Copying files..." -ForegroundColor Yellow

Write-Host "  Copying docker-compose.yml..."
scp -P $Port docker-compose.yml "$Username@$ServerIP`:$RemotePath/"

Write-Host "  Copying Asterisk config..."
scp -P $Port asterisk/etc/pjsip.conf "$Username@$ServerIP`:$RemotePath/asterisk/etc/"
scp -P $Port asterisk/etc/logger.conf "$Username@$ServerIP`:$RemotePath/asterisk/etc/"
scp -P $Port asterisk/etc/asterisk.conf "$Username@$ServerIP`:$RemotePath/asterisk/etc/"
scp -P $Port asterisk/etc/extensions-sip-endpoint.conf "$Username@$ServerIP`:$RemotePath/asterisk/etc/"

Write-Host "  Copying Nginx config..."
scp -P $Port nginx/nginx.conf "$Username@$ServerIP`:$RemotePath/nginx/"
scp -P $Port nginx/html/index.html "$Username@$ServerIP`:$RemotePath/nginx/html/"
scp -P $Port nginx/html/jssip.min.js "$Username@$ServerIP`:$RemotePath/nginx/html/"
scp -P $Port nginx/html/app.js "$Username@$ServerIP`:$RemotePath/nginx/html/"
scp -P $Port nginx/html/style.css "$Username@$ServerIP`:$RemotePath/nginx/html/"

Write-Host "  Copying certificates..."
if (Test-Path "certs\cert.pem") {
    scp -P $Port certs/*.pem "$Username@$ServerIP`:$RemotePath/certs/"
}

Write-Host "`n✓ Files copied successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. SSH to server: ssh -p $Port $Username@$ServerIP"
Write-Host "2. cd $RemotePath"
Write-Host "3. docker-compose down"
Write-Host "4. docker-compose up -d"
Write-Host ""


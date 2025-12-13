# SSL Certificate Generation Script for Windows
# Usage: .\generate-certs.ps1 [domain]

param(
    [string]$Domain = "localhost"
)

$CERT_DIR = ".\certs"

Write-Host "======================================" -ForegroundColor Green
Write-Host "  SSL Certificate Generator" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Create certs directory
if (-not (Test-Path $CERT_DIR)) {
    New-Item -ItemType Directory -Path $CERT_DIR | Out-Null
    Write-Host "Created certificates directory: $CERT_DIR" -ForegroundColor Yellow
}

Write-Host "Generating self-signed certificate for: $Domain" -ForegroundColor Yellow
Write-Host ""

# Check if OpenSSL is available
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "OpenSSL not found. Checking for alternative methods..." -ForegroundColor Yellow
    
    # Try using PowerShell's New-SelfSignedCertificate
    Write-Host "Using PowerShell's New-SelfSignedCertificate..." -ForegroundColor Yellow
    
    $cert = New-SelfSignedCertificate `
        -DnsName $Domain, "localhost", "127.0.0.1" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -NotAfter (Get-Date).AddYears(1) `
        -FriendlyName "WebRTC Self-Signed Certificate"
    
    # Export certificate and key
    $certPath = "Cert:\CurrentUser\My\$($cert.Thumbprint)"
    
    # Export certificate (PEM format)
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certPem = "-----BEGIN CERTIFICATE-----`n"
    $certPem += [Convert]::ToBase64String($certBytes) -replace '.{64}', '$0`n'
    $certPem += "`n-----END CERTIFICATE-----"
    [System.IO.File]::WriteAllText("$CERT_DIR\cert.pem", $certPem)
    
    # Export private key (requires additional steps - for now, we'll use OpenSSL method)
    Write-Host "Certificate created, but private key export requires OpenSSL." -ForegroundColor Yellow
    Write-Host "Please install OpenSSL or use the bash script on Linux/WSL." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For now, you can use OpenSSL from Git Bash or WSL:" -ForegroundColor Yellow
    Write-Host "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj '/CN=$Domain'" -ForegroundColor Cyan
    
    # Copy cert as CA
    Copy-Item "$CERT_DIR\cert.pem" "$CERT_DIR\ca.pem"
    
    Write-Host ""
    Write-Host "Certificate exported to: $CERT_DIR\cert.pem" -ForegroundColor Green
    Write-Host "CA chain copied to: $CERT_DIR\ca.pem" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: You still need to export the private key!" -ForegroundColor Red
    Write-Host "Run this command in Git Bash or WSL:" -ForegroundColor Yellow
    Write-Host "  openssl pkcs12 -in cert.pem -nocerts -nodes -out key.pem" -ForegroundColor Cyan
    Write-Host "  (You'll need to export the cert as PKCS12 first)" -ForegroundColor Yellow
    
} else {
    # Use OpenSSL
    Write-Host "Using OpenSSL..." -ForegroundColor Green
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout "$CERT_DIR\key.pem" `
        -out "$CERT_DIR\cert.pem" `
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$Domain" `
        2>&1 | Out-Null
    
    # Copy cert as CA
    Copy-Item "$CERT_DIR\cert.pem" "$CERT_DIR\ca.pem"
    
    Write-Host ""
    Write-Host "Self-signed certificates generated successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Certificate files:" -ForegroundColor Green
Write-Host "  - cert.pem (Certificate)" -ForegroundColor White
Write-Host "  - key.pem (Private Key)" -ForegroundColor White
Write-Host "  - ca.pem (CA Chain)" -ForegroundColor White
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Self-signed certificates" -ForegroundColor Yellow
Write-Host "- Browsers will show security warnings" -ForegroundColor White
Write-Host "- You'll need to manually accept the certificate" -ForegroundColor White
Write-Host "- Use only for development/testing" -ForegroundColor White
Write-Host ""


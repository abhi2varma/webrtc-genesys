# ============================================
# Setup VPN Routing for Docker Containers
# ============================================
# This script configures Windows to route Docker traffic to VPN networks

Write-Host "Setting up VPN routing for Docker..." -ForegroundColor Cyan

# Get Docker network gateway
$dockerGateway = docker network inspect webrtc-genesys_default -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
$dockerSubnet = docker network inspect webrtc-genesys_default -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}'

Write-Host "Docker Network: $dockerSubnet" -ForegroundColor Yellow
Write-Host "Docker Gateway: $dockerGateway" -ForegroundColor Yellow

# VPN settings
$vpnIP = "10.81.192.4"
$genesysNetwork = "192.168.210.0"
$genesysNetmask = "255.255.255.0"

Write-Host ""
Write-Host "VPN IP: $vpnIP" -ForegroundColor Yellow
Write-Host "Genesys Network: $genesysNetwork/$genesysNetmask" -ForegroundColor Yellow

# Check if route already exists
$existingRoute = Get-NetRoute -DestinationPrefix "192.168.210.0/24" -ErrorAction SilentlyContinue

if ($existingRoute) {
    Write-Host ""
    Write-Host "Route already exists, removing old route..." -ForegroundColor Yellow
    Remove-NetRoute -DestinationPrefix "192.168.210.0/24" -Confirm:$false -ErrorAction SilentlyContinue
}

# Get VPN interface index
$vpnInterface = Get-NetIPAddress -IPAddress $vpnIP -ErrorAction SilentlyContinue

if (-not $vpnInterface) {
    Write-Host ""
    Write-Host "ERROR: VPN interface with IP $vpnIP not found!" -ForegroundColor Red
    Write-Host "Please make sure you're connected to the VPN." -ForegroundColor Red
    Write-Host ""
    Write-Host "Available network interfaces:" -ForegroundColor Yellow
    Get-NetIPAddress -AddressFamily IPv4 | Format-Table -Property IPAddress, InterfaceAlias, InterfaceIndex
    exit 1
}

$vpnInterfaceIndex = $vpnInterface.InterfaceIndex
Write-Host ""
Write-Host "VPN Interface: $($vpnInterface.InterfaceAlias) (Index: $vpnInterfaceIndex)" -ForegroundColor Green

# Add route for Genesys network through VPN interface
Write-Host ""
Write-Host "Adding route for Genesys network through VPN..." -ForegroundColor Cyan
try {
    New-NetRoute -DestinationPrefix "192.168.210.0/24" -InterfaceIndex $vpnInterfaceIndex -PolicyStore ActiveStore -ErrorAction Stop
    Write-Host "Route added successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to add route: $_" -ForegroundColor Red
    exit 1
}

# Enable IP forwarding on Windows
Write-Host ""
Write-Host "Enabling IP forwarding..." -ForegroundColor Cyan
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "IPEnableRouter" -Value 1 -ErrorAction SilentlyContinue

# Add firewall rules to allow Docker to VPN traffic
Write-Host ""
Write-Host "Configuring firewall rules..." -ForegroundColor Cyan

# Remove old rules if they exist
Remove-NetFirewallRule -DisplayName "Docker to VPN - Outbound" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Docker to VPN - Inbound" -ErrorAction SilentlyContinue

# Add new rules
New-NetFirewallRule -DisplayName "Docker to VPN - Outbound" -Direction Outbound -Action Allow -RemoteAddress "192.168.210.0/24" -LocalAddress $dockerSubnet -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "Docker to VPN - Inbound" -Direction Inbound -Action Allow -RemoteAddress "192.168.210.0/24" -LocalAddress $dockerSubnet -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "VPN routing setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Route table:" -ForegroundColor Cyan
Get-NetRoute -DestinationPrefix "192.168.210.0/24" | Format-Table -Property DestinationPrefix, NextHop, InterfaceAlias, RouteMetric

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

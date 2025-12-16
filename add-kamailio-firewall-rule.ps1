# Run this script as Administrator
# Right-click and select "Run with PowerShell"

Write-Host "Adding Windows Firewall rule for Genesys -> Kamailio traffic..." -ForegroundColor Cyan

try {
    # Allow incoming UDP traffic from Genesys network to Kamailio port 5070
    New-NetFirewallRule -DisplayName "Allow Genesys SIP to Kamailio" `
        -Direction Inbound `
        -Action Allow `
        -LocalPort 5070 `
        -Protocol UDP `
        -RemoteAddress 192.168.210.0/24 `
        -Profile Any `
        -Group "Docker to VPN Access" `
        -ErrorAction Stop
    
    Write-Host "✅ Firewall rule added successfully!" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*already exists*" -or $_.Exception.Message -like "*duplicate*") {
        Write-Host "⚠️  Firewall rule already exists. Checking..." -ForegroundColor Yellow
        $existingRule = Get-NetFirewallRule -DisplayName "Allow Genesys SIP to Kamailio" -ErrorAction SilentlyContinue
        if ($existingRule) {
            Write-Host "✅ Firewall rule is present:" -ForegroundColor Green
            $existingRule | Format-List DisplayName, Enabled, Direction, Action
        }
    } else {
        Write-Host "❌ Error adding firewall rule: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")




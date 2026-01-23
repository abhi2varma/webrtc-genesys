# Clean All Logs - WebRTC Genesys Project
# This script removes all log files from the project

$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Cleaning All Logs - WebRTC Genesys Project" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Function to clean a directory
function Clean-Directory {
    param(
        [string]$Path,
        [string]$Description
    )
    
    $FullPath = Join-Path $ProjectRoot $Path
    
    if (Test-Path $FullPath) {
        Write-Host "🧹 Cleaning $Description ($Path)..." -ForegroundColor Yellow
        Get-ChildItem -Path $FullPath -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        Write-Host "   ✅ Cleaned" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Directory not found: $Path" -ForegroundColor Gray
    }
}

# Asterisk logs
Clean-Directory "asterisk\logs" "Asterisk logs"

# Coturn logs
Clean-Directory "coturn\logs" "Coturn logs"

# Nginx logs
Clean-Directory "nginx\logs" "Nginx logs"

# Kamailio logs
Clean-Directory "kamailio\logs" "Kamailio logs"

# Registration Monitor logs
Clean-Directory "registration-monitor\logs" "Registration Monitor logs"

# Dashboard API logs
Clean-Directory "dashboard\logs" "Dashboard API logs"

# Signaling Server logs
Clean-Directory "signaling-server\logs" "Signaling Server logs"

# Redis logs (if any)
Clean-Directory "redis\logs" "Redis logs"

# Redis data (optional - uncomment if you want to clean Redis data too)
# Clean-Directory "redis\data" "Redis data"

# Docker container logs (remove stopped containers)
Write-Host ""
Write-Host "🧹 Cleaning Docker container logs..." -ForegroundColor Yellow
try {
    docker system prune -f --volumes 2>$null | Out-Null
    Write-Host "   ✅ Cleaned" -ForegroundColor Green
}
catch {
    Write-Host "   ⚠️  Docker cleanup skipped (not available)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ✅ All logs cleaned successfully!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Logs will be recreated when services start." -ForegroundColor Gray
Write-Host ""

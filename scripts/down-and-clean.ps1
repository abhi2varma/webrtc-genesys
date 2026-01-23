# Docker Compose Down with Log Cleanup (PowerShell)
# This script stops all containers and cleans all logs

$ProjectRoot = Split-Path -Parent $PSScriptRoot

Set-Location $ProjectRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Stopping Docker Services & Cleaning Logs" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Stop all services
Write-Host "🛑 Stopping Docker services..." -ForegroundColor Yellow
docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Services stopped" -ForegroundColor Green
}
else {
    Write-Host "   ❌ Failed to stop services" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Clean all logs
Write-Host "🧹 Cleaning all logs..." -ForegroundColor Yellow
& "$PSScriptRoot\clean-logs.ps1"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ✅ All done!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start services again:" -ForegroundColor Gray
Write-Host "  docker-compose up -d" -ForegroundColor Gray
Write-Host ""

# Test RTP Media Ports (10000-20000)
# Tests if UDP RTP ports are accessible

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing RTP Media Ports" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ServerIP = "103.167.180.166"
$TestPorts = @(10000, 12000, 15000, 18000, 20000)  # Sample ports from the range

Write-Host "Testing sample ports from RTP range (10000-20000)..." -ForegroundColor Yellow
Write-Host ""

$results = @()
foreach ($port in $TestPorts) {
    Write-Host "Testing port $port..." -NoNewline
    $test = Test-NetConnection -ComputerName $ServerIP -Port $port -WarningAction SilentlyContinue
    if ($test.TcpTestSucceeded) {
        Write-Host " ✅ OPEN" -ForegroundColor Green
        $results += $true
    } else {
        Write-Host " ❌ CLOSED" -ForegroundColor Red
        $results += $false
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$openPorts = ($results | Where-Object { $_ -eq $true }).Count
$totalPorts = $results.Count

Write-Host "Ports tested: $totalPorts" -ForegroundColor White
Write-Host "Ports open: $openPorts" -ForegroundColor White
Write-Host ""

if ($openPorts -eq $totalPorts) {
    Write-Host "✅ All tested RTP ports are accessible!" -ForegroundColor Green
    Write-Host "   Router port forwarding appears to be working." -ForegroundColor Green
} elseif ($openPorts -gt 0) {
    Write-Host "⚠️  Some RTP ports are accessible, some are not." -ForegroundColor Yellow
    Write-Host "   Check your router's port forwarding configuration." -ForegroundColor Yellow
} else {
    Write-Host "❌ NO RTP ports are accessible!" -ForegroundColor Red
    Write-Host "   Configure port forwarding on your router:" -ForegroundColor Red
    Write-Host "   Forward UDP ports 10000-20000 to 192.168.210.54" -ForegroundColor Red
}

Write-Host ""
Write-Host "NOTE: This test only checks TCP connectivity." -ForegroundColor Yellow
Write-Host "RTP uses UDP, which cannot be easily tested from Windows." -ForegroundColor Yellow
Write-Host "The best test is to make an actual call and check if audio works!" -ForegroundColor Cyan

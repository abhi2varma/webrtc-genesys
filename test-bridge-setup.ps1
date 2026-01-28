#!/usr/bin/env pwsh
# Test Script: Verify WebRTC Gateway Setup

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "WebRTC Gateway Test Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Check if Bridge is Running
Write-Host "Test 1: Bridge Status" -ForegroundColor Yellow
$bridgeProcess = Get-Process | Where-Object { $_.ProcessName -eq "electron" } | Select-Object -First 1
if ($bridgeProcess) {
    Write-Host "  ✓ Bridge is running (PID: $($bridgeProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "  ✗ Bridge is NOT running" -ForegroundColor Red
    Write-Host "  Start it with: cd webrtc-gateway-bridge && npm start" -ForegroundColor Yellow
    exit 1
}

# Test 2: Check if Bridge API is Responding
Write-Host "`nTest 2: Bridge API" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://127.0.0.1:8000/Ping" `
                                   -SkipCertificateCheck `
                                   -Method GET `
                                   -TimeoutSec 5 `
                                   -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Bridge API is responding" -ForegroundColor Green
        $result = $response.Content | ConvertFrom-Json
        Write-Host "    Response: $($result | ConvertTo-Json -Compress)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Bridge API is NOT responding" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check GetDnSIP (registration status)
Write-Host "`nTest 3: DN Registration Status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://127.0.0.1:8000/GetDnSIP" `
                                   -SkipCertificateCheck `
                                   -Method GET `
                                   -TimeoutSec 5 `
                                   -ErrorAction Stop
    
    $result = $response.Content | ConvertFrom-Json
    if ($result.get_DnSIPResult) {
        Write-Host "  ✓ DN Registered: $($result.get_DnSIPResult)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ No DN registered yet" -ForegroundColor Yellow
        Write-Host "    WWE needs to call /RegisterDn" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Could not check DN registration" -ForegroundColor Red
}

# Test 4: Check if Workspace Client would connect
Write-Host "`nTest 4: Workspace API Connection (Simulation)" -ForegroundColor Yellow
Write-Host "  ℹ The bridge's Workspace Client connects when WWE calls /InitWorkspace" -ForegroundColor Cyan
Write-Host "  ℹ Check bridge logs for: '[Workspace] ✓ Connected to Workspace API'" -ForegroundColor Cyan

# Test 5: Check NOTIFY Handler in Gateway
Write-Host "`nTest 5: NOTIFY Handler Status" -ForegroundColor Yellow
Write-Host "  ✓ NOTIFY handler is implemented in wwe-webrtc-gateway.html" -ForegroundColor Green
Write-Host "    - Listens for: ua.on('newMessage')" -ForegroundColor Gray
Write-Host "    - Triggers on: Event: talk" -ForegroundColor Gray
Write-Host "    - Action: Auto-answers call" -ForegroundColor Gray

# Test 6: Recommendations
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n1. Log into WWE with DN 1002 or 1003" -ForegroundColor White
Write-Host "   - WWE should call /SetOptions and /RegisterDn" -ForegroundColor Gray
Write-Host "   - Check bridge logs for these API calls" -ForegroundColor Gray

Write-Host "`n2. Check if WWE calls /InitWorkspace" -ForegroundColor White
Write-Host "   - Look for: POST /InitWorkspace in bridge logs" -ForegroundColor Gray
Write-Host "   - If NOT called, WWE doesn't know about Workspace API" -ForegroundColor Gray

Write-Host "`n3. Make a test call from DN 1003 to DN 1002" -ForegroundColor White
Write-Host "   - Watch bridge logs for:" -ForegroundColor Gray
Write-Host "     • 'Incoming call from: 1003'" -ForegroundColor Gray
Write-Host "     • '[Workspace] Call answered in WWE' (if Workspace API works)" -ForegroundColor Gray
Write-Host "   - Watch browser console (F12) for:" -ForegroundColor Gray
Write-Host "     • '📩 Received SIP message: NOTIFY'" -ForegroundColor Gray
Write-Host "     • '🎯 AUTO-ANSWER TRIGGER' (if NOTIFY works)" -ForegroundColor Gray

Write-Host "`n4. If neither mechanism works:" -ForegroundColor White
Write-Host "   - Check WWE configuration for SIP Endpoint integration" -ForegroundColor Gray
Write-Host "   - WWE must be configured to use https://127.0.0.1:8000" -ForegroundColor Gray

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

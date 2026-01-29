# Test TURN Server Connectivity
# Tests if UDP port 3478 is accessible for TURN relay

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing TURN Server Port Forwarding" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ServerIP = "103.167.180.166"
$TurnPort = 3478
$TurnTlsPort = 5349

# Test 1: TCP connectivity to TURN port (basic test)
Write-Host "Test 1: Testing TCP connectivity to port $TurnPort..." -ForegroundColor Yellow
$tcpTest = Test-NetConnection -ComputerName $ServerIP -Port $TurnPort -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) {
    Write-Host "✅ TCP connection to port $TurnPort succeeded" -ForegroundColor Green
} else {
    Write-Host "❌ TCP connection to port $TurnPort FAILED" -ForegroundColor Red
}
Write-Host ""

# Test 2: TCP connectivity to TURN TLS port
Write-Host "Test 2: Testing TCP connectivity to port $TurnTlsPort..." -ForegroundColor Yellow
$tcpTlsTest = Test-NetConnection -ComputerName $ServerIP -Port $TurnTlsPort -WarningAction SilentlyContinue
if ($tcpTlsTest.TcpTestSucceeded) {
    Write-Host "✅ TCP connection to port $TurnTlsPort succeeded" -ForegroundColor Green
} else {
    Write-Host "❌ TCP connection to port $TurnTlsPort FAILED" -ForegroundColor Red
}
Write-Host ""

# Test 3: Check if coturn is listening (on server)
Write-Host "Test 3: Use this command ON THE SERVER to check if coturn is running:" -ForegroundColor Yellow
Write-Host "  docker exec webrtc-coturn ss -ulnp | grep 3478" -ForegroundColor Cyan
Write-Host ""

# Test 4: Real TURN test using WebRTC
Write-Host "Test 4: For UDP TURN test, use this online tool:" -ForegroundColor Yellow
Write-Host "  https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Enter your TURN server details:" -ForegroundColor White
Write-Host "  TURN URL: turn:$ServerIP:3478" -ForegroundColor White
Write-Host "  Username: webrtc" -ForegroundColor White
Write-Host "  Password: Genesys2024!SecureTurn" -ForegroundColor White
Write-Host ""
Write-Host "  Click 'Gather candidates' and look for 'relay' candidates" -ForegroundColor White
Write-Host "  If you see 'relay' candidates, UDP 3478 is working!" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
if ($tcpTest.TcpTestSucceeded -and $tcpTlsTest.TcpTestSucceeded) {
    Write-Host "✅ TCP ports are accessible (good start!)" -ForegroundColor Green
    Write-Host "⚠️  UDP 3478 MUST also be forwarded for TURN to work" -ForegroundColor Yellow
} else {
    Write-Host "❌ TCP ports are NOT accessible" -ForegroundColor Red
    Write-Host "   Configure port forwarding on your router first!" -ForegroundColor Red
}

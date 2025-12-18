#!/bin/bash
# Script to capture detailed Asterisk call logs during a test call

LOGFILE="asterisk/logs/testcall1_$(date +%Y%m%d_%H%M%S).log"

echo "========================================"
echo "Asterisk Call Log Capture"
echo "========================================"
echo "Log will be saved to: $LOGFILE"
echo ""
echo "Steps:"
echo "1. Enabling full debugging in Asterisk..."
echo "2. Start making your test call from browser"
echo "3. Press Ctrl+C when call is complete"
echo ""

# Create logs directory if it doesn't exist
mkdir -p asterisk/logs

# Start capturing logs with full debugging
{
    echo "========================================"
    echo "CALL LOG CAPTURE START"
    echo "Time: $(date)"
    echo "========================================"
    echo ""
    
    # Enable debugging via CLI commands
    sudo docker exec webrtc-asterisk asterisk -rx "core set verbose 10"
    sudo docker exec webrtc-asterisk asterisk -rx "core set debug 5"
    sudo docker exec webrtc-asterisk asterisk -rx "pjsip set logger on"
    sudo docker exec webrtc-asterisk asterisk -rx "rtp set debug on"
    
    echo "✓ Debugging enabled"
    echo ""
    echo "READY FOR TEST CALL - Make your call now..."
    echo "Press Ctrl+C when finished"
    echo ""
    echo "========================================"
    echo "LIVE CALL LOGS:"
    echo "========================================"
    echo ""
    
} | tee "$LOGFILE"

# Capture live logs
sudo docker logs -f webrtc-asterisk 2>&1 | tee -a "$LOGFILE"

# This will run when user presses Ctrl+C
cleanup() {
    echo "" | tee -a "$LOGFILE"
    echo "========================================"  | tee -a "$LOGFILE"
    echo "Stopping log capture..."  | tee -a "$LOGFILE"
    echo "========================================"  | tee -a "$LOGFILE"
    
    # Disable debugging
    sudo docker exec webrtc-asterisk asterisk -rx "pjsip set logger off"
    sudo docker exec webrtc-asterisk asterisk -rx "rtp set debug off"
    sudo docker exec webrtc-asterisk asterisk -rx "core set verbose 3"
    sudo docker exec webrtc-asterisk asterisk -rx "core set debug 0"
    
    echo "✓ Debugging disabled"  | tee -a "$LOGFILE"
    echo ""  | tee -a "$LOGFILE"
    echo "========================================"  | tee -a "$LOGFILE"
    echo "CALL STATISTICS"  | tee -a "$LOGFILE"
    echo "========================================"  | tee -a "$LOGFILE"
    sudo docker exec webrtc-asterisk asterisk -rx "core show channels" | tee -a "$LOGFILE"
    
    echo ""  | tee -a "$LOGFILE"
    echo "========================================"  | tee -a "$LOGFILE"
    echo "Log saved to: $LOGFILE"  | tee -a "$LOGFILE"
    echo "========================================"  | tee -a "$LOGFILE"
    
    exit 0
}

trap cleanup INT


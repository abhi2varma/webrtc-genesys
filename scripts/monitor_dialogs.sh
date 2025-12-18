#!/bin/bash

echo "========================================="
echo "Kamailio Live Dialog Monitor"
echo "Press Ctrl+C to stop"
echo "========================================="
echo ""

while true; do
  clear
  echo "========================================="
  echo "Kamailio Live Dialog Monitor"
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================="
  echo ""
  
  # Active count
  ACTIVE=$(sudo docker exec webrtc-kamailio kamcmd dlg.stats_active 2>/dev/null)
  echo "Active Dialogs: $ACTIVE"
  echo ""
  
  # Brief summary
  echo "Summary:"
  sudo docker exec webrtc-kamailio kamcmd dlg.briefing 2>/dev/null
  echo ""
  
  # If active dialogs, show details
  if [ "$ACTIVE" != "0" ]; then
    echo "Dialog Details:"
    echo "----------------------------------------"
    sudo docker exec webrtc-kamailio kamcmd dlg.list 2>/dev/null | grep -E "(from_uri|to_uri|state|duration)" | head -10
    echo ""
  fi
  
  echo "Press Ctrl+C to stop"
  sleep 2
done


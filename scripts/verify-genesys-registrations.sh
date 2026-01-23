#!/bin/bash
# Verification script for Genesys registrations

echo "========================================"
echo "Genesys Registration Verification"
echo "========================================"
echo ""

echo "1. Checking PJSIP Outbound Registrations:"
echo "----------------------------------------"
sudo docker-compose exec asterisk asterisk -rx "pjsip show registrations"
echo ""

echo "2. Checking Asterisk Endpoints (DNs 1002, 1003):"
echo "------------------------------------------------"
sudo docker-compose exec asterisk asterisk -rx "pjsip show endpoints" | grep -E "(1002|1003)"
echo ""

echo "3. Checking Asterisk AORs (Address of Record):"
echo "----------------------------------------------"
sudo docker-compose exec asterisk asterisk -rx "pjsip show aors" | grep -E "(1002|1003)"
echo ""

echo "4. Checking Registration Monitor Status:"
echo "----------------------------------------"
sudo docker-compose ps registration-monitor
echo ""

echo "5. Recent Registration Monitor Logs:"
echo "-----------------------------------"
sudo docker-compose logs --tail=20 registration-monitor
echo ""

echo "6. Recent Asterisk REGISTER Messages:"
echo "------------------------------------"
sudo docker-compose logs asterisk 2>&1 | grep -i "register" | tail -20
echo ""

echo "========================================"
echo "Verification Complete"
echo "========================================"
echo ""
echo "✅ Expected Results:"
echo "  - PJSIP registrations show 'Registered' for genesys_reg_1002 and genesys_reg_1003"
echo "  - Endpoints show DNs 1002 and 1003 as configured"
echo "  - AORs show contact addresses for DNs 1002 and 1003"
echo "  - Registration monitor is 'Up' and showing registration events"
echo "  - Asterisk logs show 200 OK responses from Genesys (192.168.210.81)"
echo ""

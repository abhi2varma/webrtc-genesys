# Asterisk CLI Call Tuning & Monitoring Guide

## Quick Access to Asterisk CLI

```bash
# Interactive CLI
sudo docker exec -it webrtc-asterisk asterisk -rvvv

# Single command execution
sudo docker exec webrtc-asterisk asterisk -rx "COMMAND"
```

## Real-Time Call Monitoring

### 1. View Active Calls/Channels

```bash
# Show all active channels
core show channels

# Verbose view with details
core show channels verbose

# Continuous monitoring (refresh every 2 seconds)
# Inside Asterisk CLI: watch core show channels
```

### 2. Monitor Specific Call Details

```bash
# Show PJSIP channels with endpoints
pjsip show channels

# Show detailed channel information
core show channel PJSIP/5001-00000000

# Show all channel variables for a call
core show channelvars PJSIP/5001-00000000
```

### 3. Real-Time SIP Message Debugging

```bash
# Enable PJSIP packet logging (see all SIP messages)
pjsip set logger on

# Set debug level for specific endpoint
pjsip set logger endpoint 5001

# Turn off when done
pjsip set logger off
```

### 4. RTP/Media Stream Monitoring

```bash
# Show RTP statistics for active calls
rtp show stats

# Show codec negotiation
core show translation

# Show codec usage on specific channel
core show channel PJSIP/5001-00000000 | grep codec
```

### 5. Quality Monitoring

```bash
# Show RTP quality statistics
rtp show stats

# Example output shows:
# - Packet loss
# - Jitter
# - Round-trip time (RTT)
```

## Debugging Commands

### Enable Debug Logging

```bash
# Inside Asterisk CLI:
core set verbose 5
core set debug 5

# For PJSIP specific debugging
pjsip set logger on

# For RTP debugging
rtp set debug on
```

### Monitor Dialplan Execution

```bash
# Watch dialplan execution in real-time
dialplan show genesys-agent

# See which context a call is using
core show hints
```

### Check Endpoint Status

```bash
# Show all PJSIP endpoints
pjsip show endpoints

# Show specific endpoint details
pjsip show endpoint 5001

# Show authentication status
pjsip show auths
```

## Live Call Testing Commands

### While a Call is Active

```bash
# 1. Connect to CLI
sudo docker exec -it webrtc-asterisk asterisk -rvvv

# 2. Enable debugging
pjsip set logger on
rtp set debug on

# 3. Make your test call from browser

# 4. Monitor in real-time
core show channels verbose
rtp show stats

# 5. Check specific channel
core show channel PJSIP/5001-XXXXXXXX
```

## Useful One-Liners (From Server Shell)

```bash
# Watch active calls (updates every 2 seconds)
watch -n 2 'sudo docker exec webrtc-asterisk asterisk -rx "core show channels"'

# Monitor PJSIP endpoints
watch -n 2 'sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"'

# Follow Asterisk logs in real-time
sudo docker logs -f webrtc-asterisk

# Grep for specific extension in logs
sudo docker logs -f webrtc-asterisk 2>&1 | grep -E "5001|5002|1003"
```

## Checking Call Quality Issues

### If Audio is One-Way or Missing

```bash
# Check NAT/RTP settings
pjsip show endpoint 5001

# Look for:
# - direct_media: no (should be disabled for WebRTC)
# - rtp_symmetric: yes
# - force_rport: yes
# - rewrite_contact: yes

# Check if RTP is flowing
rtp show stats
```

### If Calls Drop or Don't Connect

```bash
# Check registration
pjsip show registrations

# Check if endpoint is reachable
pjsip show endpoint 5001

# Check INVITE/SIP messages
pjsip set logger on
# Then make call
```

### Check Codec Issues

```bash
# Show allowed codecs for endpoint
pjsip show endpoint 5001 | grep codec

# Show active codec on call
core show channel PJSIP/5001-XXXXXXXX | grep codec

# Show codec translation paths
core show translation recalc
```

## Performance Monitoring

```bash
# System resource usage
core show sysinfo

# Task processor statistics
core show taskprocessors

# Thread usage
core show threads
```

## Call Traces for Troubleshooting

### Capture Complete Call Flow

```bash
# In Asterisk CLI, enable full debugging before call:
core set verbose 10
core set debug 10
pjsip set logger on
rtp set debug on

# Make the call

# After call, save logs:
# Exit CLI (Ctrl+C)
sudo docker logs webrtc-asterisk --tail 500 > call-debug-$(date +%Y%m%d-%H%M%S).log
```

## Quick Diagnostics Checklist

```bash
# Run these to get full picture:
sudo docker exec webrtc-asterisk asterisk -rx "pjsip show endpoints"
sudo docker exec webrtc-asterisk asterisk -rx "core show channels"
sudo docker exec webrtc-asterisk asterisk -rx "rtp show stats"
sudo docker exec webrtc-asterisk asterisk -rx "core show hints"
```

## Common Issues & CLI Checks

| Issue | CLI Command |
|-------|-------------|
| Call not connecting | `pjsip set logger on` then watch SIP messages |
| One-way audio | `rtp show stats` - check packet counts |
| Echo or audio quality | `core show channel X` - check codecs |
| Call drops | `core show channels` - check call state |
| Registration fails | `pjsip show registrations` |
| Wrong routing | `dialplan show genesys-agent` |

## Tips

1. **Always enable PJSIP logger** when debugging calls - it shows the actual SIP INVITE/BYE messages
2. **Use `rtp show stats`** frequently - packet loss/jitter indicates network issues
3. **Check codec negotiation** - mismatched codecs cause audio issues
4. **Monitor during actual call** - some issues only appear when media is flowing
5. **Save logs** - use `docker logs` to capture full context after reproducing issue

## Example: Full Call Debug Session

```bash
# 1. Enter Asterisk CLI with maximum verbosity
sudo docker exec -it webrtc-asterisk asterisk -rvvvvv

# 2. Enable all debugging
core set verbose 10
core set debug 5
pjsip set logger on
rtp set debug on

# 3. Make your test call from browser (5001 -> 5002 or 1003)

# 4. While call is active, run these:
core show channels verbose
pjsip show channels
rtp show stats

# 5. Check specific channel (use actual ID from step 4)
core show channel PJSIP/5001-00000001

# 6. After call ends, turn off debugging
pjsip set logger off
rtp set debug off
core set verbose 3
core set debug 0

# 7. Exit CLI: Ctrl+D or 'exit'
```

---

**Note**: All commands assume you're running Asterisk in Docker. If you need to run these frequently, consider creating an alias:

```bash
alias ast-cli='sudo docker exec -it webrtc-asterisk asterisk -rvvv'
alias ast-cmd='sudo docker exec webrtc-asterisk asterisk -rx'
```

Then you can simply run:
```bash
ast-cli  # Interactive CLI
ast-cmd "core show channels"  # Quick command
```



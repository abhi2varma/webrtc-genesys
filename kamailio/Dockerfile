# Kamailio SIP Proxy for WebRTC Gateway
FROM alpine:3.18

# Install Kamailio and dependencies
RUN apk add --no-cache \
    kamailio \
    kamailio-json \
    kamailio-tls \
    kamailio-websocket \
    bash \
    && mkdir -p /var/log/kamailio \
    && chmod 755 /var/log/kamailio

# Copy configuration files
COPY kamailio.cfg /etc/kamailio/kamailio.cfg
COPY dispatcher.list /etc/kamailio/dispatcher.list

# Expose SIP ports
EXPOSE 5060/udp 5060/tcp

# Start Kamailio
CMD ["kamailio", "-DD", "-E", "-f", "/etc/kamailio/kamailio.cfg"]


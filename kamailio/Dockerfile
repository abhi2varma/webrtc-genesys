# Kamailio SIP Proxy for WebRTC Gateway
FROM alpine:3.18

# Install Kamailio, syslog, and dependencies
RUN apk add --no-cache \
    kamailio \
    kamailio-json \
    kamailio-tls \
    kamailio-websocket \
    rsyslog \
    bash \
    && mkdir -p /var/log/kamailio \
    && chmod 777 /var/log/kamailio

# Configure rsyslog for Kamailio
RUN echo "local0.* /var/log/kamailio/kamailio.log" > /etc/rsyslog.d/kamailio.conf && \
    echo "\$ModLoad imudp" >> /etc/rsyslog.conf && \
    echo "\$UDPServerRun 514" >> /etc/rsyslog.conf

# Copy configuration files
COPY kamailio.cfg /etc/kamailio/kamailio.cfg
COPY dispatcher.list /etc/kamailio/dispatcher.list

# Create startup script
RUN echo '#!/bin/bash' > /start.sh && \
    echo 'rsyslogd' >> /start.sh && \
    echo 'sleep 2' >> /start.sh && \
    echo 'exec kamailio -DD -E -f /etc/kamailio/kamailio.cfg' >> /start.sh && \
    chmod +x /start.sh

# Expose SIP ports
EXPOSE 5060/udp 5060/tcp

# Start rsyslog and Kamailio
CMD ["/start.sh"]


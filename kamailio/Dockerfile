# Kamailio SIP Proxy for WebRTC Gateway
FROM debian:bullseye-slim

# Install Kamailio with all required modules
RUN apt-get update && \
    apt-get install -y \
        kamailio \
        kamailio-extra-modules \
        kamailio-json-modules \
        kamailio-tls-modules \
        kamailio-websocket-modules \
        kamailio-utils-modules \
        rsyslog \
        procps \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/log/kamailio \
    && chmod 777 /var/log/kamailio

# Configure rsyslog for Kamailio
RUN echo "local0.* /var/log/kamailio/kamailio.log" > /etc/rsyslog.d/kamailio.conf && \
    echo "\$ModLoad imudp" >> /etc/rsyslog.conf && \
    echo "\$UDPServerRun 514" >> /etc/rsyslog.conf

# Copy configuration files
COPY kamailio-proxy.cfg /etc/kamailio/kamailio.cfg
COPY dispatcher.list /etc/kamailio/dispatcher.list
COPY tls.cfg /etc/kamailio/tls.cfg

# Create startup script  
RUN echo '#!/bin/bash' > /start.sh && \
    echo 'rsyslogd' >> /start.sh && \
    echo 'sleep 2' >> /start.sh && \
    echo 'exec kamailio -E -m 64 -M 8 -f /etc/kamailio/kamailio.cfg' >> /start.sh && \
    chmod +x /start.sh

# Expose SIP ports
EXPOSE 5060/udp 5060/tcp

# Start rsyslog and Kamailio
CMD ["/start.sh"]


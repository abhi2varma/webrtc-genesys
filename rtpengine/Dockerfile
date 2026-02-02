FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools
    build-essential \
    ca-certificates \
    git \
    pkg-config \
    gperf \
    # RTPengine dependencies
    libcurl4-openssl-dev \
    libpcre3-dev \
    libssl-dev \
    libxmlrpc-core-c3-dev \
    libhiredis-dev \
    libjson-glib-dev \
    libpcap-dev \
    libglib2.0-dev \
    libevent-dev \
    libpcre3 \
    libwebsockets-dev \
    libncurses-dev \
    libncursesw6 \
    libopus-dev \
    libjwt-dev \
    libiptc-dev \
    libmnl-dev \
    libnetfilter-conntrack-dev \
    libnftnl-dev \
    libmariadb-dev \
    default-libmysqlclient-dev \
    libsystemd-dev \
    libbcg729-dev \
    iptables \
    nftables \
    # Codec support (optional but recommended)
    libavcodec-dev \
    libavfilter-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    libspandsp-dev \
    && rm -rf /var/lib/apt/lists/*

# Clone and build RTPengine from source
RUN git clone https://github.com/sipwise/rtpengine.git /tmp/rtpengine \
    && cd /tmp/rtpengine/daemon \
    && make rtpengine \
    && cp rtpengine /usr/local/bin/ \
    && chmod +x /usr/local/bin/rtpengine \
    && cd / \
    && rm -rf /tmp/rtpengine

# Expose RTPengine ports
EXPOSE 2223/udp 10000-20000/udp

ENTRYPOINT ["rtpengine"]

FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools
    build-essential \
    ca-certificates \
    git \
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
    iptables \
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
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/rtpengine \
    # Clean up build dependencies to reduce image size
    && apt-get purge -y --auto-remove \
        build-essential \
        git \
        libcurl4-openssl-dev \
        libpcre3-dev \
        libssl-dev \
        libxmlrpc-core-c3-dev \
        libhiredis-dev \
        libjson-glib-dev \
        libpcap-dev \
        libglib2.0-dev \
        libevent-dev \
        libavcodec-dev \
        libavfilter-dev \
        libavformat-dev \
        libavutil-dev \
        libswresample-dev \
        libspandsp-dev

# Expose RTPengine ports
EXPOSE 2223/udp 10000-20000/udp

ENTRYPOINT ["rtpengine"]

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends rtpengine iptables \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 2223/udp 10000-20000/udp

ENTRYPOINT ["rtpengine"]

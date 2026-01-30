FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install RTPengine from Sipwise repo
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg iptables \
    && curl -fsSL https://packages.sipwise.com/keyring.gpg -o /usr/share/keyrings/sipwise.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/sipwise.gpg] https://packages.sipwise.com/debian/ rtpengine-bullseye main" > /etc/apt/sources.list.d/sipwise.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends rtpengine \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 2223/udp 10000-20000/udp

ENTRYPOINT ["rtpengine"]

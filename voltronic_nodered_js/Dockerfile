FROM ghcr.io/home-assistant/addons/node-red:latest

COPY rootfs /
COPY voltronic /opt/voltronic

RUN cd /opt/voltronic && npm install --omit=dev \
  && chmod +x /etc/cont-init.d/00-voltronic-init \
  && chmod +x /etc/services.d/voltronic/run

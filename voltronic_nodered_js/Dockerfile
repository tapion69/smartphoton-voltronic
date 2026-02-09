ARG BUILD_ARCH=amd64
FROM ghcr.io/hassio-addons/node-red/${BUILD_ARCH}:edge

# Fichiers add-on (s6, config.js, flows-template, init, etc.)
COPY rootfs /

# IMPORTANT: Passage en 100% Node-RED => on NE lance plus voltronic.js
# Donc on ne copie plus /opt/voltronic (tu peux laisser si tu veux, mais inutile)
# COPY voltronic /opt/voltronic

# Installer les nodes série dans l'image Node-RED (Serial in/out + request selon palette)
RUN npm install --omit=dev --unsafe-perm \
      node-red-node-serialport \
    && npm cache clean --force

# Permissions scripts init/services
RUN chmod +x /etc/cont-init.d/00-voltronic-init \
    && if [ -f /etc/services.d/voltronic/run ]; then chmod +x /etc/services.d/voltronic/run; fi

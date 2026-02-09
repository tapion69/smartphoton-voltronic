FROM ghcr.io/hassio-addons/node-red:latest

# Copie des scripts/flows via rootfs
COPY rootfs /

# Copie du service Voltronic (Node.js)
COPY voltronic /opt/voltronic

# Dépendances Node
RUN cd /opt/voltronic && npm install --omit=dev \
  && chmod +x /etc/cont-init.d/00-voltronic-init \
  && chmod +x /etc/services.d/voltronic/run

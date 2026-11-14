# ─────────────────────────────────────────────────────────────
# CIPHER BVG — production image
# Plain Node runtime, no Android tooling, no build step.
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS base

ENV NODE_ENV=production \
    PORT=2024 \
    npm_config_update_notifier=false \
    npm_config_fund=false

WORKDIR /app

# Install dependencies first so Docker can cache this layer.
# --omit=dev keeps image lean; nothing here needs a compiler.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# Application source
COPY . .

# Writable runtime directories (JSON storage + avatar uploads)
RUN mkdir -p Database uploads auth sessions backups \
 && chown -R node:node /app

USER node

EXPOSE 2024

# Hosts such as Railway and Pterodactyl inject PORT at runtime.
CMD ["node", "index.js"]
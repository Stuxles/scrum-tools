# ── Stage 1: Build & install production dependencies ─────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Alleen package bestanden kopiëren voor optimale Docker laag caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Minimal production image ────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Productie omgevingsvariabelen
ENV NODE_ENV=production \
    PORT=3000

# Kopieer uitsluitend de schone node_modules en benodigde app-bestanden
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY public ./public

# Gebruik de standaard ingebouwde onbevoorrechte 'node' gebruiker (veiligheid & minimalisme)
USER node

EXPOSE 3000

# Native Node 24 healthcheck (geen wget of curl nodig)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]

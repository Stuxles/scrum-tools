# ── Stage 1: Build & install production dependencies ─────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files only for optimal Docker layer caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Minimal production image ────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Production environment variables
ENV NODE_ENV=production \
    PORT=3000

# Copy only clean node_modules and required application files
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY public ./public

# Use default built-in non-privileged 'node' user (security & minimalism)
USER node

EXPOSE 3000

# Native Node 24 healthcheck (no wget or curl needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]

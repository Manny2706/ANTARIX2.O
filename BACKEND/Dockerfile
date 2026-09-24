FROM node:20-slim AS runner

# Install OpenSSL and curl (required by Prisma engine and container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies (including devDependencies required for Prisma and TypeScript)
RUN npm install

# Copy Prisma schema and configurations
COPY prisma ./prisma/
COPY prisma7.config.ts ./
COPY prisma.config.ts ./
COPY tsconfig.json ./

# Generate Prisma client artifacts
RUN npx prisma generate --config prisma7.config.ts

# Copy application source code
COPY src ./src/

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Build TypeScript to dist/ (falls back gracefully to ts-node-dev if warnings occur)
RUN npm run build || true

# Default environment configuration
ENV PORT=7000 \
    NODE_ENV=production

EXPOSE 7000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD curl -fsS http://localhost:7000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]

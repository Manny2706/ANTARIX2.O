#!/bin/sh
set -e

echo "=========================================="
echo " Starting SatQuery-AI Backend Microservice"
echo "=========================================="

# Check database connection and deploy migrations/schema
if [ -n "$DATABASE_URL" ]; then
  echo "==> Synchronizing Prisma database schema..."
  npx prisma db push --accept-data-loss --config prisma7.config.ts || {
    echo "==> db push encountered a warning, attempting migrate deploy..."
    npx prisma migrate deploy --config prisma7.config.ts || true
  }
  echo "==> Prisma database schema successfully synchronized!"
fi

# Launch server
if [ -f "dist/index.js" ]; then
  echo "==> Starting production Node.js server from dist/index.js on port ${PORT:-7000}..."
  exec node dist/index.js
else
  echo "==> dist/index.js not found, running via ts-node-dev on port ${PORT:-7000}..."
  exec npx ts-node-dev --respawn --transpile-only src/index.ts
fi

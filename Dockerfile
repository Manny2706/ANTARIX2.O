# ==============================================================================
# ANTARIX 2.O — Complete All-in-One Dockerfile
#
# Runs all three connected project tiers in a single container:
#   1. Agentic AI Gateway (Python / FastAPI / LangGraph) on port 8000
#   2. Backend (Node.js / Express / Socket.IO / Prisma) on port 7000
#   3. Frontend (React / Vite built and served via Nginx) on port 3000
#
# Process management is orchestrated via Supervisor.
# Alternatively, you can use `docker compose up --build` for the standard
# multi-container setup (recommended for development & production).
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Frontend (React + Vite)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci || npm install

ARG VITE_API_BASE_URL=http://localhost:7000
ARG VITE_SOCKET_URL=http://localhost:7000
ARG VITE_SOCKET_KEY=bgvpit303269bgwb9nishant
ARG VITE_USER_ID=70fa21d1-c6c0-4766-a264-9c2d418352c2

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_SOCKET_KEY=$VITE_SOCKET_KEY \
    VITE_USER_ID=$VITE_USER_ID

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Final Unified Container
# ------------------------------------------------------------------------------
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production \
    PORT=7000 \
    API_HOST=0.0.0.0 \
    API_PORT=8000 \
    VLM_BACKEND=disabled \
    ML_API_URL=http://127.0.0.1:8000/api/v1/analyze/stream \
    SOCKET_KEY=bgvpit303269bgwb9nishant \
    DB_USER=postgres \
    DB_PASSWORD=postgres \
    DB_NAME=satquery \
    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/satquery?schema=public

# Install system dependencies: Node.js 20, Nginx, Supervisor, PostgreSQL, OpenSSL, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gnupg \
        build-essential \
        nginx \
        supervisor \
        postgresql \
        openssl \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Initialize the bundled PostgreSQL cluster with the app's default role & database
RUN mkdir -p /var/run/postgresql && chown postgres:postgres /var/run/postgresql \
    && PG_VERSION=$(ls /etc/postgresql) \
    && pg_ctlcluster "$PG_VERSION" main start \
    && su postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" \
    && su postgres -c "createdb satquery" \
    && pg_ctlcluster "$PG_VERSION" main stop

# Set up Gateway (Python) inside its own virtual environment
WORKDIR /app/gateway
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
COPY AGENTIC-AI_GATEWAY/requirements.txt AGENTIC-AI_GATEWAY/requirements-geo.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -r requirements-geo.txt
COPY AGENTIC-AI_GATEWAY/ ./
RUN pip install --no-cache-dir --no-deps -e .

# Set up Backend (Node.js)
WORKDIR /app/backend
COPY BACKEND/package*.json ./
RUN npm install --include=dev
COPY BACKEND/prisma ./prisma/
COPY BACKEND/prisma7.config.ts ./
COPY BACKEND/prisma.config.ts ./
COPY BACKEND/tsconfig.json ./
RUN npx prisma generate --config prisma7.config.ts
COPY BACKEND/src ./src/
RUN npm run build || true

# Set up Frontend (Nginx static files & proxy)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i 's/backend:7000/127.0.0.1:7000/g' /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports:
# 80   -> Frontend (Nginx)
# 7000 -> Backend API & Socket.IO
# 8000 -> Agentic AI Gateway
# 5432 -> Bundled PostgreSQL (optional, for inspection)
EXPOSE 80 7000 8000 5432

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:7000/health && curl -fsS http://localhost:8000/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

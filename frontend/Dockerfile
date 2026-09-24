# Stage 1: Build the React + Vite Single Page Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Build arguments for Vite environment variables
ARG VITE_API_BASE_URL=http://localhost:7000
ARG VITE_SOCKET_URL=http://localhost:7000
ARG VITE_SOCKET_KEY=bgvpit303269bgwb9nishant
ARG VITE_USER_ID=70fa21d1-c6c0-4766-a264-9c2d418352c2

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_SOCKET_KEY=$VITE_SOCKET_KEY \
    VITE_USER_ID=$VITE_USER_ID

# Copy application source code
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve application with lightweight Nginx web server
FROM nginx:1.27-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build artifacts from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

# Multi-stage production Dockerfile for Next.js application
# Use full node image for builder to avoid Alpine compatibility issues
FROM node:20 AS base

# Install system dependencies and pnpm
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/* && \
    npm install -g pnpm@10

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files first (for better cache utilization)
COPY package.json pnpm-lock.yaml ./

# Install dependencies (use --no-frozen-lockfile for CI compatibility)
RUN pnpm install

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files and prisma schema first (changes less frequently)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# 设置构建时数据库连接参数
ARG DATABASE_URL="mysql://user:password@localhost:3306/temp_db"
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client
RUN pnpm prisma generate

# Copy application source code (changes most frequently)
COPY . .

# Build the application with production optimizations
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Run build with verbose output
RUN set -ex && \
    echo "=== Starting Next.js build ===" && \
    echo "Node version: $(node --version)" && \
    echo "pnpm version: $(pnpm --version)" && \
    echo "Working directory: $(pwd)" && \
    echo "Files in directory:" && ls -la && \
    pnpm next build

# Production runner stage (no pnpm needed for standalone mode)
FROM node:20-alpine AS runner
WORKDIR /app

# Install only curl for health checks and create non-root user
RUN apk add --no-cache curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Production environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    LOG_LEVEL=info \
    SERVICE_NAME=weekly-content-management \
    ENABLE_RESOURCE_MONITORING=true \
    RESOURCE_MONITORING_INTERVAL=30000 \
    MEMORY_WARNING_THRESHOLD=80 \
    MEMORY_CRITICAL_THRESHOLD=90 \
    CPU_WARNING_THRESHOLD=80 \
    CPU_CRITICAL_THRESHOLD=90

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy necessary scripts
COPY --from=builder --chown=nextjs:nodejs /app/docker/healthcheck.js ./docker/healthcheck.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-startup.js ./scripts/validate-startup.js

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Enhanced health check with resource monitoring
HEALTHCHECK --interval=60s --timeout=15s --start-period=40s --retries=3 \
  CMD node docker/healthcheck.js

# Switch to non-root user
USER nextjs

# Graceful shutdown signal
STOPSIGNAL SIGTERM

# Start the standalone Next.js server.
CMD ["node", "server.js"]

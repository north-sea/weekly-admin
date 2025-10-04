# Multi-stage production Dockerfile for Next.js application
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache libc6-compat curl

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Builder stage
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# 设置构建时数据库连接参数
ARG DATABASE_URL="mysql://user:password@localhost:3306/temp_db"
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client
RUN pnpm prisma generate

# Build the application with production optimizations
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build:production

# Production runner stage
FROM base AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Monitoring and logging configuration
ENV LOG_LEVEL=info
ENV SERVICE_NAME=weekly-content-management
ENV ENABLE_RESOURCE_MONITORING=true
ENV RESOURCE_MONITORING_INTERVAL=30000

# Performance monitoring thresholds
ENV MEMORY_WARNING_THRESHOLD=80
ENV MEMORY_CRITICAL_THRESHOLD=90
ENV CPU_WARNING_THRESHOLD=80
ENV CPU_CRITICAL_THRESHOLD=90

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy necessary scripts
COPY --from=builder --chown=nextjs:nodejs /app/docker/healthcheck.js ./docker/healthcheck.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/validate-startup.js ./scripts/validate-startup.js

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Enhanced health check with resource monitoring
HEALTHCHECK --interval=60s --timeout=15s --start-period=40s --retries=3 \
  CMD node docker/healthcheck.js

# Create optimized startup script with monitoring initialization
RUN echo '#!/bin/sh\n\
echo "🚀 Starting Weekly Content Management System..."\n\
echo "📋 Validating startup configuration..."\n\
echo "🔍 Initializing monitoring systems..."\n\
\n\
# Set production optimizations\n\
export NODE_OPTIONS="--max-old-space-size=1024"\n\
\n\
# Run startup validation\n\
if ! node scripts/validate-startup.js; then\n\
  echo "❌ Startup validation failed - exiting"\n\
  exit 1\n\
fi\n\
\n\
echo "✅ Startup validation passed"\n\
echo "📊 Resource monitoring enabled"\n\
echo "🚀 Starting application server..."\n\
\n\
# Graceful shutdown handler\n\
trap '\''echo "🛑 Received shutdown signal, gracefully stopping..."; kill -TERM $PID; wait $PID'\'' TERM\n\
\n\
# Start the application\n\
node server.js &\n\
PID=$!\n\
wait $PID\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Graceful shutdown signal
STOPSIGNAL SIGTERM

# Start the application with enhanced monitoring
CMD ["/app/docker-entrypoint.sh"]
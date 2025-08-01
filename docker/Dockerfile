# Production Dockerfile for Next.js application
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy application code
COPY . .

# 设置构建时数据库连接参数
ARG DATABASE_URL="mysql://user:password@localhost:3306/temp_db"
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node docker/healthcheck.js

# Create startup script that validates environment before starting the application
RUN echo '#!/bin/sh\n\
echo "🚀 Starting Weekly Content Management System..."\n\
echo "📋 Validating startup configuration..."\n\
\n\
# Run startup validation\n\
if ! pnpm validate-startup; then\n\
  echo "❌ Startup validation failed - exiting"\n\
  exit 1\n\
fi\n\
\n\
echo "✅ Startup validation passed - starting application"\n\
exec pnpm start\n\
' > /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Start the application with validation
CMD ["/app/docker-entrypoint.sh"]
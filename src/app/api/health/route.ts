import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import client from '@/lib/search';
import { initializeApplication, isApplicationInitialized } from '@/lib/startup';
import { resourceMonitor } from '@/lib/monitoring/resource-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { logger } from '@/lib/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  responseTime?: number;
}

interface HealthCheckResponse {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: HealthStatus;
    search: HealthStatus;
    application: HealthStatus;
    startup: HealthStatus;
  };
  resources?: {
    memory: {
      used: number; // MB
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    uptime: number;
  };
  performance: {
    totalOperations: number;
    averageDuration: number;
    successRate: number;
  };
  errors: {
    recentErrors: number;
    totalErrors: number;
  };
  timestamp: Date;
  uptime: number;
  initialized: boolean;
  version: string;
}

export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date();
  
  // Initialize response structure
  const healthCheck: HealthCheckResponse = {
    overall: 'healthy',
    services: {
      database: {
        status: 'unhealthy',
        message: 'Not checked',
        timestamp,
      },
      search: {
        status: 'degraded', 
        message: 'Not checked',
        timestamp,
      },
      application: {
        status: 'healthy',
        message: 'Application is running',
        timestamp,
        responseTime: 0,
      },
      startup: {
        status: 'unhealthy',
        message: 'Not checked',
        timestamp,
      },
    },
    performance: {
      totalOperations: 0,
      averageDuration: 0,
      successRate: 0,
    },
    errors: {
      recentErrors: 0,
      totalErrors: 0,
    },
    timestamp,
    uptime: process.uptime(),
    initialized: false,
    version: process.env.npm_package_version || '1.0.0',
  };

  // Check startup validation first
  try {
    const startupStartTime = Date.now();
    
    if (!isApplicationInitialized()) {
      // Try to initialize if not already done
      await initializeApplication();
    }
    
    const startupResponseTime = Date.now() - startupStartTime;
    
    healthCheck.services.startup = {
      status: 'healthy',
      message: 'Application startup validation successful',
      timestamp,
      responseTime: startupResponseTime,
    };
    healthCheck.initialized = true;
  } catch (error) {
    healthCheck.services.startup = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Application startup validation failed',
      timestamp,
    };
    healthCheck.overall = 'unhealthy';
    healthCheck.initialized = false;
  }

  // Check database connection
  try {
    const dbStartTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStartTime;
    
    healthCheck.services.database = {
      status: 'healthy',
      message: 'Database connection successful',
      timestamp,
      responseTime: dbResponseTime,
    };
  } catch (error) {
    healthCheck.services.database = {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
      timestamp,
    };
    healthCheck.overall = 'unhealthy';
  }

  // Check Meilisearch connection
  try {
    const searchStartTime = Date.now();
    await client.health();
    const searchResponseTime = Date.now() - searchStartTime;
    
    healthCheck.services.search = {
      status: 'healthy',
      message: 'Search service connection successful',
      timestamp,
      responseTime: searchResponseTime,
    };
  } catch (error) {
    healthCheck.services.search = {
      status: 'degraded',
      message: error instanceof Error ? error.message : 'Search service connection failed',
      timestamp,
    };
    if (healthCheck.overall === 'healthy') {
      healthCheck.overall = 'degraded';
    }
  }

  // Update application response time
  healthCheck.services.application.responseTime = Date.now() - startTime;

  // Get current resource metrics
  const resourceMetrics = resourceMonitor.getCurrentMetrics();
  if (resourceMetrics) {
    healthCheck.resources = {
      memory: {
        used: Math.round(resourceMetrics.memory.used / 1024 / 1024), // MB
        percentage: Math.round(resourceMetrics.memory.percentage),
      },
      cpu: {
        usage: Math.round(resourceMetrics.cpu.usage),
      },
      uptime: Math.round(resourceMetrics.process.uptime),
    };
  }

  // Get performance stats
  const performanceStats = performanceMonitor.getStats();
  healthCheck.performance = {
    totalOperations: performanceStats.count,
    averageDuration: Math.round(performanceStats.avgDuration),
    successRate: Math.round(performanceStats.successRate * 100),
  };

  // Get error stats
  const errorStats = errorTracker.getStats();
  healthCheck.errors = {
    recentErrors: errorStats.recentErrors,
    totalErrors: errorStats.totalErrors,
  };

  // Add version info
  healthCheck.version = process.env.APP_VERSION || 'unknown';

  // Log health check
  logger.info('Health check completed', {
    status: healthCheck.overall,
    duration: healthCheck.services.application.responseTime,
    memoryUsage: healthCheck.resources?.memory.percentage,
    cpuUsage: healthCheck.resources?.cpu.usage,
    type: 'health_check',
  });

  // Return appropriate status code
  const statusCode = healthCheck.overall === 'unhealthy' ? 503 : 200;
  
  return NextResponse.json(healthCheck, { status: statusCode });
}

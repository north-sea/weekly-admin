import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import client from '@/lib/search';
import { initializeApplication, isApplicationInitialized } from '@/lib/startup';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: Date;
  responseTime?: number;
}

interface HealthCheckResponse {
  overall: 'healthy' | 'unhealthy';
  services: {
    database: HealthStatus;
    search: HealthStatus;
    application: HealthStatus;
    startup: HealthStatus;
  };
  timestamp: Date;
  uptime: number;
  initialized: boolean;
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
        status: 'unhealthy', 
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
    timestamp,
    uptime: process.uptime(),
    initialized: false,
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
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Search service connection failed',
      timestamp,
    };
    healthCheck.overall = 'unhealthy';
  }

  // Update application response time
  healthCheck.services.application.responseTime = Date.now() - startTime;

  // Return appropriate status code
  const statusCode = healthCheck.overall === 'healthy' ? 200 : 503;
  
  return NextResponse.json(healthCheck, { status: statusCode });
}
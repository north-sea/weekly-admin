import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import client from '@/lib/search';

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
  };
  timestamp: Date;
  uptime: number;
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
    },
    timestamp,
    uptime: process.uptime(),
  };

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
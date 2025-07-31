import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Simple database connection test
    await prisma.$queryRaw`SELECT 1`;
    
    const response = {
      database: {
        status: 'healthy',
        message: 'Database connection successful',
        timestamp: new Date(),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        database: {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Database connection failed',
          timestamp: new Date(),
        },
      },
      { status: 503 }
    );
  }
}
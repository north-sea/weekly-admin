import { NextResponse } from 'next/server';
import { checkDatabaseHealth, testDatabaseConnection } from '@/lib/db';

export async function GET() {
  try {
    const [healthCheck, connectionTest] = await Promise.all([
      checkDatabaseHealth(),
      testDatabaseConnection(),
    ]);

    const response = {
      database: {
        ...healthCheck,
        connection: connectionTest,
      },
    };

    // Return appropriate status code based on health
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        database: {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date(),
        },
      },
      { status: 503 }
    );
  }
}
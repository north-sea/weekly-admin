import { PrismaClient } from '@prisma/client';

// Global variable to store the Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a single instance of Prisma client
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// In development, store the client on the global object to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Database health check function
 * Tests the database connection and returns status
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: Date;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1 as test`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      message: 'Database connection successful',
      timestamp: new Date(),
      responseTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown database error',
      timestamp: new Date(),
    };
  }
}

/**
 * Test database connection with detailed information
 */
export async function testDatabaseConnection(): Promise<{
  connected: boolean;
  version?: string;
  database?: string;
  error?: string;
}> {
  try {
    // MySQL queries
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT VERSION() as version`;
    const dbResult = await prisma.$queryRaw<Array<{ 'DATABASE()': string }>>`SELECT DATABASE()`;
    
    return {
      connected: true,
      version: result[0]?.version,
      database: dbResult[0]?.['DATABASE()'],
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

// Handle process termination (only in Node.js runtime)
if (typeof process !== 'undefined' && process.on) {
  process.on('beforeExit', async () => {
    await disconnectDatabase();
  });

  process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}
import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';

// Environment configuration interface
export interface EnvironmentConfig {
  // Application
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  
  // Database
  databaseUrl: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
  
  // Search
  meilisearchHost: string;
  meilisearchMasterKey?: string;
  
  // Image Upload
  imageUploadUrl?: string;
  imageUploadToken?: string;
  
  // JWT
  jwtSecret: string;
  jwtExpiresIn: string;
}

// Required environment variables
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'MEILISEARCH_HOST'
] as const;

// Optional environment variables with defaults
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  PORT: '3000',
  JWT_EXPIRES_IN: '8h',
  MEILISEARCH_MASTER_KEY: '',
  IMAGE_UPLOAD_URL: '',
  IMAGE_UPLOAD_TOKEN: '',
  DB_HOST: '',
  DB_PORT: '3306',
  DB_USER: '',
  DB_PASSWORD: '',
  DB_NAME: ''
} as const;

// Validation error class
export class ConfigValidationError extends Error {
  constructor(message: string, public details?: string[]) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

// Database connection validation error
export class DatabaseConnectionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

// Meilisearch connection validation error
export class MeilisearchConnectionError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'MeilisearchConnectionError';
  }
}

/**
 * Validate all required environment variables are present
 */
export function validateEnvironmentVariables(): EnvironmentConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV || OPTIONAL_ENV_VARS.NODE_ENV;
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }

  // Validate PORT
  const port = parseInt(process.env.PORT || OPTIONAL_ENV_VARS.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
  }

  // Validate DATABASE_URL format
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (!['mysql', 'postgresql', 'postgres'].includes(url.protocol.replace(':', ''))) {
        errors.push(`Unsupported database protocol in DATABASE_URL: ${url.protocol}`);
      }
    } catch (error) {
      errors.push(`Invalid DATABASE_URL format: ${databaseUrl}`);
    }
  }

  // Validate MEILISEARCH_HOST format
  const meilisearchHost = process.env.MEILISEARCH_HOST;
  if (meilisearchHost) {
    try {
      new URL(meilisearchHost);
    } catch (error) {
      errors.push(`Invalid MEILISEARCH_HOST format: ${meilisearchHost}`);
    }
  }

  // Validate IMAGE_UPLOAD_URL format if provided
  const imageUploadUrl = process.env.IMAGE_UPLOAD_URL;
  if (imageUploadUrl) {
    try {
      new URL(imageUploadUrl);
    } catch (error) {
      errors.push(`Invalid IMAGE_UPLOAD_URL format: ${imageUploadUrl}`);
    }
    
    // Check if token is provided when URL is provided
    if (!process.env.IMAGE_UPLOAD_TOKEN) {
      warnings.push('IMAGE_UPLOAD_URL is provided but IMAGE_UPLOAD_TOKEN is missing. Image upload functionality will be disabled.');
    }
  }

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters. Consider using a longer secret for better security.');
  }

  // Validate DB_PORT if provided
  const dbPort = process.env.DB_PORT;
  if (dbPort) {
    const port = parseInt(dbPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`Invalid DB_PORT: ${dbPort}. Must be a number between 1 and 65535`);
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  // Throw error if validation failed
  if (errors.length > 0) {
    throw new ConfigValidationError('Environment validation failed', errors);
  }

  // Return validated configuration
  return {
    nodeEnv: nodeEnv as 'development' | 'production' | 'test',
    port,
    databaseUrl: databaseUrl!,
    dbHost: process.env.DB_HOST,
    dbPort: dbPort ? parseInt(dbPort) : undefined,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,
    meilisearchHost: meilisearchHost!,
    meilisearchMasterKey: process.env.MEILISEARCH_MASTER_KEY,
    imageUploadUrl: process.env.IMAGE_UPLOAD_URL,
    imageUploadToken: process.env.IMAGE_UPLOAD_TOKEN,
    jwtSecret: jwtSecret!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || OPTIONAL_ENV_VARS.JWT_EXPIRES_IN,
  };
}

/**
 * Validate database connection
 */
export async function validateDatabaseConnection(config: EnvironmentConfig): Promise<void> {
  let prisma: PrismaClient | null = null;
  
  try {
    console.log('🔍 Validating database connection...');
    
    // Create Prisma client with the validated configuration
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.databaseUrl,
        },
      },
      log: config.nodeEnv === 'development' ? ['error'] : ['error'],
    });

    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Test if we can access the database schema
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE()`;
    
    console.log('✅ Database connection validated successfully');
    
    // Log database info in development
    if (config.nodeEnv === 'development') {
      console.log(`   - Database URL: ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
      console.log(`   - Tables found: ${Array.isArray(result) && result.length > 0 ? (result[0] as any).count : 'Unknown'}`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error('❌ Database connection validation failed:', errorMessage);
    
    // Provide helpful error messages based on common issues
    let helpfulMessage = 'Failed to connect to database';
    
    if (errorMessage.includes('ECONNREFUSED')) {
      helpfulMessage = 'Database connection refused. Check if the database server is running and accessible.';
    } else if (errorMessage.includes('ENOTFOUND')) {
      helpfulMessage = 'Database host not found. Check the database host configuration.';
    } else if (errorMessage.includes('Access denied')) {
      helpfulMessage = 'Database access denied. Check the database credentials.';
    } else if (errorMessage.includes('Unknown database')) {
      helpfulMessage = 'Database not found. Check if the database exists.';
    } else if (errorMessage.includes('timeout')) {
      helpfulMessage = 'Database connection timeout. Check network connectivity and database server status.';
    }
    
    throw new DatabaseConnectionError(helpfulMessage, error instanceof Error ? error : undefined);
  } finally {
    // Clean up the test connection
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Validate Meilisearch connection
 */
export async function validateMeilisearchConnection(config: EnvironmentConfig): Promise<void> {
  try {
    console.log('🔍 Validating Meilisearch connection...');
    
    // Create Meilisearch client with the validated configuration
    const clientConfig: any = {
      host: config.meilisearchHost,
    };

    // Add API key if provided
    if (config.meilisearchMasterKey) {
      clientConfig.apiKey = config.meilisearchMasterKey;
    }

    const client = new MeiliSearch(clientConfig);

    // Test connection by getting server health
    const health = await client.health();
    
    if (health.status !== 'available') {
      throw new Error(`Meilisearch server status: ${health.status}`);
    }

    // Test if we can get server version (requires valid API key if auth is enabled)
    try {
      const version = await client.getVersion();
      console.log('✅ Meilisearch connection validated successfully');
      
      // Log Meilisearch info in development
      if (config.nodeEnv === 'development') {
        console.log(`   - Meilisearch host: ${config.meilisearchHost}`);
        console.log(`   - Meilisearch version: ${version.pkgVersion}`);
        console.log(`   - Authentication: ${config.meilisearchMasterKey ? 'Enabled' : 'Disabled'}`);
      }
    } catch (versionError) {
      // If we can't get version but health is OK, it might be an auth issue
      if (config.meilisearchMasterKey) {
        throw new Error('Meilisearch authentication failed. Check MEILISEARCH_MASTER_KEY.');
      } else {
        console.log('✅ Meilisearch connection validated (no authentication)');
        console.log(`   - Meilisearch host: ${config.meilisearchHost}`);
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Meilisearch error';
    console.error('❌ Meilisearch connection validation failed:', errorMessage);
    
    // Provide helpful error messages based on common issues
    let helpfulMessage = 'Failed to connect to Meilisearch';
    
    if (errorMessage.includes('ECONNREFUSED')) {
      helpfulMessage = 'Meilisearch connection refused. Check if Meilisearch server is running and accessible.';
    } else if (errorMessage.includes('ENOTFOUND')) {
      helpfulMessage = 'Meilisearch host not found. Check the MEILISEARCH_HOST configuration.';
    } else if (errorMessage.includes('authentication failed') || errorMessage.includes('Invalid API key')) {
      helpfulMessage = 'Meilisearch authentication failed. Check the MEILISEARCH_MASTER_KEY.';
    } else if (errorMessage.includes('timeout')) {
      helpfulMessage = 'Meilisearch connection timeout. Check network connectivity and server status.';
    } else if (errorMessage.includes('status:')) {
      helpfulMessage = `Meilisearch server is not available: ${errorMessage}`;
    }
    
    throw new MeilisearchConnectionError(helpfulMessage, error instanceof Error ? error : undefined);
  }
}

/**
 * Validate image upload service configuration
 */
export function validateImageUploadConfiguration(config: EnvironmentConfig): void {
  if (!config.imageUploadUrl || !config.imageUploadToken) {
    console.log('⚠️  Image upload service not configured - image upload functionality will be disabled');
    return;
  }

  try {
    // Validate URL format
    new URL(config.imageUploadUrl);
    
    // Check token is not empty
    if (config.imageUploadToken.trim().length === 0) {
      throw new Error('IMAGE_UPLOAD_TOKEN cannot be empty');
    }
    
    console.log('✅ Image upload service configuration validated');
    
    if (config.nodeEnv === 'development') {
      console.log(`   - Upload URL: ${config.imageUploadUrl}`);
      console.log(`   - Token configured: Yes`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Image upload service configuration validation failed:', errorMessage);
    throw new ConfigValidationError(`Image upload service configuration error: ${errorMessage}`);
  }
}

/**
 * Comprehensive startup validation
 */
export async function validateApplicationStartup(): Promise<EnvironmentConfig> {
  console.log('🚀 Starting application configuration validation...\n');
  
  try {
    // Step 1: Validate environment variables
    console.log('📋 Step 1: Validating environment variables...');
    const config = validateEnvironmentVariables();
    console.log('✅ Environment variables validated\n');

    // Step 2: Validate database connection
    console.log('📋 Step 2: Validating database connection...');
    await validateDatabaseConnection(config);
    console.log('');

    // Step 3: Validate Meilisearch connection
    console.log('📋 Step 3: Validating Meilisearch connection...');
    await validateMeilisearchConnection(config);
    console.log('');

    // Step 4: Validate image upload service (optional)
    console.log('📋 Step 4: Validating image upload service...');
    validateImageUploadConfiguration(config);
    console.log('');

    console.log('🎉 All configuration validations passed successfully!\n');
    
    return config;
    
  } catch (error) {
    console.error('\n💥 Application startup validation failed!\n');
    
    if (error instanceof ConfigValidationError) {
      console.error('Configuration errors:');
      if (error.details) {
        error.details.forEach(detail => console.error(`   - ${detail}`));
      } else {
        console.error(`   - ${error.message}`);
      }
    } else if (error instanceof DatabaseConnectionError) {
      console.error('Database connection error:');
      console.error(`   - ${error.message}`);
      if (error.originalError) {
        console.error(`   - Original error: ${error.originalError.message}`);
      }
    } else if (error instanceof MeilisearchConnectionError) {
      console.error('Meilisearch connection error:');
      console.error(`   - ${error.message}`);
      if (error.originalError) {
        console.error(`   - Original error: ${error.originalError.message}`);
      }
    } else {
      console.error('Unexpected error:');
      console.error(`   - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.error('\nPlease fix the above issues and restart the application.\n');
    
    // Re-throw the error to stop application startup
    throw error;
  }
}

/**
 * Get current configuration (for runtime use)
 */
export function getCurrentConfig(): EnvironmentConfig {
  return validateEnvironmentVariables();
}
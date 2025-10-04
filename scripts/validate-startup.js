#!/usr/bin/env node

/**
 * Startup validation script for Docker containers
 * This script validates critical environment variables before the application starts
 * 
 * Usage:
 *   npm run validate-startup
 *   or
 *   node scripts/validate-startup.js
 */

// Required environment variables
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'MEILISEARCH_HOST'
];

// Optional environment variables with defaults
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  PORT: '3000',
  JWT_EXPIRES_IN: '8h',
  LOG_LEVEL: 'info'
};

function validateEnvironmentVariables() {
  console.log('📋 Validating environment variables...');
  
  const errors = [];
  const warnings = [];

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
      if (!['mysql:', 'postgresql:', 'postgres:'].includes(url.protocol)) {
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

  // Validate JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters. Consider using a longer secret for better security.');
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  // Throw error if validation failed
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error('Environment validation failed');
  }

  console.log('✅ Environment variables validated');
  
  return {
    nodeEnv,
    port,
    databaseUrl: databaseUrl,
    meilisearchHost: meilisearchHost,
    jwtSecret: jwtSecret,
    logLevel: process.env.LOG_LEVEL || OPTIONAL_ENV_VARS.LOG_LEVEL
  };
}

async function main() {
  console.log('🚀 Weekly Content Management System - Startup Validation');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Validate environment variables
    const config = validateEnvironmentVariables();

    console.log('📊 Configuration Summary:');
    console.log(`   - Environment: ${config.nodeEnv}`);
    console.log(`   - Port: ${config.port}`);
    console.log(`   - Database: ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
    console.log(`   - Meilisearch: ${config.meilisearchHost}`);
    console.log(`   - Log Level: ${config.logLevel}`);
    console.log('');

    console.log('✅ Startup validation completed successfully!');
    console.log('   The application is ready to start serving requests.');
    console.log('');

    // Exit with success code
    process.exit(0);

  } catch (error) {
    console.error('❌ Startup validation failed!');
    console.error('   The application cannot start with the current configuration.');
    console.error('');

    if (error instanceof Error) {
      console.error('Error details:');
      console.error(`   ${error.message}`);
    }

    console.error('');
    console.error('Please fix the configuration issues and try again.');
    console.error('');

    // Exit with error code
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
main();
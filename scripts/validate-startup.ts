#!/usr/bin/env tsx

/**
 * Startup validation script for Docker containers
 * This script validates the environment configuration and service connections
 * before the application starts serving requests.
 * 
 * Usage:
 *   npm run validate-startup
 *   or
 *   tsx scripts/validate-startup.ts
 */

import { validateApplicationStartup } from '../src/lib/config-validation';

async function main() {
  console.log('🚀 Weekly Content Management System - Startup Validation');
  console.log('=' .repeat(60));
  console.log('');

  try {
    // Run comprehensive startup validation
    const config = await validateApplicationStartup();

    console.log('📊 Configuration Summary:');
    console.log(`   - Environment: ${config.nodeEnv}`);
    console.log(`   - Port: ${config.port}`);
    console.log(`   - Database: ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
    console.log(`   - Meilisearch: ${config.meilisearchHost}`);
    console.log(`   - Image Upload: ${config.imageUploadUrl ? 'Configured' : 'Not configured'}`);
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
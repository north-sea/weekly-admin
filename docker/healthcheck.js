#!/usr/bin/env node

/**
 * Docker health check script
 * This script is used by Docker to check if the container is healthy
 * It validates both the application startup and service connections
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health/startup',
  method: 'GET',
  timeout: 10000, // 10 second timeout
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200 && response.success && response.initialized) {
        console.log('✅ Health check passed - Application is healthy and initialized');
        process.exit(0);
      } else {
        console.error('❌ Health check failed - Application is not healthy');
        console.error(`Status: ${res.statusCode}`);
        console.error(`Response: ${data}`);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Health check failed - Invalid response format');
      console.error(`Response: ${data}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Health check failed - Connection error');
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Health check failed - Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();
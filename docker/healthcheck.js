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
  path: '/api/health',
  method: 'GET',
  timeout: 15000, // 15 second timeout to match Docker healthcheck
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200 && response.overall === 'healthy' && response.initialized) {
        // Log resource usage for monitoring
        if (response.resources) {
          console.log(`✅ Health check passed - Memory: ${response.resources.memory.percentage}%, CPU: ${response.resources.cpu.usage}%, Uptime: ${Math.round(response.resources.uptime/60)}min`);
          
          // Check for resource warnings
          const memoryThreshold = parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 80;
          const cpuThreshold = parseInt(process.env.CPU_WARNING_THRESHOLD) || 80;
          
          if (response.resources.memory.percentage > memoryThreshold) {
            console.warn(`⚠️  High memory usage: ${response.resources.memory.percentage}%`);
          }
          
          if (response.resources.cpu.usage > cpuThreshold) {
            console.warn(`⚠️  High CPU usage: ${response.resources.cpu.usage}%`);
          }
        } else {
          console.log('✅ Health check passed - Application is healthy and initialized');
        }
        
        // Log performance metrics
        if (response.performance) {
          console.log(`📊 Performance - Operations: ${response.performance.totalOperations}, Success Rate: ${response.performance.successRate}%`);
        }
        
        // Log error statistics
        if (response.errors && response.errors.recentErrors > 0) {
          console.warn(`⚠️  Recent errors: ${response.errors.recentErrors}`);
        }
        
        process.exit(0);
      } else {
        console.error('❌ Health check failed - Application is not healthy');
        console.error(`Status: ${res.statusCode}, Overall: ${response.overall}`);
        
        // Log service status details
        if (response.services) {
          Object.entries(response.services).forEach(([service, status]) => {
            if (status.status !== 'healthy') {
              console.error(`  ${service}: ${status.status} - ${status.message}`);
            }
          });
        }
        
        // Log error details if available
        if (response.errors && response.errors.recentErrors > 0) {
          console.error(`Recent errors: ${response.errors.recentErrors}`);
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Health check failed - Invalid response format');
      console.error(`Response: ${data}`);
      console.error(`Parse error: ${error.message}`);
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
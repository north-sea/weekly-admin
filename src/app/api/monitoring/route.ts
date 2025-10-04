import { NextRequest, NextResponse } from 'next/server';
import { resourceMonitor } from '@/lib/monitoring/resource-monitor';
import { performanceMonitor } from '@/lib/monitoring/performance';
import { errorTracker } from '@/lib/monitoring/error-tracker';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeframe = parseInt(url.searchParams.get('timeframe') || '30'); // minutes
    
    // Get resource statistics
    const resourceStats = resourceMonitor.getStats(timeframe);
    const currentResources = resourceMonitor.getCurrentMetrics();
    
    // Get performance statistics
    const performanceStats = performanceMonitor.getStats();
    
    // Get error statistics
    const errorStats = errorTracker.getStats();
    const recentErrors = errorTracker.getRecentErrors(timeframe);
    
    const monitoringData = {
      timestamp: new Date().toISOString(),
      timeframe: `${timeframe} minutes`,
      resources: {
        current: currentResources ? {
          memory: {
            used: Math.round(currentResources.memory.used / 1024 / 1024), // MB
            total: Math.round(currentResources.memory.total / 1024 / 1024), // MB
            percentage: Math.round(currentResources.memory.percentage),
            heapUsed: Math.round(currentResources.memory.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(currentResources.memory.heapTotal / 1024 / 1024), // MB
          },
          cpu: {
            usage: Math.round(currentResources.cpu.usage),
          },
          process: {
            pid: currentResources.process.pid,
            uptime: Math.round(currentResources.process.uptime),
            version: currentResources.process.version,
          },
          system: {
            loadAverage: currentResources.system.loadAverage,
            platform: currentResources.system.platform,
            arch: currentResources.system.arch,
          },
        } : null,
        stats: {
          avgMemoryUsage: Math.round(resourceStats.avgMemoryUsage),
          maxMemoryUsage: Math.round(resourceStats.maxMemoryUsage),
          avgCpuUsage: Math.round(resourceStats.avgCpuUsage),
          maxCpuUsage: Math.round(resourceStats.maxCpuUsage),
          dataPoints: resourceStats.dataPoints,
        },
      },
      performance: {
        totalOperations: performanceStats.count,
        averageDuration: Math.round(performanceStats.avgDuration),
        minDuration: Math.round(performanceStats.minDuration),
        maxDuration: Math.round(performanceStats.maxDuration),
        successRate: Math.round(performanceStats.successRate * 100),
      },
      errors: {
        total: errorStats.totalErrors,
        recent: errorStats.recentErrors,
        bySeverity: errorStats.errorsBySeverity,
        topErrors: errorStats.errorsByFingerprint.slice(0, 10), // Top 10 most frequent errors
        recentErrorDetails: recentErrors.map(error => ({
          id: error.id,
          timestamp: error.timestamp,
          name: error.error.name,
          message: error.error.message,
          severity: error.severity,
          fingerprint: error.fingerprint,
          context: error.context,
        })),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        version: process.env.APP_VERSION || 'unknown',
        platform: process.platform,
        nodeVersion: process.version,
      },
    };

    logger.debug('Monitoring data requested', {
      timeframe,
      resourceDataPoints: resourceStats.dataPoints,
      totalErrors: errorStats.totalErrors,
      type: 'monitoring_request',
    });

    return NextResponse.json(monitoringData);
    
  } catch (error) {
    logger.error('Failed to get monitoring data', {
      type: 'monitoring_error',
    }, error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json({
      error: 'Failed to retrieve monitoring data',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// POST endpoint to update monitoring configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.resourceThresholds) {
      resourceMonitor.updateThresholds(body.resourceThresholds);
      logger.info('Resource monitoring thresholds updated', {
        thresholds: body.resourceThresholds,
        type: 'monitoring_config_update',
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Monitoring configuration updated',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Failed to update monitoring configuration', {
      type: 'monitoring_config_error',
    }, error instanceof Error ? error : new Error(String(error)));
    
    return NextResponse.json({
      error: 'Failed to update monitoring configuration',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
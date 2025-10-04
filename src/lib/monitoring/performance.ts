/**
 * Performance monitoring utilities for containerized environment
 */

import { logger } from '../logger';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics in memory

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Measure execution time of a function
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await fn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = performance.now() - startTime;
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        success,
        error,
        metadata,
      });
    }
  }

  // Measure synchronous operations
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const startTime = performance.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = fn();
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = performance.now() - startTime;
      this.recordMetric({
        operation,
        duration,
        timestamp: new Date().toISOString(),
        success,
        error,
        metadata,
      });
    }
  }

  private recordMetric(metric: PerformanceMetrics): void {
    // Add to in-memory store
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log performance metric
    logger.performance(metric.operation, metric.duration, {
      success: metric.success,
      error: metric.error,
      ...metric.metadata,
    });

    // Alert on slow operations
    if (metric.duration > 5000) { // 5 seconds
      logger.warn(`Slow operation detected: ${metric.operation}`, {
        duration: metric.duration,
        operation: metric.operation,
        type: 'performance_alert',
      });
    }
  }

  // Get performance statistics
  getStats(operation?: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  } {
    const filteredMetrics = operation 
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
      };
    }

    const durations = filteredMetrics.map(m => m.duration);
    const successCount = filteredMetrics.filter(m => m.success).length;

    return {
      count: filteredMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successCount / filteredMetrics.length,
    };
  }

  // Get recent metrics for health checks
  getRecentMetrics(minutes: number = 5): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => new Date(m.timestamp) > cutoff);
  }

  // Clear metrics (useful for testing)
  clear(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Decorator for measuring method performance
export function measurePerformance(operation?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const operationName = operation || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measure(operationName, () => method.apply(this, args));
    };
  };
}
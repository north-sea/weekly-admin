/**
 * Container resource monitoring for production environments
 */

import { logger } from '../logger';

export interface ResourceMetrics {
  timestamp: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    usage: number; // CPU usage percentage (approximated)
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
  };
  system: {
    loadAverage: number[];
    platform: string;
    arch: string;
  };
}

export interface ResourceThresholds {
  memoryWarning: number; // Memory usage percentage to trigger warning
  memoryCritical: number; // Memory usage percentage to trigger critical alert
  cpuWarning: number; // CPU usage percentage to trigger warning
  cpuCritical: number; // CPU usage percentage to trigger critical alert
}

export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private metrics: ResourceMetrics[] = [];
  private maxMetrics = 100; // Keep last 100 metrics in memory
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCpuUsage = process.cpuUsage();
  private lastTimestamp = Date.now();

  private thresholds: ResourceThresholds = {
    memoryWarning: 80, // 80%
    memoryCritical: 90, // 90%
    cpuWarning: 80, // 80%
    cpuCritical: 90, // 90%
  };

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  // Start monitoring resources at regular intervals
  startMonitoring(intervalMs: number = 30000): void { // Default: 30 seconds
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    logger.info('Starting resource monitoring', { intervalMs });

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Collect initial metrics
    this.collectMetrics();
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Stopped resource monitoring');
    }
  }

  // Collect current resource metrics
  collectMetrics(): ResourceMetrics {
    const memoryUsage = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage();
    const currentTimestamp = Date.now();

    // Calculate CPU usage percentage (approximation)
    const cpuDelta = {
      user: currentCpuUsage.user - this.lastCpuUsage.user,
      system: currentCpuUsage.system - this.lastCpuUsage.system,
    };
    const timeDelta = currentTimestamp - this.lastTimestamp;
    const cpuUsage = ((cpuDelta.user + cpuDelta.system) / (timeDelta * 1000)) * 100;

    this.lastCpuUsage = currentCpuUsage;
    this.lastTimestamp = currentTimestamp;

    // Get system information
    const loadAverage = process.platform === 'linux' ? require('os').loadavg() : [0, 0, 0];
    
    // Estimate total memory (in containerized environments, this might be the container limit)
    const totalMemory = this.getTotalMemory();
    const memoryPercentage = (memoryUsage.rss / totalMemory) * 100;

    const metrics: ResourceMetrics = {
      timestamp: new Date().toISOString(),
      memory: {
        used: memoryUsage.rss,
        total: totalMemory,
        percentage: memoryPercentage,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      cpu: {
        usage: Math.max(0, Math.min(100, cpuUsage)), // Clamp between 0-100
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
      },
      system: {
        loadAverage,
        platform: process.platform,
        arch: process.arch,
      },
    };

    // Store metrics
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log metrics
    logger.debug('Resource metrics collected', {
      memoryUsage: `${Math.round(memoryPercentage)}%`,
      memoryMB: Math.round(memoryUsage.rss / 1024 / 1024),
      cpuUsage: `${Math.round(cpuUsage)}%`,
      uptime: Math.round(process.uptime()),
      type: 'resource_metrics',
    });

    // Check thresholds and alert if necessary
    this.checkThresholds(metrics);

    return metrics;
  }

  // Get total available memory (try to detect container limits)
  private getTotalMemory(): number {
    try {
      // Try to read container memory limit
      const fs = require('fs');
      const memoryLimitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      
      if (fs.existsSync(memoryLimitPath)) {
        const limit = parseInt(fs.readFileSync(memoryLimitPath, 'utf8').trim());
        // If limit is reasonable (not the default huge value), use it
        if (limit < 9223372036854775807) { // Max value indicates no limit
          return limit;
        }
      }
    } catch (error) {
      // Fallback to system memory
    }

    // Fallback to system total memory
    return require('os').totalmem();
  }

  // Check resource thresholds and alert
  private checkThresholds(metrics: ResourceMetrics): void {
    const { memory, cpu } = metrics;

    // Memory threshold checks
    if (memory.percentage >= this.thresholds.memoryCritical) {
      logger.warn('Critical memory usage detected', {
        memoryPercentage: memory.percentage,
        memoryUsedMB: Math.round(memory.used / 1024 / 1024),
        threshold: this.thresholds.memoryCritical,
        type: 'resource_alert',
        severity: 'critical',
      });
    } else if (memory.percentage >= this.thresholds.memoryWarning) {
      logger.warn('High memory usage detected', {
        memoryPercentage: memory.percentage,
        memoryUsedMB: Math.round(memory.used / 1024 / 1024),
        threshold: this.thresholds.memoryWarning,
        type: 'resource_alert',
        severity: 'warning',
      });
    }

    // CPU threshold checks
    if (cpu.usage >= this.thresholds.cpuCritical) {
      logger.warn('Critical CPU usage detected', {
        cpuUsage: cpu.usage,
        threshold: this.thresholds.cpuCritical,
        type: 'resource_alert',
        severity: 'critical',
      });
    } else if (cpu.usage >= this.thresholds.cpuWarning) {
      logger.warn('High CPU usage detected', {
        cpuUsage: cpu.usage,
        threshold: this.thresholds.cpuWarning,
        type: 'resource_alert',
        severity: 'warning',
      });
    }
  }

  // Get current resource usage
  getCurrentMetrics(): ResourceMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  // Get resource statistics over time
  getStats(minutes: number = 30): {
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    avgCpuUsage: number;
    maxCpuUsage: number;
    dataPoints: number;
  } {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => new Date(m.timestamp) > cutoff);

    if (recentMetrics.length === 0) {
      return {
        avgMemoryUsage: 0,
        maxMemoryUsage: 0,
        avgCpuUsage: 0,
        maxCpuUsage: 0,
        dataPoints: 0,
      };
    }

    const memoryUsages = recentMetrics.map(m => m.memory.percentage);
    const cpuUsages = recentMetrics.map(m => m.cpu.usage);

    return {
      avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      maxMemoryUsage: Math.max(...memoryUsages),
      avgCpuUsage: cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length,
      maxCpuUsage: Math.max(...cpuUsages),
      dataPoints: recentMetrics.length,
    };
  }

  // Update monitoring thresholds
  updateThresholds(thresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Resource monitoring thresholds updated', { thresholds: this.thresholds });
  }

  // Get all metrics (for debugging)
  getAllMetrics(): ResourceMetrics[] {
    return [...this.metrics];
  }

  // Clear metrics (useful for testing)
  clear(): void {
    this.metrics = [];
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  resourceMonitor.startMonitoring(30000); // Monitor every 30 seconds
}
/**
 * Error tracking and monitoring for containerized environment
 */

import { logger } from '../logger';

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export interface TrackedError {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fingerprint: string; // For grouping similar errors
}

export class ErrorTracker {
  private static instance: ErrorTracker;
  private errors: TrackedError[] = [];
  private maxErrors = 100; // Reduced from 500 to 100 to prevent memory leaks
  private errorCounts = new Map<string, number>(); // Track error frequency
  private lastCleanup = Date.now(); // Track last cleanup time
  private cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  // Track an error with context
  track(error: Error, context: ErrorContext = {}, severity: TrackedError['severity'] = 'medium'): string {
    const errorId = crypto.randomUUID();
    const fingerprint = this.generateFingerprint(error);
    
    const trackedError: TrackedError = {
      id: errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      severity,
      fingerprint,
    };

    // Add to in-memory store
    this.errors.push(trackedError);
    
    // Clean up old errors if needed
    this.cleanupOldErrors();
    
    // Enforce memory limit
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Update error frequency
    const currentCount = this.errorCounts.get(fingerprint) || 0;
    this.errorCounts.set(fingerprint, currentCount + 1);

    // Log the error
    logger.error(`${error.name}: ${error.message}`, {
      errorId,
      fingerprint,
      severity,
      frequency: currentCount + 1,
      ...context,
    }, error);

    // Alert on critical errors or high frequency
    if (severity === 'critical' || currentCount > 10) {
      this.alertOnError(trackedError, currentCount + 1);
    }

    return errorId;
  }

  // Generate a fingerprint for grouping similar errors
  private generateFingerprint(error: Error): string {
    // Create a hash based on error name and the first few lines of stack trace
    const stackLines = error.stack?.split('\n').slice(0, 3).join('\n') || '';
    const content = `${error.name}:${error.message}:${stackLines}`;
    
    // Simple hash function (in production, consider using a proper hash library)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  // Alert on critical errors
  private alertOnError(error: TrackedError, frequency: number): void {
    logger.warn('Error alert triggered', {
      errorId: error.id,
      fingerprint: error.fingerprint,
      severity: error.severity,
      frequency,
      errorName: error.error.name,
      errorMessage: error.error.message,
      type: 'error_alert',
    });
  }

  // Get error statistics
  getStats(): {
    totalErrors: number;
    errorsByFingerprint: Array<{ fingerprint: string; count: number; lastSeen: string }>;
    errorsBySeverity: Record<TrackedError['severity'], number>;
    recentErrors: number; // Last hour
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentErrors = this.errors.filter(e => new Date(e.timestamp) > oneHourAgo).length;
    
    const errorsBySeverity = this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<TrackedError['severity'], number>);

    const errorsByFingerprint = Array.from(this.errorCounts.entries()).map(([fingerprint, count]) => {
      const lastError = this.errors.filter(e => e.fingerprint === fingerprint).pop();
      return {
        fingerprint,
        count,
        lastSeen: lastError?.timestamp || '',
      };
    }).sort((a, b) => b.count - a.count);

    return {
      totalErrors: this.errors.length,
      errorsByFingerprint,
      errorsBySeverity,
      recentErrors,
    };
  }

  // Get recent errors for debugging
  getRecentErrors(minutes: number = 30): TrackedError[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.errors.filter(e => new Date(e.timestamp) > cutoff);
  }

  // Get errors by fingerprint
  getErrorsByFingerprint(fingerprint: string): TrackedError[] {
    return this.errors.filter(e => e.fingerprint === fingerprint);
  }

  // Clean up errors older than 24 hours
  private cleanupOldErrors(): void {
    const now = Date.now();
    
    // Only cleanup every hour to avoid performance impact
    if (now - this.lastCleanup < 60 * 60 * 1000) {
      return;
    }
    
    const cutoffTime = new Date(now - this.cleanupInterval);
    const initialCount = this.errors.length;
    
    // Remove old errors
    this.errors = this.errors.filter(error => new Date(error.timestamp) > cutoffTime);
    
    // Recalculate error counts for remaining errors
    this.errorCounts.clear();
    this.errors.forEach(error => {
      const count = this.errorCounts.get(error.fingerprint) || 0;
      this.errorCounts.set(error.fingerprint, count + 1);
    });
    
    this.lastCleanup = now;
    
    // Log cleanup if significant number of errors were removed
    if (initialCount - this.errors.length > 10) {
      logger.info('Error tracker cleanup completed', {
        removedErrors: initialCount - this.errors.length,
        remainingErrors: this.errors.length,
        type: 'error_tracker_cleanup',
      });
    }
  }

  // Get memory usage statistics
  getMemoryStats(): {
    totalErrors: number;
    uniqueFingerprints: number;
    memoryUsage: string;
    oldestError?: string;
    newestError?: string;
  } {
    return {
      totalErrors: this.errors.length,
      uniqueFingerprints: this.errorCounts.size,
      memoryUsage: `~${Math.round((this.errors.length * 1024) / 1024)}KB`, // Rough estimation
      oldestError: this.errors[0]?.timestamp,
      newestError: this.errors[this.errors.length - 1]?.timestamp,
    };
  }

  // Clear errors (useful for testing)
  clear(): void {
    this.errors = [];
    this.errorCounts.clear();
    this.lastCleanup = Date.now();
  }
}

// Export singleton instance
export const errorTracker = ErrorTracker.getInstance();

// Global error handler for unhandled errors
if (typeof window === 'undefined') { // Server-side only
  process.on('uncaughtException', (error) => {
    errorTracker.track(error, { operation: 'uncaughtException' }, 'critical');
    logger.error('Uncaught exception', { type: 'uncaughtException' }, error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    errorTracker.track(error, { operation: 'unhandledRejection' }, 'critical');
    logger.error('Unhandled promise rejection', { type: 'unhandledRejection' }, error);
  });
}
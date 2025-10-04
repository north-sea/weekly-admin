import { validateApplicationStartup, EnvironmentConfig } from './config-validation';
import { resourceMonitor } from './monitoring/resource-monitor';
import { logger } from './logger';

// Global configuration cache
let cachedConfig: EnvironmentConfig | null = null;
let validationPromise: Promise<EnvironmentConfig> | null = null;

/**
 * Initialize application with configuration validation
 * This should be called once during application startup
 */
export async function initializeApplication(): Promise<EnvironmentConfig> {
  // Return cached config if already validated
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing validation promise if already in progress
  if (validationPromise) {
    return validationPromise;
  }

  // Start validation process
  validationPromise = validateApplicationStartup();

  try {
    cachedConfig = await validationPromise;
    
    // Initialize monitoring services in production
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      logger.info('Initializing monitoring services');
      
      // Start resource monitoring if enabled
      if (process.env.ENABLE_RESOURCE_MONITORING === 'true') {
        const interval = parseInt(process.env.RESOURCE_MONITORING_INTERVAL || '30000');
        resourceMonitor.startMonitoring(interval);
        logger.info('Resource monitoring started', { interval });
      }
      
      // Update monitoring thresholds if configured
      const thresholds = {
        memoryWarning: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '80'),
        memoryCritical: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD || '90'),
        cpuWarning: parseInt(process.env.CPU_WARNING_THRESHOLD || '80'),
        cpuCritical: parseInt(process.env.CPU_CRITICAL_THRESHOLD || '90'),
      };
      resourceMonitor.updateThresholds(thresholds);
      
      logger.info('Application startup completed successfully', {
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION || 'unknown',
        monitoring: process.env.ENABLE_RESOURCE_MONITORING === 'true',
      });
    }
    
    return cachedConfig;
  } catch (error) {
    // Reset promise on error so it can be retried
    validationPromise = null;
    logger.error('Application startup failed', {}, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get cached configuration (throws if not initialized)
 */
export function getApplicationConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    throw new Error('Application not initialized. Call initializeApplication() first.');
  }
  return cachedConfig;
}

/**
 * Check if application is initialized
 */
export function isApplicationInitialized(): boolean {
  return cachedConfig !== null;
}

/**
 * Reset application state (for testing purposes)
 */
export function resetApplicationState(): void {
  cachedConfig = null;
  validationPromise = null;
}
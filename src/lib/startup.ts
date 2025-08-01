import { validateApplicationStartup, EnvironmentConfig } from './config-validation';

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
    return cachedConfig;
  } catch (error) {
    // Reset promise on error so it can be retried
    validationPromise = null;
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
import IORedis from 'ioredis';

import { getCurrentConfig, type EnvironmentConfig } from '@/lib/config-validation';

export type JobRedisHealth =
  | { status: 'healthy'; prefix: string }
  | { status: 'disabled'; prefix: string; reason: string }
  | { status: 'degraded'; prefix: string; reason: string; error?: string };

export class JobRedisUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobRedisUnavailableError';
  }
}

let sharedConnection: IORedis | null = null;

export function getJobQueuePrefix(config: EnvironmentConfig = getCurrentConfig()): string {
  return config.jobQueuePrefix;
}

export function getJobRedisConnection(config: EnvironmentConfig = getCurrentConfig()): IORedis {
  if (config.jobQueueDisabled) {
    throw new JobRedisUnavailableError('Job queue is disabled');
  }
  if (!config.redisUrl) {
    throw new JobRedisUnavailableError('REDIS_URL is not configured');
  }

  if (!sharedConnection) {
    sharedConnection = new IORedis(config.redisUrl, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  return sharedConnection;
}

export async function checkJobRedisHealth(config: EnvironmentConfig = getCurrentConfig()): Promise<JobRedisHealth> {
  const prefix = getJobQueuePrefix(config);

  if (config.jobQueueDisabled) {
    return { status: 'disabled', prefix, reason: 'Job queue is disabled' };
  }
  if (!config.redisUrl) {
    return { status: 'degraded', prefix, reason: 'REDIS_URL is not configured' };
  }

  const redis = new IORedis(config.redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    await redis.ping();
    return { status: 'healthy', prefix };
  } catch (error) {
    return {
      status: 'degraded',
      prefix,
      reason: 'Redis health check failed',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    redis.disconnect();
  }
}

export function resetJobRedisConnectionForTests(): void {
  sharedConnection?.disconnect();
  sharedConnection = null;
}

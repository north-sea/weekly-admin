import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisInstances: Array<{
  url: string;
  options: Record<string, unknown>;
  connect: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];
let nextConnectError: Error | undefined;

vi.mock('ioredis', () => {
  const RedisMock = vi.fn(function RedisMock(url: string, options: Record<string, unknown>) {
    const instance = {
      url,
      options,
      connect: vi.fn().mockImplementation(() => {
        if (nextConnectError) return Promise.reject(nextConnectError);
        return Promise.resolve(undefined);
      }),
      ping: vi.fn().mockResolvedValue('PONG'),
      disconnect: vi.fn(),
    };
    redisInstances.push(instance);
    return instance;
  });

  return { default: RedisMock };
});

import {
  checkJobRedisHealth,
  getJobRedisConnection,
  JobRedisUnavailableError,
  resetJobRedisConnectionForTests,
} from './connection';
import type { EnvironmentConfig } from '@/lib/config-validation';

const baseConfig: EnvironmentConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'mysql://user:pass@localhost:3306/admin',
  meilisearchContentIndex: 'weekly_admin_contents',
  meilisearchSharedInstance: false,
  redisUrl: 'redis://localhost:6379',
  jobQueuePrefix: 'weekly-admin',
  jobQueueDisabled: false,
  jobQueueStatusTtlSeconds: 604800,
  jobTargetLockTtlSeconds: 3600,
  jobWorkerHeartbeatIntervalMs: 30000,
  jobWorkerHeartbeatTtlSeconds: 90,
  jwtSecret: 'x'.repeat(32),
  jwtExpiresIn: '8h',
};

describe('job Redis connection', () => {
  beforeEach(() => {
    redisInstances.length = 0;
    nextConnectError = undefined;
  });

  afterEach(() => {
    resetJobRedisConnectionForTests();
  });

  it('creates a shared BullMQ-compatible Redis connection', () => {
    const first = getJobRedisConnection(baseConfig);
    const second = getJobRedisConnection(baseConfig);

    expect(first).toBe(second);
    expect(redisInstances).toHaveLength(1);
    expect(redisInstances[0]).toMatchObject({
      url: 'redis://localhost:6379',
      options: expect.objectContaining({
        enableOfflineQueue: false,
        lazyConnect: true,
        maxRetriesPerRequest: null,
      }),
    });
  });

  it('throws when the job queue is disabled or Redis is not configured', () => {
    expect(() => getJobRedisConnection({ ...baseConfig, jobQueueDisabled: true })).toThrow(JobRedisUnavailableError);
    expect(() => getJobRedisConnection({ ...baseConfig, redisUrl: undefined })).toThrow(JobRedisUnavailableError);
  });

  it('reports disabled and not configured health without connecting', async () => {
    await expect(checkJobRedisHealth({ ...baseConfig, jobQueueDisabled: true })).resolves.toMatchObject({
      status: 'disabled',
    });
    await expect(checkJobRedisHealth({ ...baseConfig, redisUrl: undefined })).resolves.toMatchObject({
      status: 'degraded',
      reason: 'REDIS_URL is not configured',
    });
    expect(redisInstances).toHaveLength(0);
  });

  it('reports healthy and degraded Redis health', async () => {
    await expect(checkJobRedisHealth(baseConfig)).resolves.toMatchObject({ status: 'healthy' });

    redisInstances.length = 0;
    nextConnectError = new Error('connection refused');

    await expect(checkJobRedisHealth(baseConfig)).resolves.toMatchObject({
      status: 'degraded',
      reason: 'Redis health check failed',
      error: 'connection refused',
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfigValidationError, validateEnvironmentVariables } from './config-validation';

function stubRequiredEnv() {
  vi.stubEnv('DATABASE_URL', 'mysql://user:pass@localhost:3306/admin');
  vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
}

describe('validateEnvironmentVariables job queue config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns default job queue config when Redis is not configured', () => {
    stubRequiredEnv();

    expect(validateEnvironmentVariables()).toMatchObject({
      redisUrl: undefined,
      jobQueuePrefix: 'weekly-admin',
      jobQueueDisabled: false,
      jobQueueStatusTtlSeconds: 604800,
      jobTargetLockTtlSeconds: 3600,
      jobWorkerHeartbeatIntervalMs: 30000,
      jobWorkerHeartbeatTtlSeconds: 90,
    });
  });

  it('accepts Redis URL, disabled flag, prefix, and TTL overrides', () => {
    stubRequiredEnv();
    vi.stubEnv('REDIS_URL', 'rediss://redis.example.com:6380');
    vi.stubEnv('JOB_QUEUE_DISABLED', 'true');
    vi.stubEnv('JOB_QUEUE_PREFIX', 'admin:test');
    vi.stubEnv('JOB_QUEUE_STATUS_TTL_SECONDS', '60');
    vi.stubEnv('JOB_TARGET_LOCK_TTL_SECONDS', '120');
    vi.stubEnv('JOB_WORKER_HEARTBEAT_INTERVAL_MS', '1000');
    vi.stubEnv('JOB_WORKER_HEARTBEAT_TTL_SECONDS', '5');

    expect(validateEnvironmentVariables()).toMatchObject({
      redisUrl: 'rediss://redis.example.com:6380',
      jobQueueDisabled: true,
      jobQueuePrefix: 'admin:test',
      jobQueueStatusTtlSeconds: 60,
      jobTargetLockTtlSeconds: 120,
      jobWorkerHeartbeatIntervalMs: 1000,
      jobWorkerHeartbeatTtlSeconds: 5,
    });
  });

  it('rejects invalid Redis and job queue values', () => {
    stubRequiredEnv();
    vi.stubEnv('REDIS_URL', 'http://localhost:6379');
    vi.stubEnv('JOB_QUEUE_PREFIX', 'bad prefix');
    vi.stubEnv('JOB_QUEUE_STATUS_TTL_SECONDS', '0');
    vi.stubEnv('JOB_TARGET_LOCK_TTL_SECONDS', '-1');

    expect(() => validateEnvironmentVariables()).toThrow(ConfigValidationError);
    try {
      validateEnvironmentVariables();
    } catch (error) {
      expect((error as ConfigValidationError).details).toEqual(expect.arrayContaining([
        'Unsupported Redis protocol in REDIS_URL: http:',
        'JOB_QUEUE_PREFIX may only contain letters, numbers, colon, underscore, and hyphen',
        'Invalid JOB_QUEUE_STATUS_TTL_SECONDS: 0. Must be a positive integer',
        'Invalid JOB_TARGET_LOCK_TTL_SECONDS: -1. Must be a positive integer',
      ]));
    }
  });
});

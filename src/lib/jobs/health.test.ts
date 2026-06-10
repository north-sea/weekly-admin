import { describe, expect, it, vi } from 'vitest';

import type { EnvironmentConfig } from '@/lib/config-validation';
import {
  getJobWorkerHealth,
  type JobHealthQueue,
  type JobHealthRedis,
} from './health';
import { buildWorkerHeartbeatKey } from './worker';

const config: EnvironmentConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'mysql://user:password@localhost:3306/admin',
  meilisearchContentIndex: 'weekly_admin_contents',
  meilisearchSharedInstance: false,
  redisUrl: 'redis://localhost:6379',
  jobQueuePrefix: 'weekly-test',
  jobQueueDisabled: false,
  jobQueueStatusTtlSeconds: 60,
  jobTargetLockTtlSeconds: 3600,
  jobWorkerHeartbeatIntervalMs: 30_000,
  jobWorkerHeartbeatTtlSeconds: 90,
  jwtSecret: 'x'.repeat(32),
  jwtExpiresIn: '8h',
};

function buildRedis(heartbeats: Record<string, Record<string, unknown>>): JobHealthRedis {
  const values = new Map<string, string>();
  Object.entries(heartbeats).forEach(([workerId, heartbeat]) => {
    values.set(buildWorkerHeartbeatKey(config.jobQueuePrefix, workerId), JSON.stringify({
      workerId,
      ...heartbeat,
    }));
  });

  return {
    scan: vi.fn(async () => ['0', [...values.keys()]] as [string, string[]]),
    get: vi.fn(async (key: string) => values.get(key) ?? null),
  };
}

function buildQueue(input: {
  waiting?: number;
  delayed?: number;
  active?: number;
  failed?: number;
  oldestTimestamp?: number;
} = {}): JobHealthQueue {
  return {
    getJobCounts: vi.fn(async () => ({
      waiting: input.waiting ?? 0,
      delayed: input.delayed ?? 0,
      active: input.active ?? 0,
      failed: input.failed ?? 0,
    })),
    getJobs: vi.fn(async () => input.oldestTimestamp
      ? [{ id: 'auto_1', timestamp: input.oldestTimestamp }]
      : []),
  };
}

describe('job worker health', () => {
  it('returns healthy when queue is clear and worker heartbeat is fresh', async () => {
    await expect(getJobWorkerHealth({
      config,
      redis: buildRedis({
        'worker-a': { heartbeatAt: '2026-06-08T00:00:00.000Z' },
      }),
      queue: buildQueue(),
      now: () => new Date('2026-06-08T00:00:30.000Z'),
    })).resolves.toMatchObject({
      status: 'healthy',
      reason: null,
      workers: {
        count: 1,
        stale: 0,
      },
      queue: {
        waiting: 0,
        delayed: 0,
        active: 0,
        failed: 0,
        oldestQueuedAgeMs: null,
      },
      redis: {
        available: true,
      },
    });
  });

  it('returns degraded when a worker heartbeat is stale', async () => {
    await expect(getJobWorkerHealth({
      config,
      redis: buildRedis({
        'worker-a': { heartbeatAt: '2026-06-08T00:00:00.000Z' },
      }),
      queue: buildQueue(),
      now: () => new Date('2026-06-08T00:02:00.000Z'),
    })).resolves.toMatchObject({
      status: 'degraded',
      reason: 'Worker heartbeat is stale',
      workers: {
        count: 1,
        stale: 1,
      },
    });
  });

  it('returns degraded when queued jobs exceed the backlog threshold', async () => {
    await expect(getJobWorkerHealth({
      config,
      redis: buildRedis({
        'worker-a': { heartbeatAt: '2026-06-08T00:10:00.000Z' },
      }),
      queue: buildQueue({
        waiting: 1,
        oldestTimestamp: new Date('2026-06-08T00:00:00.000Z').getTime(),
      }),
      now: () => new Date('2026-06-08T00:10:00.000Z'),
      backlogDegradedAgeMs: 5 * 60 * 1000,
    })).resolves.toMatchObject({
      status: 'degraded',
      reason: 'Queued jobs are older than the backlog threshold',
      queue: {
        waiting: 1,
        oldestQueuedAgeMs: 10 * 60 * 1000,
      },
    });
  });

  it('returns degraded when Redis is unavailable', async () => {
    const redis: JobHealthRedis = {
      scan: vi.fn(async () => {
        throw new Error('redis down');
      }),
      get: vi.fn(),
    };

    await expect(getJobWorkerHealth({
      config,
      redis,
      queue: buildQueue(),
    })).resolves.toMatchObject({
      status: 'degraded',
      reason: 'Job queue health check failed',
      redis: {
        available: false,
        error: 'redis down',
      },
    });
  });
});

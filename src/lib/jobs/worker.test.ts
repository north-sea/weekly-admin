import { describe, expect, it, vi } from 'vitest';

import type { AutomationRunResult, AutomationRunSuccess } from '@/lib/automation/run';
import type { EnvironmentConfig } from '@/lib/config-validation';
import { buildJobLockKey } from './locks';
import {
  AUTOMATION_QUEUE_NAME,
  type AutomationJobTarget,
} from './definitions';
import {
  buildJobRuntimeStatusKey,
  buildWorkerHeartbeatKey,
  createAutomationWorker,
  processAutomationJob,
  type AutomationWorkerInstance,
  type AutomationWorkerJob,
  type JobWorkerRedis,
} from './worker';

class FakeRedis implements JobWorkerRedis {
  store = new Map<string, string>();
  ttl = new Map<string, number>();

  async set(key: string, value: string, mode: 'PX', ttlMs: number, condition?: 'NX'): Promise<'OK' | null> {
    if (mode !== 'PX') throw new Error('FakeRedis only supports PX');
    if (condition === 'NX' && this.store.has(key)) return null;
    this.store.set(key, value);
    this.ttl.set(key, ttlMs);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    this.ttl.delete(key);
    return existed ? 1 : 0;
  }

  async pexpire(key: string, ttlMs: number): Promise<number> {
    if (!this.store.has(key)) return 0;
    this.ttl.set(key, ttlMs);
    return 1;
  }
}

const testConfig: EnvironmentConfig = {
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

const target: AutomationJobTarget = {
  targetType: 'data_source',
  targetId: '7',
  targetKey: 'data_source:7',
};

function buildJob(overrides: Partial<AutomationWorkerJob> = {}): AutomationWorkerJob {
  return {
    id: 'auto_1',
    name: 'sync.run',
    attemptsMade: 0,
    opts: { attempts: 2 },
    data: {
      runId: 'auto_1',
      workflow: 'sync',
      step: 'run',
      target,
      payload: { sourceId: 7 },
    },
    ...overrides,
  };
}

async function seedLock(redis: FakeRedis, runId = 'auto_1') {
  await redis.set(
    buildJobLockKey(testConfig.jobQueuePrefix, 'sync', target.targetKey),
    JSON.stringify({
      runId,
      workflow: 'sync',
      targetKey: target.targetKey,
      acquiredAt: '2026-06-08T00:00:00.000Z',
    }),
    'PX',
    60_000
  );
}

function readStatus(redis: FakeRedis) {
  return JSON.parse(redis.store.get(buildJobRuntimeStatusKey(testConfig.jobQueuePrefix, 'auto_1')) ?? '{}') as Record<string, unknown>;
}

function readHeartbeat(redis: FakeRedis, workerId = 'worker-a') {
  return JSON.parse(redis.store.get(buildWorkerHeartbeatKey(testConfig.jobQueuePrefix, workerId)) ?? '{}') as Record<string, unknown>;
}

describe('automation worker lifecycle', () => {
  it('marks a queued run running, executes the job, completes the run, and releases the lock', async () => {
    const redis = new FakeRedis();
    await seedLock(redis);
    const calls: string[] = [];
    const outcome: AutomationRunSuccess<Record<string, unknown>> = {
      status: 'succeeded',
      result: { ok: true },
    };
    const completion: AutomationRunResult<Record<string, unknown>> = {
      runId: 'auto_1',
      status: 'succeeded',
      result: { ok: true },
      idempotentReplay: false,
    };

    const result = await processAutomationJob(buildJob(), {
      config: testConfig,
      redis,
      workerId: 'worker-a',
      now: () => new Date('2026-06-08T00:00:00.000Z'),
      markRunRunning: vi.fn(async () => {
        calls.push('running');
      }),
      executeJob: vi.fn(async () => {
        calls.push('execute');
        return outcome;
      }),
      completeRun: vi.fn(async () => {
        calls.push('complete');
        return completion;
      }),
    });

    expect(result).toEqual(completion);
    expect(calls).toEqual(['running', 'execute', 'complete']);
    expect(readStatus(redis)).toMatchObject({
      runId: 'auto_1',
      jobName: 'sync.run',
      status: 'succeeded',
      phase: 'completed',
      workerId: 'worker-a',
      result: { ok: true },
    });
    expect(redis.store.has(buildWorkerHeartbeatKey(testConfig.jobQueuePrefix, 'worker-a'))).toBe(true);
    expect(readHeartbeat(redis)).toMatchObject({
      workerId: 'worker-a',
      currentRunId: 'auto_1',
      currentJobName: 'sync.run',
    });
    expect(redis.ttl.get(buildWorkerHeartbeatKey(testConfig.jobQueuePrefix, 'worker-a'))).toBe(90_000);
    expect(redis.ttl.get(buildJobRuntimeStatusKey(testConfig.jobQueuePrefix, 'auto_1'))).toBe(60_000);
    expect(redis.store.has(buildJobLockKey(testConfig.jobQueuePrefix, 'sync', target.targetKey))).toBe(false);
  });

  it('marks the run failed and releases the lock after the final attempt fails', async () => {
    const redis = new FakeRedis();
    await seedLock(redis);
    const error = new Error('worker boom');
    const failRun = vi.fn(async () => undefined);

    await expect(processAutomationJob(buildJob({ attemptsMade: 1 }), {
      config: testConfig,
      redis,
      workerId: 'worker-a',
      markRunRunning: vi.fn(async () => undefined),
      executeJob: vi.fn(async () => {
        throw error;
      }),
      failRun,
    })).rejects.toThrow('worker boom');

    expect(failRun).toHaveBeenCalledWith('auto_1', error);
    expect(readStatus(redis)).toMatchObject({
      status: 'failed',
      phase: 'failed',
      attemptsMade: 2,
      attempts: 2,
      retryable: false,
      error: 'worker boom',
    });
    expect(redis.store.has(buildJobLockKey(testConfig.jobQueuePrefix, 'sync', target.targetKey))).toBe(false);
  });

  it('keeps the run active and refreshes the lock before BullMQ retries a failed attempt', async () => {
    const redis = new FakeRedis();
    await seedLock(redis);
    const failRun = vi.fn(async () => undefined);

    await expect(processAutomationJob(buildJob({ attemptsMade: 0 }), {
      config: testConfig,
      redis,
      workerId: 'worker-a',
      now: () => new Date('2026-06-08T00:01:00.000Z'),
      markRunRunning: vi.fn(async () => undefined),
      executeJob: vi.fn(async () => {
        throw new Error('temporary failure');
      }),
      failRun,
    })).rejects.toThrow('temporary failure');

    expect(failRun).not.toHaveBeenCalled();
    expect(readStatus(redis)).toMatchObject({
      status: 'retrying',
      phase: 'retrying',
      attemptsMade: 1,
      attempts: 2,
      retryable: true,
      error: 'temporary failure',
    });
    const lockValue = JSON.parse(redis.store.get(buildJobLockKey(testConfig.jobQueuePrefix, 'sync', target.targetKey)) ?? '{}');
    expect(lockValue).toMatchObject({
      runId: 'auto_1',
      heartbeatAt: '2026-06-08T00:01:00.000Z',
    });
    expect(redis.ttl.get(buildJobLockKey(testConfig.jobQueuePrefix, 'sync', target.targetKey))).toBe(90_000);
  });

  it('constructs a BullMQ worker with queue wiring, idle heartbeat, and lifecycle events', async () => {
    const redis = new FakeRedis();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const fakeWorker: AutomationWorkerInstance = {
      close: vi.fn(async () => undefined),
      on: (event, listener) => {
        listeners.set(event, listener);
        return fakeWorker;
      },
    };
    let capturedProcessor: ((job: AutomationWorkerJob) => Promise<unknown>) | undefined;
    const workerFactory: NonNullable<Parameters<typeof createAutomationWorker>[0]>['workerFactory'] = (
      queueName,
      processor,
      options
    ) => {
      expect(queueName).toBe(AUTOMATION_QUEUE_NAME);
      expect(options).toMatchObject({
        prefix: testConfig.jobQueuePrefix,
        concurrency: 3,
      });
      capturedProcessor = processor;
      return fakeWorker;
    };

    const worker = createAutomationWorker({
      config: testConfig,
      redis,
      workerId: 'worker-a',
      concurrency: 3,
      workerFactory,
      logger,
    });

    await Promise.resolve();

    expect(redis.store.has(buildWorkerHeartbeatKey(testConfig.jobQueuePrefix, 'worker-a'))).toBe(true);
    const heartbeat = readHeartbeat(redis);
    expect(heartbeat).toMatchObject({
      workerId: 'worker-a',
    });
    expect(heartbeat).not.toHaveProperty('currentRunId');
    expect(heartbeat).not.toHaveProperty('currentJobName');
    expect(capturedProcessor).toBeTypeOf('function');
    expect(listeners.has('completed')).toBe(true);
    expect(listeners.has('failed')).toBe(true);
    expect(listeners.has('error')).toBe(true);

    listeners.get('completed')?.({ id: 'job-1' }, { ok: true });
    listeners.get('failed')?.({ id: 'job-1' }, new Error('boom'));
    listeners.get('error')?.(new Error('redis down'));

    expect(logger.info).toHaveBeenCalledWith('[automation-worker] job completed', {
      jobId: 'job-1',
      result: { ok: true },
    });
    expect(logger.error).toHaveBeenCalledTimes(2);

    await worker.close();
    expect(fakeWorker.close).toHaveBeenCalledWith(undefined);
  });
});

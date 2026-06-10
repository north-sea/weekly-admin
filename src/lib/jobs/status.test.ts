// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    automation_runs: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { buildJobRuntimeStatusKey } from './worker';
import { getAutomationJobStatus, type JobStatusQueue, type JobStatusRedis } from './status';

const prefix = 'weekly-test';

function buildRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auto_1',
    workflow: 'score',
    step: 'run',
    status: 'queued',
    target_type: 'inbox',
    target_id: 'score_batch',
    result_summary: null,
    error_code: null,
    error_message: null,
    started_at: new Date('2026-06-08T00:00:00.000Z'),
    finished_at: null,
    ...overrides,
  };
}

function buildRedis(value: string | null): JobStatusRedis {
  return {
    get: vi.fn(async () => value),
  };
}

function buildQueue(state: string | null, attemptsMade = 0, attempts = 2): JobStatusQueue {
  return {
    getJob: vi.fn(async () => state
      ? {
          id: 'auto_1',
          attemptsMade,
          opts: { attempts },
          getState: async () => state,
        }
      : null),
  };
}

describe('automation job status reader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges durable run history, Redis runtime snapshot, and BullMQ job state', async () => {
    findUniqueMock.mockResolvedValueOnce(buildRun({ status: 'running' }));
    const snapshot = {
      runId: 'auto_1',
      jobId: 'auto_1',
      jobName: 'score.run',
      workflow: 'score',
      step: 'run',
      target: {
        targetType: 'inbox',
        targetId: 'score_batch',
        targetKey: 'inbox:score_batch',
      },
      status: 'retrying',
      phase: 'retrying',
      attemptsMade: 1,
      attempts: 2,
      workerId: 'worker-a',
      updatedAt: '2026-06-08T00:01:00.000Z',
      retryable: true,
      error: 'temporary failure',
    };
    const redis = buildRedis(JSON.stringify(snapshot));
    const queue = buildQueue('delayed', 1, 2);

    await expect(getAutomationJobStatus('auto_1', { prefix, redis, queue })).resolves.toMatchObject({
      runId: 'auto_1',
      status: 'retrying',
      durableStatus: 'running',
      historyOnly: false,
      redis: {
        available: true,
        statusExpired: false,
        snapshot,
      },
      queue: {
        available: true,
        state: 'delayed',
        attemptsMade: 1,
        attempts: 2,
      },
    });
    expect(redis.get).toHaveBeenCalledWith(buildJobRuntimeStatusKey(prefix, 'auto_1'));
  });

  it('returns history-only status when Redis status expired', async () => {
    findUniqueMock.mockResolvedValueOnce(buildRun({
      status: 'succeeded',
      result_summary: { scored: 3 },
      finished_at: new Date('2026-06-08T00:02:00.000Z'),
    }));

    await expect(getAutomationJobStatus('auto_1', {
      prefix,
      redis: buildRedis(null),
      queue: buildQueue(null),
    })).resolves.toMatchObject({
      status: 'succeeded',
      durableStatus: 'succeeded',
      historyOnly: true,
      resultSummary: { scored: 3 },
      redis: {
        available: true,
        statusExpired: true,
      },
      queue: {
        available: true,
        state: null,
      },
    });
  });

  it('preserves durable failed run evidence even when Redis is unavailable', async () => {
    findUniqueMock.mockResolvedValueOnce(buildRun({
      status: 'failed',
      error_code: 'TypeError',
      error_message: 'worker boom',
      finished_at: new Date('2026-06-08T00:03:00.000Z'),
    }));
    const redis: JobStatusRedis = {
      get: vi.fn(async () => {
        throw new Error('redis down');
      }),
    };

    await expect(getAutomationJobStatus('auto_1', {
      prefix,
      redis,
      queue: buildQueue(null),
    })).resolves.toMatchObject({
      status: 'failed',
      durableStatus: 'failed',
      historyOnly: true,
      errorCode: 'TypeError',
      errorMessage: 'worker boom',
      redis: {
        available: false,
        statusExpired: true,
        error: 'redis down',
      },
    });
  });

  it('falls back to BullMQ active state for non-terminal runs without Redis snapshot', async () => {
    findUniqueMock.mockResolvedValueOnce(buildRun({ status: 'queued' }));

    await expect(getAutomationJobStatus('auto_1', {
      prefix,
      redis: buildRedis(null),
      queue: buildQueue('active', 0, 2),
    })).resolves.toMatchObject({
      status: 'running',
      durableStatus: 'queued',
      historyOnly: true,
      queue: {
        state: 'active',
      },
    });
  });

  it('returns null when the durable automation run does not exist', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(getAutomationJobStatus('missing', {
      prefix,
      redis: buildRedis(null),
      queue: buildQueue(null),
    })).resolves.toBeNull();
  });
});

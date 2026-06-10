import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOrReplayQueuedAutomationRunMock = vi.fn();
const failAutomationRunMock = vi.fn();

vi.mock('@/lib/automation/run', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/run')>('@/lib/automation/run');
  return {
    ...actual,
    createOrReplayQueuedAutomationRun: (...args: unknown[]) => createOrReplayQueuedAutomationRunMock(...args),
    failAutomationRun: (...args: unknown[]) => failAutomationRunMock(...args),
  };
});

import { JobSubmissionError, submitAutomationJob, type QueueLike } from './submit';
import type { JobLockRedis } from './locks';
import type { JobRateLimitRedis } from './rate-limit';
import type { AutomationCaller } from '@/lib/automation/auth';

type FakeRedis = JobLockRedis & JobRateLimitRedis & {
  strings: Map<string, string>;
  counts: Map<string, number>;
};

const caller: AutomationCaller = {
  tokenId: 1,
  name: 'n8n',
  callerType: 'n8n',
  tokenPrefix: 'wa_n8n',
  scopes: ['score:run', 'sync:run'],
};

function createRedis(): FakeRedis {
  const strings = new Map<string, string>();
  const counts = new Map<string, number>();

  return {
    strings,
    counts,
    set: vi.fn(async (key: string, value: string, _mode: 'PX', _ttlMs: number, condition?: 'NX') => {
      if (condition === 'NX' && strings.has(key)) return null;
      strings.set(key, value);
      return 'OK' as const;
    }),
    get: vi.fn(async (key: string) => strings.get(key) ?? null),
    del: vi.fn(async (key: string) => (strings.delete(key) ? 1 : 0)),
    pexpire: vi.fn(async () => 1),
    incr: vi.fn(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    pttl: vi.fn(async () => 60_000),
  };
}

describe('submitAutomationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failAutomationRunMock.mockResolvedValue(undefined);
  });

  it('creates a queued run, acquires control keys, and adds a BullMQ job', async () => {
    createOrReplayQueuedAutomationRunMock.mockResolvedValueOnce({
      runId: 'auto_1',
      status: 'queued',
      idempotentReplay: false,
    });
    const redis = createRedis();
    const queue: QueueLike = { add: vi.fn(async () => ({ id: 'auto_1' })) };

    await expect(submitAutomationJob({
      caller,
      jobName: 'score.run',
      idempotencyKey: 'score-1',
      payload: { limit: 50, delay: 0 },
    }, { redis, queue, prefix: 'weekly-admin' })).resolves.toMatchObject({
      runId: 'auto_1',
      jobId: 'auto_1',
      status: 'queued',
      workflow: 'score',
      step: 'run',
      target: {
        targetType: 'inbox',
        targetId: 'score_batch',
        targetKey: 'inbox:score_batch',
      },
      statusUrl: '/api/v1/jobs/auto_1',
      idempotentReplay: false,
      caller: {
        type: 'n8n',
        tokenPrefix: 'wa_n8n',
      },
    });

    expect(createOrReplayQueuedAutomationRunMock).toHaveBeenCalledWith(expect.objectContaining({
      caller,
      workflow: 'score',
      step: 'run',
      targetType: 'inbox',
      targetId: 'score_batch',
      idempotencyKey: 'score-1',
      requestPayload: { limit: 50, delay: 0 },
    }));
    expect(queue.add).toHaveBeenCalledWith('score.run', expect.objectContaining({
      runId: 'auto_1',
      workflow: 'score',
      payload: { limit: 50, delay: 0 },
    }), expect.objectContaining({
      jobId: 'auto_1',
      attempts: 2,
    }));
    expect(redis.set).toHaveBeenCalledWith(
      'weekly-admin:lock:score:inbox:score_batch',
      expect.any(String),
      'PX',
      60 * 60 * 1000,
      'NX'
    );
  });

  it('returns idempotent queued replay without enqueueing again', async () => {
    createOrReplayQueuedAutomationRunMock.mockResolvedValueOnce({
      runId: 'auto_1',
      status: 'queued',
      idempotentReplay: true,
    });
    const queue: QueueLike = { add: vi.fn() };

    await expect(submitAutomationJob({
      caller,
      jobName: 'score.run',
      idempotencyKey: 'score-1',
      payload: { limit: 50 },
    }, { queue, prefix: 'weekly-admin' })).resolves.toMatchObject({
      runId: 'auto_1',
      idempotentReplay: true,
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('marks the run failed when enqueue fails', async () => {
    createOrReplayQueuedAutomationRunMock.mockResolvedValueOnce({
      runId: 'auto_1',
      status: 'queued',
      idempotentReplay: false,
    });
    const redis = createRedis();
    const queue: QueueLike = { add: vi.fn(async () => { throw new Error('queue down'); }) };

    await expect(submitAutomationJob({
      caller,
      jobName: 'score.run',
      idempotencyKey: 'score-1',
      payload: { limit: 50 },
    }, { redis, queue, prefix: 'weekly-admin' })).rejects.toThrow('queue down');

    expect(failAutomationRunMock).toHaveBeenCalledWith('auto_1', expect.any(Error));
    expect(redis.strings.has('weekly-admin:lock:score:inbox:score_batch')).toBe(false);
  });

  it('rejects Redis unavailable rate limit without silently allowing a job', async () => {
    createOrReplayQueuedAutomationRunMock.mockResolvedValueOnce({
      runId: 'auto_1',
      status: 'queued',
      idempotentReplay: false,
    });
    const redis = createRedis();
    vi.mocked(redis.incr).mockRejectedValueOnce(new Error('redis down'));
    const queue: QueueLike = { add: vi.fn() };

    await expect(submitAutomationJob({
      caller,
      jobName: 'score.run',
      idempotencyKey: 'score-1',
      payload: { limit: 50 },
    }, { redis, queue, prefix: 'weekly-admin' })).rejects.toMatchObject({
      code: 'JOB_QUEUE_UNAVAILABLE',
      status: 503,
    } satisfies Partial<JobSubmissionError>);

    expect(queue.add).not.toHaveBeenCalled();
    expect(failAutomationRunMock).toHaveBeenCalledWith('auto_1', expect.any(JobSubmissionError));
  });
});

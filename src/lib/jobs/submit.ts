import { Queue, type QueueOptions } from 'bullmq';

import { getCallerMeta } from '@/lib/automation/contracts';
import type { AutomationCaller, AutomationScope } from '@/lib/automation/auth';
import {
  createOrReplayQueuedAutomationRun,
  failAutomationRun,
  type AutomationRunStatus,
} from '@/lib/automation/run';
import { getCurrentConfig, type EnvironmentConfig } from '@/lib/config-validation';
import {
  AUTOMATION_QUEUE_NAME,
  getSubmittableAutomationJobDefinition,
  type AutomationJobName,
  type AutomationJobTarget,
} from './definitions';
import { getJobQueuePrefix, getJobRedisConnection } from './connection';
import { acquireJobTargetLock, releaseJobTargetLock, type JobLockRedis } from './locks';
import { checkJobRateLimit, type JobRateLimitRedis } from './rate-limit';

const DEFAULT_TARGET_LOCK_TTL_MS = 60 * 60 * 1000;

export type QueuedAutomationJob = {
  jobId: string;
  runId: string;
  status: AutomationRunStatus;
  workflow: string;
  step: string;
  target: AutomationJobTarget;
  statusUrl: string;
  idempotentReplay: boolean;
  caller: ReturnType<typeof getCallerMeta>;
};

export type QueueLike = {
  add: (
    name: string,
    data: Record<string, unknown>,
    options: Record<string, unknown>
  ) => Promise<{ id?: string | number }>;
};

export class JobSubmissionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'JobSubmissionError';
  }
}

export async function submitAutomationJob(
  input: {
    caller: AutomationCaller;
    jobName: AutomationJobName;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  },
  deps: {
    config?: EnvironmentConfig;
    queue?: QueueLike;
    redis?: JobLockRedis & JobRateLimitRedis;
    prefix?: string;
    targetLockTtlMs?: number;
  } = {}
): Promise<QueuedAutomationJob> {
  const definition = getSubmittableAutomationJobDefinition(input.jobName);
  const target = definition.getTarget(input.payload);
  const config = deps.config ?? (deps.queue || deps.redis || deps.prefix ? undefined : getCurrentConfig());
  const run = await createOrReplayQueuedAutomationRun({
    caller: input.caller,
    workflow: definition.workflow,
    step: definition.step,
    targetType: target.targetType,
    targetId: target.targetId,
    idempotencyKey: input.idempotencyKey,
    requestPayload: input.payload,
  });

  const baseResult = {
    jobId: run.runId,
    runId: run.runId,
    status: run.status,
    workflow: definition.workflow,
    step: definition.step,
    target,
    statusUrl: `/api/v1/jobs/${run.runId}`,
    idempotentReplay: run.idempotentReplay,
    caller: getCallerMeta(input.caller),
  };

  if (run.idempotentReplay) {
    return baseResult;
  }

  const prefix = deps.prefix ?? getJobQueuePrefix(config);
  const targetLockTtlMs = deps.targetLockTtlMs
    ?? (config ? config.jobTargetLockTtlSeconds * 1000 : DEFAULT_TARGET_LOCK_TTL_MS);
  let redis: (JobLockRedis & JobRateLimitRedis) | undefined;

  try {
    redis = deps.redis ?? (getJobRedisConnection(config) as JobLockRedis & JobRateLimitRedis);
    const rateLimit = await checkJobRateLimit(redis, {
      prefix,
      scope: definition.scope,
      bucket: `caller:${input.caller.tokenId}`,
      limit: definition.rateLimit.limit,
      windowMs: definition.rateLimit.windowMs,
    });

    if (!rateLimit.allowed) {
      throw new JobSubmissionError(
        rateLimit.reason === 'redis_unavailable' ? 'JOB_QUEUE_UNAVAILABLE' : 'JOB_RATE_LIMITED',
        rateLimit.reason === 'redis_unavailable' ? 'Job queue is unavailable' : 'Job rate limit exceeded',
        rateLimit.reason === 'redis_unavailable' ? 503 : 429,
        { retryAfterMs: rateLimit.retryAfterMs, error: 'error' in rateLimit ? rateLimit.error : undefined }
      );
    }

    const lock = await acquireJobTargetLock(redis, {
      prefix,
      workflow: definition.workflow,
      targetKey: target.targetKey,
      runId: run.runId,
      ttlMs: targetLockTtlMs,
    });

    if (!lock.acquired) {
      throw new JobSubmissionError('JOB_TARGET_LOCKED', 'A job is already running for this target', 409, {
        ownerRunId: lock.owner?.runId,
        target,
      });
    }

    const queue = deps.queue ?? createAutomationQueue();
    await queue.add(definition.jobName, {
      runId: run.runId,
      workflow: definition.workflow,
      step: definition.step,
      target,
      payload: input.payload,
    }, {
      jobId: run.runId,
      attempts: definition.attempts,
      backoff: definition.backoff,
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 14 * 24 * 60 * 60, count: 1000 },
    });

    return baseResult;
  } catch (error) {
    if (redis) {
      await releaseJobTargetLock(redis, {
        prefix,
        workflow: definition.workflow,
        targetKey: target.targetKey,
        runId: run.runId,
      }).catch(() => undefined);
    }
    await failAutomationRun(run.runId, error);
    throw error;
  }
}

export function createAutomationQueue(): QueueLike {
  return new Queue(AUTOMATION_QUEUE_NAME, {
    connection: getJobRedisConnection() as unknown as QueueOptions['connection'],
    prefix: getJobQueuePrefix(),
  });
}

export function scopeForAutomationJob(jobName: AutomationJobName): AutomationScope {
  return getSubmittableAutomationJobDefinition(jobName).scope;
}

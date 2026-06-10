import { Queue, type QueueOptions } from 'bullmq';

import { getCurrentConfig, type EnvironmentConfig } from '@/lib/config-validation';
import { AUTOMATION_QUEUE_NAME } from './definitions';
import { getJobQueuePrefix, getJobRedisConnection } from './connection';

const DEFAULT_BACKLOG_DEGRADED_AGE_MS = 5 * 60 * 1000;

export type JobHealthStatus = 'healthy' | 'degraded';

export type JobHealthRedis = {
  scan: (cursor: string, matchMode: 'MATCH', pattern: string, countMode: 'COUNT', count: number) => Promise<[string, string[]]>;
  get: (key: string) => Promise<string | null>;
};

export type JobHealthQueueJob = {
  id?: string | number;
  timestamp?: number;
};

export type JobHealthQueue = {
  getJobCounts: (...types: string[]) => Promise<Record<string, number>>;
  getJobs: (types: string[], start: number, end: number, asc?: boolean) => Promise<JobHealthQueueJob[]>;
  close?: () => Promise<void>;
};

export type WorkerHeartbeat = {
  workerId: string;
  lastSeenAt: string;
  stale: boolean;
  currentRunId?: string;
  currentJobName?: string;
};

export type JobWorkerHealthSummary = {
  status: JobHealthStatus;
  reason: string | null;
  queue: {
    waiting: number;
    delayed: number;
    active: number;
    failed: number;
    oldestQueuedAgeMs: number | null;
  };
  workers: {
    count: number;
    stale: number;
    heartbeats: WorkerHeartbeat[];
  };
  redis: {
    available: boolean;
    error?: string;
  };
};

type GetJobWorkerHealthDeps = {
  config?: EnvironmentConfig;
  redis?: JobHealthRedis;
  queue?: JobHealthQueue;
  prefix?: string;
  now?: () => Date;
  backlogDegradedAgeMs?: number;
};

export async function getJobWorkerHealth(deps: GetJobWorkerHealthDeps = {}): Promise<JobWorkerHealthSummary> {
  const config = deps.config ?? getCurrentConfig();
  const prefix = deps.prefix ?? getJobQueuePrefix(config);
  const now = deps.now ?? (() => new Date());
  const baseQueue = {
    waiting: 0,
    delayed: 0,
    active: 0,
    failed: 0,
    oldestQueuedAgeMs: null,
  };

  if (config.jobQueueDisabled) {
    return {
      status: 'degraded',
      reason: 'Job queue is disabled',
      queue: baseQueue,
      workers: { count: 0, stale: 0, heartbeats: [] },
      redis: { available: false, error: 'Job queue is disabled' },
    };
  }

  if (!config.redisUrl && !deps.redis) {
    return {
      status: 'degraded',
      reason: 'REDIS_URL is not configured',
      queue: baseQueue,
      workers: { count: 0, stale: 0, heartbeats: [] },
      redis: { available: false, error: 'REDIS_URL is not configured' },
    };
  }

  let createdQueue: JobHealthQueue | null = null;
  try {
    const redis = deps.redis ?? (getJobRedisConnection(config) as unknown as JobHealthRedis);
    const queue = deps.queue ?? createJobHealthQueue(config);
    if (!deps.queue) createdQueue = queue;

    const [counts, oldestQueuedAgeMs, heartbeats] = await Promise.all([
      queue.getJobCounts('waiting', 'delayed', 'active', 'failed'),
      getOldestQueuedAgeMs(queue, now()),
      getWorkerHeartbeats(redis, {
        prefix,
        now: now(),
        ttlMs: config.jobWorkerHeartbeatTtlSeconds * 1000,
      }),
    ]);

    const summary = {
      waiting: counts.waiting ?? 0,
      delayed: counts.delayed ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      oldestQueuedAgeMs,
    };
    const stale = heartbeats.filter((heartbeat) => heartbeat.stale).length;
    const reason = getDegradedReason({
      queue: summary,
      workerCount: heartbeats.length,
      stale,
      backlogDegradedAgeMs: deps.backlogDegradedAgeMs ?? DEFAULT_BACKLOG_DEGRADED_AGE_MS,
    });

    return {
      status: reason ? 'degraded' : 'healthy',
      reason,
      queue: summary,
      workers: {
        count: heartbeats.length,
        stale,
        heartbeats,
      },
      redis: { available: true },
    };
  } catch (error) {
    return {
      status: 'degraded',
      reason: 'Job queue health check failed',
      queue: baseQueue,
      workers: { count: 0, stale: 0, heartbeats: [] },
      redis: {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    await createdQueue?.close?.().catch(() => undefined);
  }
}

export function createJobHealthQueue(config: EnvironmentConfig = getCurrentConfig()): JobHealthQueue {
  return new Queue(AUTOMATION_QUEUE_NAME, {
    connection: getJobRedisConnection(config) as unknown as QueueOptions['connection'],
    prefix: getJobQueuePrefix(config),
  }) as unknown as JobHealthQueue;
}

async function getOldestQueuedAgeMs(queue: JobHealthQueue, now: Date): Promise<number | null> {
  const jobs = await queue.getJobs(['waiting', 'delayed'], 0, 0, true);
  const oldest = jobs[0];
  if (!oldest?.timestamp) return null;
  return Math.max(0, now.getTime() - oldest.timestamp);
}

async function getWorkerHeartbeats(
  redis: JobHealthRedis,
  input: {
    prefix: string;
    now: Date;
    ttlMs: number;
  }
): Promise<WorkerHeartbeat[]> {
  const keys = await scanKeys(redis, `${input.prefix}:worker:*`);
  const values = await Promise.all(keys.map(async (key) => redis.get(key)));
  return values
    .map(parseHeartbeat)
    .filter((heartbeat): heartbeat is Omit<WorkerHeartbeat, 'stale'> => Boolean(heartbeat))
    .map((heartbeat) => ({
      ...heartbeat,
      stale: input.now.getTime() - new Date(heartbeat.lastSeenAt).getTime() > input.ttlMs,
    }));
}

async function scanKeys(redis: JobHealthRedis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    keys.push(...batch);
    cursor = nextCursor;
  } while (cursor !== '0');
  return keys;
}

function parseHeartbeat(raw: string | null): Omit<WorkerHeartbeat, 'stale'> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      workerId?: string;
      heartbeatAt?: string;
      lastSeenAt?: string;
      currentRunId?: string;
      currentJobName?: string;
    };
    const lastSeenAt = parsed.heartbeatAt ?? parsed.lastSeenAt;
    if (!parsed.workerId || !lastSeenAt || !Number.isFinite(new Date(lastSeenAt).getTime())) {
      return null;
    }
    return {
      workerId: parsed.workerId,
      lastSeenAt,
      currentRunId: parsed.currentRunId,
      currentJobName: parsed.currentJobName,
    };
  } catch {
    return null;
  }
}

function getDegradedReason(input: {
  queue: JobWorkerHealthSummary['queue'];
  workerCount: number;
  stale: number;
  backlogDegradedAgeMs: number;
}): string | null {
  if (input.workerCount === 0) return 'No worker heartbeat found';
  if (input.stale > 0) return 'Worker heartbeat is stale';
  if (input.queue.failed > 0) return 'Failed jobs are retained in the queue';
  if (input.queue.oldestQueuedAgeMs !== null && input.queue.oldestQueuedAgeMs > input.backlogDegradedAgeMs) {
    return 'Queued jobs are older than the backlog threshold';
  }
  return null;
}

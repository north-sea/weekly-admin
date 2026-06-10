import { Queue, type QueueOptions } from 'bullmq';

import { prisma } from '@/lib/db';
import type { AutomationRunStatus } from '@/lib/automation/run';
import {
  getJobQueuePrefix,
  getJobRedisConnection,
} from './connection';
import { AUTOMATION_QUEUE_NAME } from './definitions';
import {
  buildJobRuntimeStatusKey,
  type AutomationJobRuntimeSnapshot,
  type AutomationWorkerRuntimeStatus,
} from './worker';

export type JobStatusRedis = {
  get: (key: string) => Promise<string | null>;
};

export type JobStatusQueueJob = {
  id?: string | number;
  name?: string;
  attemptsMade?: number;
  opts?: {
    attempts?: number;
  };
  timestamp?: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: unknown;
  getState: () => Promise<string>;
};

export type JobStatusQueue = {
  getJob: (jobId: string) => Promise<JobStatusQueueJob | null>;
  close?: () => Promise<void>;
};

export type AutomationJobStatus = {
  runId: string;
  status: AutomationWorkerRuntimeStatus;
  durableStatus: AutomationRunStatus;
  historyOnly: boolean;
  workflow: string;
  step: string;
  targetType: string | null;
  targetId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  redis: {
    available: boolean;
    statusExpired: boolean;
    error?: string;
    snapshot?: AutomationJobRuntimeSnapshot;
  };
  queue: {
    available: boolean;
    state: string | null;
    attemptsMade: number | null;
    attempts: number | null;
    error?: string;
  };
};

type AutomationRunRow = {
  id: string;
  workflow: string;
  step: string;
  status: string;
  target_type: string | null;
  target_id: string | null;
  result_summary: unknown;
  error_code: string | null;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
};

type GetAutomationJobStatusDeps = {
  redis?: JobStatusRedis;
  queue?: JobStatusQueue;
  prefix?: string;
  automationRuns?: {
    findUnique: (args: unknown) => Promise<AutomationRunRow | null>;
  };
};

export async function getAutomationJobStatus(
  runId: string,
  deps: GetAutomationJobStatusDeps = {}
): Promise<AutomationJobStatus | null> {
  const automationRuns = deps.automationRuns ?? prisma.automation_runs;
  const run = await automationRuns.findUnique({
    where: { id: runId },
    select: {
      id: true,
      workflow: true,
      step: true,
      status: true,
      target_type: true,
      target_id: true,
      result_summary: true,
      error_code: true,
      error_message: true,
      started_at: true,
      finished_at: true,
    },
  });

  if (!run) return null;

  const prefix = deps.prefix ?? getJobQueuePrefix();
  const redis = await readRedisSnapshot(runId, prefix, deps.redis);
  const queue = await readQueueJob(runId, deps.queue);
  const durableStatus = normalizeRunStatus(run.status);
  const terminal = isTerminalStatus(durableStatus);
  const effectiveStatus = terminal
    ? durableStatus
    : redis.snapshot?.status ?? mapQueueState(queue.state) ?? durableStatus;

  return {
    runId: run.id,
    status: effectiveStatus,
    durableStatus,
    historyOnly: !redis.snapshot,
    workflow: run.workflow,
    step: run.step,
    targetType: run.target_type,
    targetId: run.target_id,
    startedAt: run.started_at?.toISOString() ?? null,
    finishedAt: run.finished_at?.toISOString() ?? null,
    resultSummary: run.result_summary,
    errorCode: run.error_code,
    errorMessage: run.error_message,
    redis,
    queue,
  };
}

export function createAutomationStatusQueue(): JobStatusQueue {
  return new Queue(AUTOMATION_QUEUE_NAME, {
    connection: getJobRedisConnection() as unknown as QueueOptions['connection'],
    prefix: getJobQueuePrefix(),
  }) as unknown as JobStatusQueue;
}

async function readRedisSnapshot(
  runId: string,
  prefix: string,
  providedRedis?: JobStatusRedis
): Promise<AutomationJobStatus['redis']> {
  try {
    const redis = providedRedis ?? (getJobRedisConnection() as unknown as JobStatusRedis);
    const raw = await redis.get(buildJobRuntimeStatusKey(prefix, runId));
    if (!raw) {
      return { available: true, statusExpired: true };
    }

    const snapshot = parseRuntimeSnapshot(raw, runId);
    return snapshot
      ? { available: true, statusExpired: false, snapshot }
      : { available: true, statusExpired: true, error: 'Invalid Redis job status snapshot' };
  } catch (error) {
    return {
      available: false,
      statusExpired: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readQueueJob(runId: string, providedQueue?: JobStatusQueue): Promise<AutomationJobStatus['queue']> {
  let createdQueue: JobStatusQueue | null = null;
  try {
    const queue = providedQueue ?? createAutomationStatusQueue();
    if (!providedQueue) createdQueue = queue;
    const job = await queue.getJob(runId);
    if (!job) {
      return {
        available: true,
        state: null,
        attemptsMade: null,
        attempts: null,
      };
    }

    return {
      available: true,
      state: await job.getState(),
      attemptsMade: typeof job.attemptsMade === 'number' ? job.attemptsMade : null,
      attempts: typeof job.opts?.attempts === 'number' ? job.opts.attempts : null,
    };
  } catch (error) {
    return {
      available: false,
      state: null,
      attemptsMade: null,
      attempts: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await createdQueue?.close?.().catch(() => undefined);
  }
}

function parseRuntimeSnapshot(raw: string, runId: string): AutomationJobRuntimeSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AutomationJobRuntimeSnapshot>;
    if (parsed.runId !== runId || !parsed.jobName || !parsed.workflow || !parsed.step || !parsed.status || !parsed.phase) {
      return null;
    }
    return parsed as AutomationJobRuntimeSnapshot;
  } catch {
    return null;
  }
}

function normalizeRunStatus(status: string): AutomationRunStatus {
  if (
    status === 'queued' ||
    status === 'running' ||
    status === 'succeeded' ||
    status === 'partial_success' ||
    status === 'skipped' ||
    status === 'empty' ||
    status === 'failed' ||
    status === 'cancelled'
  ) {
    return status;
  }

  return 'failed';
}

function isTerminalStatus(status: AutomationRunStatus): boolean {
  return status !== 'queued' && status !== 'running';
}

function mapQueueState(state: string | null): AutomationWorkerRuntimeStatus | null {
  switch (state) {
    case 'active':
      return 'running';
    case 'waiting':
    case 'delayed':
    case 'prioritized':
    case 'waiting-children':
      return 'queued';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

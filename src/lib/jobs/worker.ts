import { Worker, type WorkerOptions } from 'bullmq';

import {
  completeAutomationRun,
  failAutomationRun,
  markAutomationRunRunning,
  type AutomationRunResult,
  type AutomationRunStatus,
  type AutomationRunSuccess,
} from '@/lib/automation/run';
import { getCurrentConfig, type EnvironmentConfig } from '@/lib/config-validation';
import {
  AUTOMATION_QUEUE_NAME,
  getAutomationJobDefinition,
  type AutomationJobName,
  type AutomationJobTarget,
} from './definitions';
import { getJobQueuePrefix, getJobRedisConnection } from './connection';
import {
  refreshJobTargetLock,
  releaseJobTargetLock,
  type JobLockRedis,
} from './locks';
import { executeAutomationJob } from './worker-handlers';

export type AutomationJobData = {
  runId: string;
  workflow: string;
  step: string;
  target: AutomationJobTarget;
  payload: Record<string, unknown>;
};

export type AutomationWorkerJob = {
  id?: string | number;
  name: string;
  data: unknown;
  attemptsMade: number;
  opts?: {
    attempts?: number;
  };
};

export type JobWorkerRedis = JobLockRedis;

export type AutomationWorkerRuntimeStatus = AutomationRunStatus | 'retrying';

export type AutomationJobRuntimeSnapshot = {
  runId: string;
  jobId?: string;
  jobName: AutomationJobName;
  workflow: string;
  step: string;
  target: AutomationJobTarget;
  status: AutomationWorkerRuntimeStatus;
  phase: 'active' | 'retrying' | 'completed' | 'failed';
  attemptsMade: number;
  attempts: number;
  workerId: string;
  updatedAt: string;
  retryable?: boolean;
  error?: string;
  result?: unknown;
};

export type AutomationWorkerInstance = {
  close: (force?: boolean) => Promise<void>;
  on: (event: string, listener: (...args: unknown[]) => void) => AutomationWorkerInstance;
};

type WorkerFactory = (
  queueName: string,
  processor: (job: AutomationWorkerJob) => Promise<unknown>,
  options: Pick<WorkerOptions, 'connection' | 'prefix' | 'concurrency'>
) => AutomationWorkerInstance;

type AutomationWorkerLogger = Pick<typeof console, 'error' | 'info' | 'warn'>;
type ExecuteAutomationJobFn = (
  jobName: AutomationJobName,
  payload: Record<string, unknown>
) => Promise<AutomationRunSuccess<Record<string, unknown>>>;
type MarkAutomationRunRunningFn = (runId: string) => Promise<void>;
type CompleteAutomationRunFn = (
  runId: string,
  outcome: AutomationRunSuccess<Record<string, unknown>>
) => Promise<AutomationRunResult<Record<string, unknown>>>;
type FailAutomationRunFn = (runId: string, error: unknown) => Promise<void>;

type AutomationWorkerDeps = {
  config?: EnvironmentConfig;
  redis?: JobWorkerRedis;
  prefix?: string;
  workerId?: string;
  now?: () => Date;
  executeJob?: ExecuteAutomationJobFn;
  markRunRunning?: MarkAutomationRunRunningFn;
  completeRun?: CompleteAutomationRunFn;
  failRun?: FailAutomationRunFn;
  workerFactory?: WorkerFactory;
  logger?: AutomationWorkerLogger;
};

export type CreateAutomationWorkerOptions = AutomationWorkerDeps & {
  concurrency?: number;
};

export async function processAutomationJob(
  job: AutomationWorkerJob,
  deps: AutomationWorkerDeps = {}
): Promise<AutomationRunResult<Record<string, unknown>>> {
  const config = deps.config ?? getCurrentConfig();
  const prefix = deps.prefix ?? getJobQueuePrefix(config);
  const redis = deps.redis ?? (getJobRedisConnection(config) as unknown as JobWorkerRedis);
  const workerId = deps.workerId ?? createDefaultWorkerId();
  const now = deps.now ?? (() => new Date());
  const data = parseAutomationJobData(job);
  const definition = getAutomationJobDefinition(job.name as AutomationJobName);
  const attempts = getJobAttempts(job, definition.attempts);

  await writeWorkerHeartbeat(redis, {
    prefix,
    workerId,
    ttlMs: config.jobWorkerHeartbeatTtlSeconds * 1000,
    now: now(),
    currentRunId: data.runId,
    currentJobName: definition.jobName,
  });
  await refreshJobTargetLock(redis, {
    prefix,
    workflow: definition.workflow,
    targetKey: data.target.targetKey,
    runId: data.runId,
    ttlMs: config.jobWorkerHeartbeatTtlSeconds * 1000,
    now: now(),
  });
  await (deps.markRunRunning ?? markAutomationRunRunning)(data.runId);
  await writeJobRuntimeStatus(redis, {
    prefix,
    ttlMs: config.jobQueueStatusTtlSeconds * 1000,
    snapshot: {
      runId: data.runId,
      jobId: job.id === undefined ? undefined : String(job.id),
      jobName: definition.jobName,
      workflow: definition.workflow,
      step: definition.step,
      target: data.target,
      status: 'running',
      phase: 'active',
      attemptsMade: job.attemptsMade,
      attempts,
      workerId,
      updatedAt: now().toISOString(),
    },
  });
  const stopHeartbeat = startActiveHeartbeat(redis, {
    prefix,
    workerId,
    heartbeatTtlMs: config.jobWorkerHeartbeatTtlSeconds * 1000,
    heartbeatIntervalMs: config.jobWorkerHeartbeatIntervalMs,
    now,
    lock: {
      workflow: definition.workflow,
      targetKey: data.target.targetKey,
      runId: data.runId,
      jobName: definition.jobName,
    },
  });

  try {
    const outcome = await (deps.executeJob ?? executeAutomationJob)(
      definition.jobName,
      data.payload
    ) as AutomationRunSuccess<Record<string, unknown>>;
    const result = await (deps.completeRun ?? completeAutomationRun)(data.runId, outcome);
    await writeJobRuntimeStatus(redis, {
      prefix,
      ttlMs: config.jobQueueStatusTtlSeconds * 1000,
      snapshot: {
        runId: data.runId,
        jobId: job.id === undefined ? undefined : String(job.id),
        jobName: definition.jobName,
        workflow: definition.workflow,
        step: definition.step,
        target: data.target,
        status: result.status,
        phase: 'completed',
        attemptsMade: job.attemptsMade,
        attempts,
        workerId,
        updatedAt: now().toISOString(),
        result: result.result,
      },
    });
    await releaseJobTargetLock(redis, {
      prefix,
      workflow: definition.workflow,
      targetKey: data.target.targetKey,
      runId: data.runId,
    });
    return result;
  } catch (error) {
    const finalAttempt = isFinalAttempt(job, attempts);
    await writeJobRuntimeStatus(redis, {
      prefix,
      ttlMs: config.jobQueueStatusTtlSeconds * 1000,
      snapshot: {
        runId: data.runId,
        jobId: job.id === undefined ? undefined : String(job.id),
        jobName: definition.jobName,
        workflow: definition.workflow,
        step: definition.step,
        target: data.target,
        status: finalAttempt ? 'failed' : 'retrying',
        phase: finalAttempt ? 'failed' : 'retrying',
        attemptsMade: job.attemptsMade + 1,
        attempts,
        workerId,
        updatedAt: now().toISOString(),
        retryable: !finalAttempt,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    if (finalAttempt) {
      await (deps.failRun ?? failAutomationRun)(data.runId, error);
      await releaseJobTargetLock(redis, {
        prefix,
        workflow: definition.workflow,
        targetKey: data.target.targetKey,
        runId: data.runId,
      });
    } else {
      await refreshJobTargetLock(redis, {
        prefix,
        workflow: definition.workflow,
        targetKey: data.target.targetKey,
        runId: data.runId,
        ttlMs: config.jobWorkerHeartbeatTtlSeconds * 1000,
        now: now(),
      });
    }

    throw error;
  } finally {
    stopHeartbeat();
  }
}

export function createAutomationWorker(options: CreateAutomationWorkerOptions = {}): AutomationWorkerInstance {
  const config = options.config ?? getCurrentConfig();
  const prefix = options.prefix ?? getJobQueuePrefix(config);
  const redis = options.redis ?? (getJobRedisConnection(config) as unknown as JobWorkerRedis);
  const logger = options.logger ?? console;
  const workerId = options.workerId ?? createDefaultWorkerId();
  const workerFactory = options.workerFactory ?? createBullMqWorker;
  let currentJob: { runId?: string; jobName?: string } | null = null;

  const worker = workerFactory(
    AUTOMATION_QUEUE_NAME,
    async (job) => {
      currentJob = {
        runId: getJobRunId(job),
        jobName: job.name,
      };
      try {
        return await processAutomationJob(job, {
          config,
          redis,
          prefix,
          workerId,
          now: options.now,
          executeJob: options.executeJob,
          markRunRunning: options.markRunRunning,
          completeRun: options.completeRun,
          failRun: options.failRun,
          logger,
        });
      } finally {
        currentJob = null;
      }
    },
    {
      connection: redis as unknown as WorkerOptions['connection'],
      prefix,
      concurrency: options.concurrency ?? 1,
    }
  );
  const stopWorkerHeartbeat = startWorkerHeartbeat(redis, {
    prefix,
    workerId,
    heartbeatTtlMs: config.jobWorkerHeartbeatTtlSeconds * 1000,
    heartbeatIntervalMs: config.jobWorkerHeartbeatIntervalMs,
    now: options.now ?? (() => new Date()),
    getCurrentJob: () => currentJob,
  });

  worker
    .on('completed', (job, result) => {
      logger.info('[automation-worker] job completed', {
        jobId: getEventJobId(job),
        result,
      });
    })
    .on('failed', (job, error) => {
      logger.error('[automation-worker] job failed', {
        jobId: getEventJobId(job),
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .on('error', (error) => {
      logger.error('[automation-worker] worker error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  const wrappedWorker: AutomationWorkerInstance = {
    close: async (force?: boolean) => {
      stopWorkerHeartbeat();
      await worker.close(force);
    },
    on: (event, listener) => {
      worker.on(event, listener);
      return wrappedWorker;
    },
  };

  return wrappedWorker;
}

export function buildJobRuntimeStatusKey(prefix: string, runId: string): string {
  return `${prefix}:status:${runId}`;
}

export function buildWorkerHeartbeatKey(prefix: string, workerId: string): string {
  return `${prefix}:worker:${workerId}`;
}

async function writeJobRuntimeStatus(
  redis: JobWorkerRedis,
  input: {
    prefix: string;
    ttlMs: number;
    snapshot: AutomationJobRuntimeSnapshot;
  }
): Promise<void> {
  await redis.set(
    buildJobRuntimeStatusKey(input.prefix, input.snapshot.runId),
    JSON.stringify(input.snapshot),
    'PX',
    input.ttlMs
  );
}

async function writeWorkerHeartbeat(
  redis: JobWorkerRedis,
  input: {
    prefix: string;
    workerId: string;
    ttlMs: number;
    now: Date;
    currentRunId?: string;
    currentJobName?: string;
  }
): Promise<void> {
  const timestamp = input.now.toISOString();
  await redis.set(
    buildWorkerHeartbeatKey(input.prefix, input.workerId),
    JSON.stringify({
      workerId: input.workerId,
      status: 'healthy',
      heartbeatAt: timestamp,
      lastSeenAt: timestamp,
      currentRunId: input.currentRunId,
      currentJobName: input.currentJobName,
    }),
    'PX',
    input.ttlMs
  );
}

function startWorkerHeartbeat(
  redis: JobWorkerRedis,
  input: {
    prefix: string;
    workerId: string;
    heartbeatTtlMs: number;
    heartbeatIntervalMs: number;
    now: () => Date;
    getCurrentJob?: () => { runId?: string; jobName?: string } | null;
  }
): () => void {
  const tick = () => {
    const currentJob = input.getCurrentJob?.();
    void writeWorkerHeartbeat(redis, {
      prefix: input.prefix,
      workerId: input.workerId,
      ttlMs: input.heartbeatTtlMs,
      now: input.now(),
      currentRunId: currentJob?.runId,
      currentJobName: currentJob?.jobName,
    }).catch(() => undefined);
  };
  tick();
  const timer = setInterval(tick, input.heartbeatIntervalMs);
  return () => {
    clearInterval(timer);
  };
}

function startActiveHeartbeat(
  redis: JobWorkerRedis,
  input: {
    prefix: string;
    workerId: string;
    heartbeatTtlMs: number;
    heartbeatIntervalMs: number;
    now: () => Date;
    lock: {
      workflow: string;
      targetKey: string;
      runId: string;
      jobName: string;
    };
  }
): () => void {
  const timer = setInterval(() => {
    const timestamp = input.now();
    void writeWorkerHeartbeat(redis, {
      prefix: input.prefix,
      workerId: input.workerId,
      ttlMs: input.heartbeatTtlMs,
      now: timestamp,
      currentRunId: input.lock.runId,
      currentJobName: input.lock.jobName,
    });
    void refreshJobTargetLock(redis, {
      prefix: input.prefix,
      workflow: input.lock.workflow,
      targetKey: input.lock.targetKey,
      runId: input.lock.runId,
      ttlMs: input.heartbeatTtlMs,
      now: timestamp,
    });
  }, input.heartbeatIntervalMs);

  return () => {
    clearInterval(timer);
  };
}

function parseAutomationJobData(job: AutomationWorkerJob): AutomationJobData {
  const data = job.data as Partial<AutomationJobData>;
  if (!data || typeof data !== 'object') {
    throw new Error('Automation job data must be an object');
  }
  if (!data.runId || typeof data.runId !== 'string') {
    throw new Error('Automation job data is missing runId');
  }
  if (!data.payload || typeof data.payload !== 'object') {
    throw new Error('Automation job data is missing payload');
  }
  if (!data.target || typeof data.target !== 'object' || !data.target.targetKey) {
    throw new Error('Automation job data is missing target');
  }

  return {
    runId: data.runId,
    workflow: typeof data.workflow === 'string' ? data.workflow : '',
    step: typeof data.step === 'string' ? data.step : '',
    target: data.target,
    payload: data.payload as Record<string, unknown>,
  };
}

function getJobAttempts(job: AutomationWorkerJob, fallback: number): number {
  const attempts = job.opts?.attempts;
  return typeof attempts === 'number' && Number.isFinite(attempts) && attempts > 0
    ? attempts
    : fallback;
}

function isFinalAttempt(job: AutomationWorkerJob, attempts: number): boolean {
  return job.attemptsMade + 1 >= attempts;
}

function createBullMqWorker(
  queueName: string,
  processor: (job: AutomationWorkerJob) => Promise<unknown>,
  options: Pick<WorkerOptions, 'connection' | 'prefix' | 'concurrency'>
): AutomationWorkerInstance {
  return new Worker(queueName, (job) => processor(job as AutomationWorkerJob), options) as unknown as AutomationWorkerInstance;
}

function createDefaultWorkerId(): string {
  return `worker-${process.pid}`;
}

function getJobRunId(job: AutomationWorkerJob): string | undefined {
  if (!job.data || typeof job.data !== 'object') return undefined;
  const runId = (job.data as { runId?: unknown }).runId;
  return typeof runId === 'string' ? runId : undefined;
}

function getEventJobId(job: unknown): string | undefined {
  if (!job || typeof job !== 'object' || !('id' in job)) return undefined;
  const id = (job as { id?: string | number }).id;
  return id === undefined ? undefined : String(id);
}

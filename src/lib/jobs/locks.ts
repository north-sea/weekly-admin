export type JobLockRedis = {
  set: (key: string, value: string, mode: 'PX', ttlMs: number, condition?: 'NX') => Promise<'OK' | null>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  pexpire: (key: string, ttlMs: number) => Promise<number>;
};

export type JobLockOwner = {
  runId: string;
  workflow: string;
  targetKey: string;
  acquiredAt: string;
  heartbeatAt?: string;
};

export type AcquireJobLockResult =
  | { acquired: true; reused: false; owner: JobLockOwner }
  | { acquired: true; reused: true; owner: JobLockOwner }
  | { acquired: false; reused: false; owner: JobLockOwner | null; reason: 'locked' };

export function buildJobLockKey(prefix: string, workflow: string, targetKey: string): string {
  return `${prefix}:lock:${workflow}:${targetKey}`;
}

export async function acquireJobTargetLock(
  redis: JobLockRedis,
  input: {
    prefix: string;
    workflow: string;
    targetKey: string;
    runId: string;
    ttlMs: number;
    now?: Date;
  }
): Promise<AcquireJobLockResult> {
  const key = buildJobLockKey(input.prefix, input.workflow, input.targetKey);
  const owner: JobLockOwner = {
    runId: input.runId,
    workflow: input.workflow,
    targetKey: input.targetKey,
    acquiredAt: (input.now ?? new Date()).toISOString(),
  };

  const result = await redis.set(key, JSON.stringify(owner), 'PX', input.ttlMs, 'NX');
  if (result === 'OK') {
    return { acquired: true, reused: false, owner };
  }

  const existing = parseJobLockOwner(await redis.get(key));
  if (existing?.runId === input.runId) {
    await redis.pexpire(key, input.ttlMs);
    return { acquired: true, reused: true, owner: existing };
  }

  return { acquired: false, reused: false, owner: existing, reason: 'locked' };
}

export async function refreshJobTargetLock(
  redis: JobLockRedis,
  input: {
    prefix: string;
    workflow: string;
    targetKey: string;
    runId: string;
    ttlMs: number;
    now?: Date;
  }
): Promise<boolean> {
  const key = buildJobLockKey(input.prefix, input.workflow, input.targetKey);
  const existing = parseJobLockOwner(await redis.get(key));
  if (existing?.runId !== input.runId) return false;

  existing.heartbeatAt = (input.now ?? new Date()).toISOString();
  await redis.set(key, JSON.stringify(existing), 'PX', input.ttlMs);
  return true;
}

export async function releaseJobTargetLock(
  redis: JobLockRedis,
  input: {
    prefix: string;
    workflow: string;
    targetKey: string;
    runId: string;
  }
): Promise<boolean> {
  const key = buildJobLockKey(input.prefix, input.workflow, input.targetKey);
  const existing = parseJobLockOwner(await redis.get(key));
  if (existing?.runId !== input.runId) return false;

  await redis.del(key);
  return true;
}

function parseJobLockOwner(value: string | null): JobLockOwner | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<JobLockOwner>;
    if (!parsed.runId || !parsed.workflow || !parsed.targetKey || !parsed.acquiredAt) return null;
    return {
      runId: parsed.runId,
      workflow: parsed.workflow,
      targetKey: parsed.targetKey,
      acquiredAt: parsed.acquiredAt,
      heartbeatAt: parsed.heartbeatAt,
    };
  } catch {
    return null;
  }
}

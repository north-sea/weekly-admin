import { describe, expect, it, vi } from 'vitest';

import {
  acquireJobTargetLock,
  buildJobLockKey,
  refreshJobTargetLock,
  releaseJobTargetLock,
  type JobLockRedis,
} from './locks';

function createRedis(): JobLockRedis & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    set: vi.fn(async (key: string, value: string, _mode: 'PX', _ttlMs: number, condition?: 'NX') => {
      if (condition === 'NX' && store.has(key)) return null;
      store.set(key, value);
      return 'OK' as const;
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    pexpire: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
  };
}

describe('job target locks', () => {
  it('builds stable lock keys and acquires a target lock', async () => {
    const redis = createRedis();

    const result = await acquireJobTargetLock(redis, {
      prefix: 'weekly-admin',
      workflow: 'sync',
      targetKey: 'data_source:7',
      runId: 'auto_1',
      ttlMs: 60_000,
      now: new Date('2026-06-08T00:00:00.000Z'),
    });

    expect(buildJobLockKey('weekly-admin', 'sync', 'data_source:7')).toBe('weekly-admin:lock:sync:data_source:7');
    expect(result).toMatchObject({ acquired: true, reused: false });
    expect(redis.store.get('weekly-admin:lock:sync:data_source:7')).toContain('auto_1');
  });

  it('reuses the lock for the same run and rejects a different run', async () => {
    const redis = createRedis();
    const input = {
      prefix: 'weekly-admin',
      workflow: 'score',
      targetKey: 'inbox:score_batch',
      runId: 'auto_1',
      ttlMs: 60_000,
    };

    await acquireJobTargetLock(redis, input);
    await expect(acquireJobTargetLock(redis, input)).resolves.toMatchObject({
      acquired: true,
      reused: true,
      owner: { runId: 'auto_1' },
    });
    await expect(acquireJobTargetLock(redis, { ...input, runId: 'auto_2' })).resolves.toMatchObject({
      acquired: false,
      reason: 'locked',
      owner: { runId: 'auto_1' },
    });
  });

  it('refreshes and releases only the owning run lock', async () => {
    const redis = createRedis();
    const input = {
      prefix: 'weekly-admin',
      workflow: 'score',
      targetKey: 'inbox:score_batch',
      runId: 'auto_1',
      ttlMs: 60_000,
    };

    await acquireJobTargetLock(redis, input);
    await expect(refreshJobTargetLock(redis, input)).resolves.toBe(true);
    expect(redis.store.get('weekly-admin:lock:score:inbox:score_batch')).toContain('heartbeatAt');

    await expect(releaseJobTargetLock(redis, { ...input, runId: 'auto_2' })).resolves.toBe(false);
    expect(redis.store.has('weekly-admin:lock:score:inbox:score_batch')).toBe(true);

    await expect(releaseJobTargetLock(redis, input)).resolves.toBe(true);
    expect(redis.store.has('weekly-admin:lock:score:inbox:score_batch')).toBe(false);
  });

  it('allows stale recovery after the lock key disappears', async () => {
    const redis = createRedis();
    const input = {
      prefix: 'weekly-admin',
      workflow: 'score',
      targetKey: 'inbox:score_batch',
      runId: 'auto_1',
      ttlMs: 60_000,
    };

    await acquireJobTargetLock(redis, input);
    redis.store.clear();

    await expect(acquireJobTargetLock(redis, { ...input, runId: 'auto_2' })).resolves.toMatchObject({
      acquired: true,
      reused: false,
      owner: { runId: 'auto_2' },
    });
  });
});

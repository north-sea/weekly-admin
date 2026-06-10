import { describe, expect, it, vi } from 'vitest';

import { buildRateLimitKey, checkJobRateLimit, type JobRateLimitRedis } from './rate-limit';

function createRedis(): JobRateLimitRedis & { counts: Map<string, number>; ttl: Map<string, number> } {
  const counts = new Map<string, number>();
  const ttl = new Map<string, number>();

  return {
    counts,
    ttl,
    incr: vi.fn(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    pexpire: vi.fn(async (key: string, ttlMs: number) => {
      ttl.set(key, ttlMs);
      return 1;
    }),
    pttl: vi.fn(async (key: string) => ttl.get(key) ?? -1),
  };
}

describe('job rate limit', () => {
  it('builds stable bucket keys and allows requests under the limit', async () => {
    const redis = createRedis();
    const now = new Date('2026-06-08T00:00:00.000Z');

    const result = await checkJobRateLimit(redis, {
      prefix: 'weekly-admin',
      scope: 'score:run',
      bucket: 'caller:1',
      limit: 2,
      windowMs: 60_000,
      now,
    });

    expect(buildRateLimitKey('weekly-admin', 'score:run', 'caller:1', '29491200')).toBe(
      'weekly-admin:rate:score:run:caller:1:29491200'
    );
    expect(result).toMatchObject({
      allowed: true,
      count: 1,
      remaining: 1,
      resetAfterMs: 60_000,
    });
    expect(redis.pexpire).toHaveBeenCalledWith(result.key, 60_000);
  });

  it('returns retryAfter when the bucket is over limit', async () => {
    const redis = createRedis();
    const input = {
      prefix: 'weekly-admin',
      scope: 'sync:run',
      bucket: 'caller:1',
      limit: 1,
      windowMs: 60_000,
      now: new Date('2026-06-08T00:00:00.000Z'),
    };

    await checkJobRateLimit(redis, input);
    await expect(checkJobRateLimit(redis, input)).resolves.toMatchObject({
      allowed: false,
      count: 2,
      retryAfterMs: 60_000,
      reason: 'rate_limited',
    });
  });

  it('uses a new bucket after the window changes', async () => {
    const redis = createRedis();

    const first = await checkJobRateLimit(redis, {
      prefix: 'weekly-admin',
      scope: 'score:run',
      bucket: 'caller:1',
      limit: 1,
      windowMs: 60_000,
      now: new Date('2026-06-08T00:00:00.000Z'),
    });
    const second = await checkJobRateLimit(redis, {
      prefix: 'weekly-admin',
      scope: 'score:run',
      bucket: 'caller:1',
      limit: 1,
      windowMs: 60_000,
      now: new Date('2026-06-08T00:01:00.000Z'),
    });

    expect(first.key).not.toBe(second.key);
    expect(second).toMatchObject({ allowed: true, count: 1 });
  });

  it('reports Redis unavailable without silently allowing the request', async () => {
    const redis = createRedis();
    vi.mocked(redis.incr).mockRejectedValueOnce(new Error('redis down'));

    await expect(checkJobRateLimit(redis, {
      prefix: 'weekly-admin',
      scope: 'score:run',
      bucket: 'caller:1',
      limit: 1,
      windowMs: 60_000,
      now: new Date('2026-06-08T00:00:00.000Z'),
    })).resolves.toMatchObject({
      allowed: false,
      count: 0,
      retryAfterMs: 60_000,
      reason: 'redis_unavailable',
      error: 'redis down',
    });
  });
});

export type JobRateLimitRedis = {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ttlMs: number) => Promise<number>;
  pttl: (key: string) => Promise<number>;
};

export type JobRateLimitResult =
  | { allowed: true; key: string; count: number; remaining: number; resetAfterMs: number }
  | { allowed: false; key: string; count: number; retryAfterMs: number; reason: 'rate_limited' }
  | { allowed: false; key: string; count: 0; retryAfterMs: number; reason: 'redis_unavailable'; error: string };

export function buildRateLimitKey(prefix: string, scope: string, bucket: string, windowName: string): string {
  return `${prefix}:rate:${scope}:${bucket}:${windowName}`;
}

export async function checkJobRateLimit(
  redis: JobRateLimitRedis,
  input: {
    prefix: string;
    scope: string;
    bucket: string;
    limit: number;
    windowMs: number;
    now?: Date;
  }
): Promise<JobRateLimitResult> {
  const windowName = getWindowName(input.now ?? new Date(), input.windowMs);
  const key = buildRateLimitKey(input.prefix, input.scope, input.bucket, windowName);

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, input.windowMs);
    }

    const ttl = await redis.pttl(key);
    const resetAfterMs = ttl > 0 ? ttl : input.windowMs;

    if (count > input.limit) {
      return {
        allowed: false,
        key,
        count,
        retryAfterMs: resetAfterMs,
        reason: 'rate_limited',
      };
    }

    return {
      allowed: true,
      key,
      count,
      remaining: input.limit - count,
      resetAfterMs,
    };
  } catch (error) {
    return {
      allowed: false,
      key,
      count: 0,
      retryAfterMs: input.windowMs,
      reason: 'redis_unavailable',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getWindowName(now: Date, windowMs: number): string {
  return String(Math.floor(now.getTime() / windowMs));
}

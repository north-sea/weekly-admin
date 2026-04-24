const PREPROCESS_SINCE_BACKOFF_SECONDS = 2;

export function floorToSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

export function subtractSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() - seconds * 1000);
}

/**
 * 数据库时间戳是秒级（Timestamp(0)），为避免“同一秒写入但被筛掉”，
 * 对 since 做 floor-to-second + 回退若干秒的安全处理。
 */
export function computePreprocessSince(since: Date): Date {
  return subtractSeconds(floorToSecond(since), PREPROCESS_SINCE_BACKOFF_SECONDS);
}

/**
 * 对增量同步（依赖 last_synced_at 游标）：
 * - 有任何错误时不推进游标，避免失败条目被永久跳过
 * - 无错误才推进
 *
 * 对非增量同步：总是允许推进（不影响过滤语义）。
 */
export function shouldAdvanceLastSyncedAtForIncrementalSync(
  incremental: boolean | undefined,
  errorCount: number
): boolean {
  if (!incremental) return true;
  return errorCount === 0;
}


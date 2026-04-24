import { describe, it, expect } from 'vitest';
import { computePreprocessSince, floorToSecond, shouldAdvanceLastSyncedAtForIncrementalSync } from './sync-orchestrator-utils';

describe('sync-orchestrator utils', () => {
  it('floorToSecond should drop milliseconds', () => {
    const input = new Date('2026-03-02T08:00:00.987Z');
    expect(floorToSecond(input).toISOString()).toBe('2026-03-02T08:00:00.000Z');
  });

  it('computePreprocessSince should floor and backoff 2 seconds', () => {
    const since = new Date('2026-03-02T08:00:00.900Z');
    expect(computePreprocessSince(since).toISOString()).toBe('2026-03-02T07:59:58.000Z');
  });

  it('shouldAdvanceLastSyncedAtForIncrementalSync should block advancing on incremental errors', () => {
    expect(shouldAdvanceLastSyncedAtForIncrementalSync(true, 1)).toBe(false);
    expect(shouldAdvanceLastSyncedAtForIncrementalSync(true, 0)).toBe(true);
  });

  it('shouldAdvanceLastSyncedAtForIncrementalSync should allow advancing on non-incremental even with errors', () => {
    expect(shouldAdvanceLastSyncedAtForIncrementalSync(false, 10)).toBe(true);
    expect(shouldAdvanceLastSyncedAtForIncrementalSync(undefined, 10)).toBe(true);
  });
});


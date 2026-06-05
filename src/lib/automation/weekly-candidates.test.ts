// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    contents: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { getWeeklyCandidates } from './weekly-candidates';

describe('getWeeklyCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty status when no candidates exist', async () => {
    findManyMock.mockResolvedValueOnce([]);

    await expect(getWeeklyCandidates({ weekOffset: 0, limit: 30, status: 'ready' })).resolves.toMatchObject({
      status: 'empty',
      total: 0,
      candidates: [],
    });
  });

  it('maps candidate ids and scores for automation consumers', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: BigInt(10),
        title: 'Post',
        summary: 'Summary',
        source: 'RSS',
        source_url: 'https://example.com',
        original_score: 70,
        summary_score: 5,
        created_at: new Date('2026-06-04T00:00:00Z'),
      },
    ]);

    const result = await getWeeklyCandidates({ date: '2026-06-04', limit: 1, status: 'ready' });

    expect(result.status).toBe('succeeded');
    expect(result.candidates[0]).toMatchObject({
      id: 10,
      score: 75,
      created_at: '2026-06-04T00:00:00.000Z',
    });
  });
});

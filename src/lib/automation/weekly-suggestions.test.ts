// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const issueFindUniqueMock = vi.fn();
const contentsFindManyMock = vi.fn();
const transactionMock = vi.fn();
const deleteManyMock = vi.fn();
const aggregateWeeklyItemsMock = vi.fn();
const createManyMock = vi.fn();
const weeklyItemsFindManyMock = vi.fn();
const contentsAggregateMock = vi.fn();
const issueUpdateMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
    weekly_issues: {
      findUnique: (...args: unknown[]) => issueFindUniqueMock(...args),
    },
    contents: {
      findMany: (...args: unknown[]) => contentsFindManyMock(...args),
    },
  },
}));

import { applyWeeklySuggestion } from './weekly-suggestions';

const tx = {
  weekly_content_items: {
    deleteMany: deleteManyMock,
    aggregate: aggregateWeeklyItemsMock,
    createMany: createManyMock,
    findMany: weeklyItemsFindManyMock,
  },
  contents: {
    aggregate: contentsAggregateMock,
  },
  weekly_issues: {
    update: issueUpdateMock,
  },
};

describe('applyWeeklySuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (fn) => fn(tx));
    aggregateWeeklyItemsMock.mockResolvedValue({ _max: { sort_order: 1 } });
    createManyMock.mockResolvedValue({ count: 1 });
    weeklyItemsFindManyMock.mockResolvedValue([{ content_id: BigInt(10) }]);
    contentsAggregateMock.mockResolvedValue({
      _sum: { word_count: 1000, reading_time: 5 },
      _count: 1,
    });
    issueUpdateMock.mockResolvedValue({});
  });

  it('applies suggestion items and updates weekly stats', async () => {
    issueFindUniqueMock.mockResolvedValueOnce({ id: 7, issue_number: 7, title: '第 7 期', status: 'draft' });
    contentsFindManyMock.mockResolvedValueOnce([
      { id: BigInt(10), title: 'A', weekly_content_items: [] },
    ]);

    const result = await applyWeeklySuggestion({
      weeklyIssueId: 7,
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: true, reason: 'good' }],
    });

    expect(result.status).toBe('applied');
    expect(createManyMock).toHaveBeenCalledWith({
      data: [{
        weekly_issue_id: 7,
        content_id: BigInt(10),
        sort_order: 2,
        section: 'AI',
        featured: true,
      }],
      skipDuplicates: true,
    });
    expect(issueUpdateMock).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        total_items: 1,
        total_word_count: 1000,
        reading_time: 5,
      },
    });
  });

  it('rejects invalid content ids', async () => {
    issueFindUniqueMock.mockResolvedValueOnce({ id: 7, issue_number: 7, title: '第 7 期', status: 'draft' });
    contentsFindManyMock.mockResolvedValueOnce([]);

    await expect(applyWeeklySuggestion({
      weeklyIssueId: 7,
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: false }],
    })).rejects.toMatchObject({
      code: 'INVALID_CONTENT_ID',
      status: 400,
    });
  });

  it('rejects content linked to another issue', async () => {
    issueFindUniqueMock.mockResolvedValueOnce({ id: 7, issue_number: 7, title: '第 7 期', status: 'draft' });
    contentsFindManyMock.mockResolvedValueOnce([
      { id: BigInt(10), title: 'A', weekly_content_items: [{ weekly_issue_id: 8 }] },
    ]);

    await expect(applyWeeklySuggestion({
      weeklyIssueId: 7,
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: false }],
    })).rejects.toMatchObject({
      code: 'CONTENT_ALREADY_LINKED',
      status: 409,
    });
  });

  it('skips already linked content unless replaceExisting is true', async () => {
    issueFindUniqueMock.mockResolvedValueOnce({ id: 7, issue_number: 7, title: '第 7 期', status: 'draft' });
    contentsFindManyMock.mockResolvedValueOnce([
      { id: BigInt(10), title: 'A', weekly_content_items: [{ weekly_issue_id: 7 }] },
    ]);

    const result = await applyWeeklySuggestion({
      weeklyIssueId: 7,
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: false }],
    });

    expect(result.status).toBe('skipped');
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

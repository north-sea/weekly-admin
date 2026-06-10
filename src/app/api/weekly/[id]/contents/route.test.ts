// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const weeklyItemsFindManyMock = vi.fn();
const weeklyIssuesFindUniqueMock = vi.fn();
const contentsFindManyMock = vi.fn();
const transactionMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
    weekly_issues: {
      findUnique: (...args: unknown[]) => weeklyIssuesFindUniqueMock(...args),
    },
    contents: {
      findMany: (...args: unknown[]) => contentsFindManyMock(...args),
    },
    weekly_content_items: {
      findMany: (...args: unknown[]) => weeklyItemsFindManyMock(...args),
    },
  },
}));

import { GET, PUT } from './route';

describe('/api/weekly/[id]/contents legacy compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps human auth middleware on the legacy weekly route', async () => {
    authMiddlewareMock.mockRejectedValueOnce(new Error('无效的认证令牌'));

    const response = await GET(
      new NextRequest('http://localhost/api/weekly/7/contents'),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('GET_WEEKLY_CONTENTS_ERROR');
    expect(authMiddlewareMock).toHaveBeenCalledWith(expect.any(NextRequest));
  });

  it('does not require automation token semantics on the legacy weekly route', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    weeklyItemsFindManyMock.mockResolvedValueOnce([]);

    const response = await GET(
      new NextRequest('http://localhost/api/weekly/7/contents'),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(weeklyItemsFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { weekly_issue_id: 7 },
    }));
  });

  it('allows ready weekly contents for manual workbench composition', async () => {
    const tx = {
      weekly_content_items: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      contents: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { word_count: 1200, reading_time: 6 } }),
      },
      weekly_issues: {
        update: vi.fn(),
      },
    };

    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    weeklyIssuesFindUniqueMock
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce({ id: 7, weekly_content_items: [] });
    contentsFindManyMock.mockResolvedValueOnce([{ id: BigInt(10), status: 'ready' }]);
    transactionMock.mockImplementationOnce(async (callback) => callback(tx));

    const response = await PUT(
      new NextRequest('http://localhost/api/weekly/7/contents', {
        method: 'PUT',
        body: JSON.stringify({
          contents: [{ content_id: 10, sort_order: 0, section: 'AI', featured: true }],
        }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    );

    expect(response.status).toBe(200);
    expect(contentsFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ['draft', 'ready', 'published'] },
      }),
    }));
    expect(tx.weekly_content_items.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ content_id: BigInt(10), section: 'AI', featured: true })],
    }));
  });
});

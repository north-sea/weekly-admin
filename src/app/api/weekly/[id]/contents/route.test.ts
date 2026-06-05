// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const weeklyItemsFindManyMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    weekly_content_items: {
      findMany: (...args: unknown[]) => weeklyItemsFindManyMock(...args),
    },
  },
}));

import { GET } from './route';

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
});

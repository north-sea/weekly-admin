// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const getWorkbenchSummaryMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/services/weekly-workbench', () => ({
  getWorkbenchSummary: (...args: unknown[]) => getWorkbenchSummaryMock(...args),
}));

import { GET } from './route';

describe('/api/weekly/workbench/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires human cookie auth', async () => {
    authMiddlewareMock.mockRejectedValueOnce(new Error('无效的认证令牌'));

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/summary'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(getWorkbenchSummaryMock).not.toHaveBeenCalled();
  });

  it('returns workbench summary data', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    getWorkbenchSummaryMock.mockResolvedValueOnce({ issue: null, nextAction: { type: 'create_issue' } });

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/summary?weekOffset=0'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.nextAction.type).toBe('create_issue');
    expect(getWorkbenchSummaryMock).toHaveBeenCalledWith({ weekOffset: '0' });
  });
});

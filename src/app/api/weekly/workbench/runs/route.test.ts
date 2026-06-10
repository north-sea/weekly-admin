// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const getWorkbenchRunsMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/services/weekly-workbench', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/weekly-workbench')>('@/lib/services/weekly-workbench');
  return {
    ...actual,
    getWorkbenchRuns: (...args: unknown[]) => getWorkbenchRunsMock(...args),
  };
});

import { GET } from './route';

describe('/api/weekly/workbench/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filtered automation runs', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    getWorkbenchRunsMock.mockResolvedValueOnce({
      total: 1,
      runs: [{ id: 'auto_1', workflow: 'weekly', status: 'running' }],
    });

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/runs?workflow=weekly&targetType=weekly_issue&targetId=7&limit=5'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.total).toBe(1);
    expect(getWorkbenchRunsMock).toHaveBeenCalledWith(expect.objectContaining({
      workflow: 'weekly',
      targetType: 'weekly_issue',
      targetId: '7',
      limit: 5,
    }));
  });

  it('validates max limit', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/runs?limit=999'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(getWorkbenchRunsMock).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const getWeeklyCandidatesMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/automation/weekly-candidates', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/weekly-candidates')>('@/lib/automation/weekly-candidates');
  return {
    ...actual,
    getWeeklyCandidates: (...args: unknown[]) => getWeeklyCandidatesMock(...args),
  };
});

import { GET } from './route';

describe('/api/weekly/workbench/candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses human auth and returns candidates', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    getWeeklyCandidatesMock.mockResolvedValueOnce({
      status: 'empty',
      total: 0,
      candidates: [],
      range: { startDate: '2026-06-01', endDate: '2026-06-07' },
    });

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/candidates?limit=10&status=ready'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('empty');
    expect(getWeeklyCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
      status: 'ready',
    }));
  });

  it('returns validation errors for invalid query params', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/candidates?limit=999'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(getWeeklyCandidatesMock).not.toHaveBeenCalled();
  });
});

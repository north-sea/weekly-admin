// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const getWeeklyCandidatesMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

vi.mock('@/lib/automation/weekly-candidates', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/weekly-candidates')>('@/lib/automation/weekly-candidates');
  return {
    ...actual,
    getWeeklyCandidates: (...args: unknown[]) => getWeeklyCandidatesMock(...args),
  };
});

import { GET } from './route';

describe('/api/v1/weekly/candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
  });

  it('returns empty as successful automation status', async () => {
    getWeeklyCandidatesMock.mockResolvedValueOnce({
      status: 'empty',
      range: { startDate: '2026-06-01', endDate: '2026-06-07' },
      total: 0,
      candidates: [],
    });

    const response = await GET(new NextRequest('http://localhost/api/v1/weekly/candidates?weekOffset=0'));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'weekly:read',
      workflow: 'weekly',
      step: 'candidates',
    }));
    expect(body.data.status).toBe('empty');
  });
});

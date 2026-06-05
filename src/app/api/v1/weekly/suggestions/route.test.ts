// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const organizeWeeklyMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

vi.mock('@/lib/ai/server/weekly-organizer', () => ({
  organizeWeekly: (...args: unknown[]) => organizeWeeklyMock(...args),
}));

import { POST } from './route';

describe('/api/v1/weekly/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
  });

  it('requires idempotency for suggestion generation', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      body: JSON.stringify({ weeklyIssueId: 1 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('returns preview artifact without applying weekly items', async () => {
    organizeWeeklyMock.mockResolvedValueOnce({ intro: 'hello', items: [{ content_id: 1, section: 'AI' }] });

    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      headers: { 'idempotency-key': 'suggest-1' },
      body: JSON.stringify({ weeklyIssueId: 1, maxItems: 5 }),
    }));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'weekly:suggest',
      workflow: 'weekly',
      step: 'suggest',
      targetType: 'weekly_issue',
      targetId: 1,
    }));
    expect(organizeWeeklyMock).toHaveBeenCalledWith({ weeklyIssueId: 1, maxItems: 5 });
    expect(body.data.status).toBe('preview');
    expect(body.data.suggestion.items).toHaveLength(1);
  });
});

// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const runBatchMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

vi.mock('@/lib/services/inbox-scoring', () => ({
  InboxScoringService: {
    runBatch: (...args: unknown[]) => runBatchMock(...args),
  },
}));

import { POST } from './route';

describe('/api/v1/jobs/score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
  });

  it('validates request body', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/score', {
      method: 'POST',
      headers: { 'idempotency-key': 'score-1' },
      body: JSON.stringify({ limit: 999 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('runs scoring batch through the automation wrapper', async () => {
    runBatchMock.mockResolvedValueOnce({ scored: 2, failed: 0, skipped: 1, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/score', {
      method: 'POST',
      headers: { 'idempotency-key': 'score-1' },
      body: JSON.stringify({ limit: 2, delay: 0 }),
    }));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'score:run',
      workflow: 'score',
      step: 'run',
      idempotencyKey: 'score-1',
    }));
    expect(runBatchMock).toHaveBeenCalledWith({ limit: 2, delayMs: 0, source: 'api' });
    expect(body.data.status).toBe('succeeded');
  });
});

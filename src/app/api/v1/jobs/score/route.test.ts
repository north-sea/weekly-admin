// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const runQueuedAutomationRouteMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
    runQueuedAutomationRoute: (...args: unknown[]) => runQueuedAutomationRouteMock(...args),
  };
});

import { POST } from './route';

describe('/api/v1/jobs/score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runQueuedAutomationRouteMock.mockResolvedValue(Response.json({
      success: true,
      data: { status: 'queued', runId: 'auto_1', jobId: 'auto_1' },
      meta: { status: 'queued', runId: 'auto_1' },
    }, { status: 202 }));
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

  it('queues scoring batch through the queued automation wrapper', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/score', {
      method: 'POST',
      headers: { 'idempotency-key': 'score-1' },
      body: JSON.stringify({ limit: 2, delay: 0 }),
    }));
    const body = await response.json();

    expect(runQueuedAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'score:run',
      jobName: 'score.run',
      idempotencyKey: 'score-1',
      requestPayload: { limit: 2, delay: 0 },
    }));
    expect(runAutomationRouteMock).not.toHaveBeenCalled();
    expect(response.status).toBe(202);
    expect(body.data.status).toBe('queued');
  });
});

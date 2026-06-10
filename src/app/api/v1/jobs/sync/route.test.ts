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

describe('/api/v1/jobs/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runQueuedAutomationRouteMock.mockResolvedValue(Response.json({
      success: true,
      data: { status: 'queued', runId: 'auto_1', jobId: 'auto_1' },
      meta: { status: 'queued', runId: 'auto_1' },
    }, { status: 202 }));
  });

  it('requires an idempotency key', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/sync', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 1 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('queues one source through the queued automation wrapper', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/sync', {
      method: 'POST',
      headers: { 'idempotency-key': 'sync-1' },
      body: JSON.stringify({ sourceId: 1, max_items: 10 }),
    }));
    const body = await response.json();

    expect(runQueuedAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'sync:run',
      jobName: 'sync.run',
      idempotencyKey: 'sync-1',
      requestPayload: { sourceId: 1, max_items: 10 },
    }));
    expect(runAutomationRouteMock).not.toHaveBeenCalled();
    expect(response.status).toBe(202);
    expect(body.data.status).toBe('queued');
  });
});

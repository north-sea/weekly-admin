// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const syncDataSourceMock = vi.fn();
const getDataSourceByIdMock = vi.fn();
const listDataSourcesMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

vi.mock('@/lib/services/data-source', () => ({
  DataSourceService: {
    getDataSourceById: (...args: unknown[]) => getDataSourceByIdMock(...args),
    listDataSources: (...args: unknown[]) => listDataSourcesMock(...args),
  },
}));

vi.mock('@/lib/services/sync-orchestrator', () => ({
  SyncOrchestrator: {
    syncDataSource: (...args: unknown[]) => syncDataSourceMock(...args),
  },
}));

import { POST } from './route';

describe('/api/v1/jobs/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
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

  it('runs one source through the automation wrapper', async () => {
    getDataSourceByIdMock.mockResolvedValueOnce({ id: 1, name: 'Karakeep', sync_interval_minutes: null, last_synced_at: null });
    syncDataSourceMock.mockResolvedValueOnce({ upserted: 2, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/sync', {
      method: 'POST',
      headers: { 'idempotency-key': 'sync-1' },
      body: JSON.stringify({ sourceId: 1, max_items: 10 }),
    }));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'sync:run',
      workflow: 'sync',
      step: 'run',
      targetType: 'data_source',
      targetId: 1,
      idempotencyKey: 'sync-1',
    }));
    expect(syncDataSourceMock).toHaveBeenCalledWith(1, expect.objectContaining({ max_items: 10 }));
    expect(body.data.status).toBe('succeeded');
    expect(body.data.ok_count).toBe(1);
  });
});

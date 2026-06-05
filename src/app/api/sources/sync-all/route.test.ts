// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateRequestMock = vi.fn();
const listDataSourcesMock = vi.fn();
const syncDataSourceMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequestMock(...args),
}));

vi.mock('@/lib/services/data-source', () => ({
  DataSourceService: {
    listDataSources: (...args: unknown[]) => listDataSourcesMock(...args),
  },
}));

vi.mock('@/lib/services/sync-orchestrator', () => ({
  SyncOrchestrator: {
    syncDataSource: (...args: unknown[]) => syncDataSourceMock(...args),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {},
}));

import { POST } from './route';

describe('/api/sources/sync-all legacy compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps human JWT authentication', async () => {
    authenticateRequestMock.mockResolvedValueOnce({ success: false });

    const response = await POST(new NextRequest('http://localhost/api/sources/sync-all', {
      method: 'POST',
      body: JSON.stringify({ type: 'karakeep' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(authenticateRequestMock).toHaveBeenCalledWith(expect.any(NextRequest));
  });

  it('does not require automation idempotency headers on the legacy route', async () => {
    authenticateRequestMock.mockResolvedValueOnce({ success: true, user: { id: 1 } });
    listDataSourcesMock.mockResolvedValueOnce([
      { id: 1, name: 'Karakeep', sync_interval_minutes: null, last_synced_at: null },
    ]);
    syncDataSourceMock.mockResolvedValueOnce({ upserted: 1, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/sources/sync-all', {
      method: 'POST',
      body: JSON.stringify({ type: 'karakeep', wait: true }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.started).toBe(true);
    expect(body.data.ok_count).toBe(1);
    expect(syncDataSourceMock).toHaveBeenCalledWith(1, expect.objectContaining({
      incremental: undefined,
    }));
  });
});

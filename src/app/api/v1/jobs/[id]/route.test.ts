// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateAutomationRequestMock = vi.fn();
const getAutomationJobStatusMock = vi.fn();

vi.mock('@/lib/automation/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/auth')>('@/lib/automation/auth');
  return {
    ...actual,
    authenticateAutomationRequest: (...args: unknown[]) => authenticateAutomationRequestMock(...args),
  };
});

vi.mock('@/lib/jobs/status', async () => {
  const actual = await vi.importActual<typeof import('@/lib/jobs/status')>('@/lib/jobs/status');
  return {
    ...actual,
    getAutomationJobStatus: (...args: unknown[]) => getAutomationJobStatusMock(...args),
  };
});

import { GET } from './route';

const caller = {
  tokenId: 7,
  name: 'cron',
  callerType: 'cron',
  tokenPrefix: 'wa_cron',
  scopes: ['score:run'],
};

function buildStatus(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'auto_1',
    status: 'running',
    durableStatus: 'running',
    historyOnly: false,
    workflow: 'score',
    step: 'run',
    targetType: 'inbox',
    targetId: 'score_batch',
    startedAt: '2026-06-08T00:00:00.000Z',
    finishedAt: null,
    resultSummary: null,
    errorCode: null,
    errorMessage: null,
    redis: {
      available: true,
      statusExpired: false,
      snapshot: {
        status: 'running',
      },
    },
    queue: {
      available: true,
      state: 'active',
      attemptsMade: 0,
      attempts: 2,
    },
    ...overrides,
  };
}

describe('/api/v1/jobs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateAutomationRequestMock.mockResolvedValue(caller);
  });

  it('returns authorized job status', async () => {
    getAutomationJobStatusMock.mockResolvedValueOnce(buildStatus());

    const response = await GET(new NextRequest('http://localhost/api/v1/jobs/auto_1', {
      headers: { authorization: 'Bearer wa_cron' },
    }), { params: Promise.resolve({ id: 'auto_1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getAutomationJobStatusMock).toHaveBeenCalledWith('auto_1');
    expect(body.data).toMatchObject({
      runId: 'auto_1',
      status: 'running',
      durableStatus: 'running',
      workflow: 'score',
      queue: {
        state: 'active',
      },
    });
    expect(body.meta).toMatchObject({
      runId: 'auto_1',
      status: 'running',
      caller: {
        type: 'cron',
        tokenPrefix: 'wa_cron',
      },
    });
  });

  it('returns 404 when the durable run does not exist', async () => {
    getAutomationJobStatusMock.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/v1/jobs/missing', {
      headers: { authorization: 'Bearer wa_cron' },
    }), { params: Promise.resolve({ id: 'missing' }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('returns Redis-expired history-only status', async () => {
    getAutomationJobStatusMock.mockResolvedValueOnce(buildStatus({
      status: 'succeeded',
      durableStatus: 'succeeded',
      historyOnly: true,
      finishedAt: '2026-06-08T00:05:00.000Z',
      resultSummary: { scored: 3 },
      redis: {
        available: true,
        statusExpired: true,
      },
      queue: {
        available: true,
        state: null,
        attemptsMade: null,
        attempts: null,
      },
    }));

    const response = await GET(new NextRequest('http://localhost/api/v1/jobs/auto_1', {
      headers: { authorization: 'Bearer wa_cron' },
    }), { params: Promise.resolve({ id: 'auto_1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      status: 'succeeded',
      historyOnly: true,
      resultSummary: { scored: 3 },
      redis: {
        statusExpired: true,
      },
    });
  });

  it('rejects callers without workflow read scope', async () => {
    authenticateAutomationRequestMock.mockResolvedValueOnce({
      ...caller,
      scopes: ['sync:run'],
    });
    getAutomationJobStatusMock.mockResolvedValueOnce(buildStatus({
      workflow: 'score',
    }));

    const response = await GET(new NextRequest('http://localhost/api/v1/jobs/auto_1', {
      headers: { authorization: 'Bearer wa_sync' },
    }), { params: Promise.resolve({ id: 'auto_1' }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('AUTOMATION_SCOPE_FORBIDDEN');
  });
});

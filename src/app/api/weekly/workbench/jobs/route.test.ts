// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const getJobWorkerHealthMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/jobs/health', () => ({
  getJobWorkerHealth: (...args: unknown[]) => getJobWorkerHealthMock(...args),
}));

import { GET } from './route';

function buildSummary(overrides: Record<string, unknown> = {}) {
  return {
    status: 'healthy',
    reason: null,
    queue: {
      waiting: 0,
      delayed: 0,
      active: 0,
      failed: 0,
      oldestQueuedAgeMs: null,
    },
    workers: {
      count: 1,
      stale: 0,
      heartbeats: [],
    },
    redis: {
      available: true,
    },
    ...overrides,
  };
}

describe('/api/weekly/workbench/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns job queue and worker health summary for cookie-auth UI', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    getJobWorkerHealthMock.mockResolvedValueOnce(buildSummary({
      queue: {
        waiting: 2,
        delayed: 1,
        active: 1,
        failed: 0,
        oldestQueuedAgeMs: 120_000,
      },
    }));

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/jobs'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      status: 'healthy',
      queue: {
        waiting: 2,
        delayed: 1,
        active: 1,
      },
      workers: {
        count: 1,
      },
    });
    expect(authMiddlewareMock).toHaveBeenCalledWith(expect.any(NextRequest));
  });

  it('returns degraded summary instead of failing when Redis is unavailable', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    getJobWorkerHealthMock.mockResolvedValueOnce(buildSummary({
      status: 'degraded',
      reason: 'Job queue health check failed',
      redis: {
        available: false,
        error: 'redis down',
      },
    }));

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/jobs'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      status: 'degraded',
      reason: 'Job queue health check failed',
      redis: {
        available: false,
        error: 'redis down',
      },
    });
  });

  it('requires cookie authentication', async () => {
    authMiddlewareMock.mockRejectedValueOnce(new Error('认证失败'));

    const response = await GET(new NextRequest('http://localhost/api/weekly/workbench/jobs'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(getJobWorkerHealthMock).not.toHaveBeenCalled();
  });
});

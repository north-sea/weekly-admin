import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import client from '@/lib/search';
import { getJobWorkerHealth } from '@/lib/jobs/health';
import { GET } from './route';

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/search', () => ({
  default: {
    health: vi.fn(),
  },
}));

vi.mock('@/lib/startup', () => ({
  initializeApplication: vi.fn().mockResolvedValue({}),
  isApplicationInitialized: vi.fn(() => true),
}));

vi.mock('@/lib/monitoring/resource-monitor', () => ({
  resourceMonitor: {
    getCurrentMetrics: vi.fn(() => null),
  },
}));

vi.mock('@/lib/monitoring/performance', () => ({
  performanceMonitor: {
    getStats: vi.fn(() => ({ count: 0, avgDuration: 0, successRate: 1 })),
  },
}));

vi.mock('@/lib/monitoring/error-tracker', () => ({
  errorTracker: {
    getStats: vi.fn(() => ({ recentErrors: 0, totalErrors: 0 })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('@/lib/jobs/health', () => ({
  getJobWorkerHealth: vi.fn(),
}));

describe('/api/health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ test: 1 }]);
    vi.mocked(client.health).mockResolvedValue({ status: 'available' } as any);
    vi.mocked(getJobWorkerHealth).mockResolvedValue({
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
    });
  });

  it('returns degraded HTTP 200 when only Meilisearch is down', async () => {
    vi.mocked(client.health).mockRejectedValue(new Error('fetch failed'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overall).toBe('degraded');
    expect(body.services.search.status).toBe('degraded');
  });

  it('returns unhealthy HTTP 503 when database is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('db down'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.overall).toBe('unhealthy');
    expect(body.services.database.status).toBe('unhealthy');
  });

  it('returns healthy HTTP 200 when all checks pass', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overall).toBe('healthy');
    expect(body.services.search.status).toBe('healthy');
    expect(body.services.jobQueue.status).toBe('healthy');
  });

  it('returns degraded HTTP 200 when job queue worker health is degraded', async () => {
    vi.mocked(getJobWorkerHealth).mockResolvedValue({
      status: 'degraded',
      reason: 'No worker heartbeat found',
      queue: {
        waiting: 1,
        delayed: 0,
        active: 0,
        failed: 0,
        oldestQueuedAgeMs: 30_000,
      },
      workers: {
        count: 0,
        stale: 0,
        heartbeats: [],
      },
      redis: {
        available: true,
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overall).toBe('degraded');
    expect(body.services.jobQueue).toMatchObject({
      status: 'degraded',
      message: 'No worker heartbeat found',
    });
    expect(body.jobQueue.queue.waiting).toBe(1);
  });
});

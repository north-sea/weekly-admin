import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import client from '@/lib/search';
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

describe('/api/health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ test: 1 }]);
    vi.mocked(client.health).mockResolvedValue({ status: 'available' } as any);
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
  });
});


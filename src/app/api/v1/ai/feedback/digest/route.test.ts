// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();
const runAutomationRouteMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    operation_logs: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

import { GET } from './route';

describe('/api/v1/ai/feedback/digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
  });

  it('uses the ops read automation contract', async () => {
    findManyMock.mockResolvedValueOnce([]);

    const response = await GET(new NextRequest('http://localhost/api/v1/ai/feedback/digest?from=2026-06-01&to=2026-06-04'));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'ops:read',
      workflow: 'ai',
      step: 'feedback_digest',
      requestPayload: {
        from: '2026-06-01',
        to: '2026-06-04',
        format: undefined,
      },
    }));
    expect(body.meta.status).toBe('empty');
  });

  it('returns an empty digest successfully', async () => {
    findManyMock.mockResolvedValueOnce([]);

    const response = await GET(new NextRequest('http://localhost/api/v1/ai/feedback/digest'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.actions).toEqual([]);
    expect(body.data.counts).toEqual({});
  });

  it('aggregates inbox action counts', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: 1,
        user_id: 1,
        operation_type: 'UPDATE',
        resource_id: '10',
        operation_details: JSON.stringify({
          action: 'promote',
          content_id: 99,
          ai_score_at_action: 0.91,
          reason: 'high score',
          source: 'admin',
          timestamp: '2026-06-03T10:00:00.000Z',
        }),
        created_at: new Date('2026-06-03T10:00:00.000Z'),
      },
      {
        id: 2,
        user_id: 1,
        operation_type: 'UPDATE',
        resource_id: '11',
        operation_details: JSON.stringify({ action: 'promote' }),
        created_at: new Date('2026-06-03T11:00:00.000Z'),
      },
      {
        id: 3,
        user_id: 2,
        operation_type: 'UPDATE',
        resource_id: '12',
        operation_details: JSON.stringify({ action: 'reject' }),
        created_at: new Date('2026-06-03T12:00:00.000Z'),
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/v1/ai/feedback/digest?format=markdown'));
    const body = await response.json();

    expect(body.meta.status).toBe('succeeded');
    expect(body.data.counts).toEqual({ promote: 2, reject: 1 });
    expect(body.data.actions[0]).toMatchObject({
      inbox_item_id: '10',
      action: 'promote',
      content_id: '99',
      ai_score_at_action: 0.91,
      reason: 'high score',
    });
    expect(body.data.markdown).toContain('- promote: 2');
  });

  it('applies date range filters to operation logs', async () => {
    findManyMock.mockResolvedValueOnce([]);

    await GET(new NextRequest('http://localhost/api/v1/ai/feedback/digest?from=2026-06-01T00:00:00.000Z&to=2026-06-02T00:00:00.000Z'));

    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        resource_type: 'inbox_item',
        created_at: {
          gte: new Date('2026-06-01T00:00:00.000Z'),
          lte: new Date('2026-06-02T00:00:00.000Z'),
        },
      },
    }));
  });
});

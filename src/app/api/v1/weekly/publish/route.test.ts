// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const publishWeeklyMock = vi.fn();
const runAutomationRouteMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    weekly_issues: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock('@/lib/services/quail', () => ({
  quailService: {
    publishWeekly: (...args: unknown[]) => publishWeeklyMock(...args),
  },
}));

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

import { POST } from './route';

describe('/api/v1/weekly/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      try {
        const outcome = await options.handler();
        return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
      } catch (error) {
        const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
        return actual.automationErrorToResponse(error);
      }
    });
  });

  it('requires an idempotency key', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/publish', {
      method: 'POST',
      body: JSON.stringify({ weeklyIssueId: 7 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('rejects already published issues unless forceRepublish is true', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 7,
      issue_number: 7,
      title: '第 7 期',
      status: 'published',
      quail_post_id: 'qp_1',
      quail_post_slug: 'weekly-7',
      quail_published_at: new Date('2026-06-01T00:00:00.000Z'),
      quail_delivered_at: null,
    });

    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/publish', {
      method: 'POST',
      headers: { 'idempotency-key': 'publish-7' },
      body: JSON.stringify({ weeklyIssueId: 7 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('WEEKLY_ALREADY_PUBLISHED');
    expect(publishWeeklyMock).not.toHaveBeenCalled();
  });

  it('does not report success when Quail publish fails', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 7,
      issue_number: 7,
      title: '第 7 期',
      status: 'draft',
      quail_post_id: null,
      quail_post_slug: null,
      quail_published_at: null,
      quail_delivered_at: null,
    });
    publishWeeklyMock.mockResolvedValueOnce({ success: false, error: 'Quail down' });

    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/publish', {
      method: 'POST',
      headers: { 'idempotency-key': 'publish-7' },
      body: JSON.stringify({ weeklyIssueId: 7 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe('PUBLISH_FAILED');
  });

  it('publishes through the automation wrapper', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 7,
      issue_number: 7,
      title: '第 7 期',
      status: 'draft',
      quail_post_id: null,
      quail_post_slug: null,
      quail_published_at: null,
      quail_delivered_at: null,
    });
    publishWeeklyMock.mockResolvedValueOnce({
      success: true,
      quailPostId: 'qp_1',
      quailPostSlug: 'weekly-7',
    });

    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/publish', {
      method: 'POST',
      headers: { 'idempotency-key': 'publish-7' },
      body: JSON.stringify({ weeklyIssueId: 7, deliver: true }),
    }));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'weekly:publish',
      workflow: 'weekly',
      step: 'publish',
      targetType: 'weekly_issue',
      targetId: 7,
      idempotencyKey: 'publish-7',
    }));
    expect(publishWeeklyMock).toHaveBeenCalledWith(7, {
      forceRepublish: false,
      deliver: true,
    });
    expect(body.data.status).toBe('published');
    expect(body.data.quailPostSlug).toBe('weekly-7');
  });
});

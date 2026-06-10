// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const applyWeeklySuggestionMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

vi.mock('@/lib/automation/weekly-suggestions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/weekly-suggestions')>('@/lib/automation/weekly-suggestions');
  return {
    ...actual,
    applyWeeklySuggestion: (...args: unknown[]) => applyWeeklySuggestionMock(...args),
  };
});

import { POST } from './route';

describe('/api/v1/weekly/suggestions/[id]/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
  });

  it('requires an idempotency key', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions/1/apply', {
      method: 'POST',
      body: JSON.stringify({ items: [{ content_id: 10, section: 'AI' }] }),
    }), { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('applies suggestion items through the automation wrapper', async () => {
    applyWeeklySuggestionMock.mockResolvedValueOnce({
      status: 'applied',
      weeklyIssueId: 7,
      linkedCount: 1,
      skippedCount: 0,
      linkedContents: [{ id: 10, title: 'A', section: 'AI', featured: true }],
      skippedContents: [],
    });

    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions/7/apply', {
      method: 'POST',
      headers: { 'idempotency-key': 'apply-7' },
      body: JSON.stringify({ items: [{ content_id: 10, section: 'AI', featured: true }] }),
    }), { params: Promise.resolve({ id: '7' }) });
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'weekly:suggest',
      workflow: 'weekly',
      step: 'suggestion_apply',
      targetType: 'weekly_issue',
      targetId: 7,
      idempotencyKey: 'apply-7',
    }));
    expect(applyWeeklySuggestionMock).toHaveBeenCalledWith({
      weeklyIssueId: 7,
      replaceExisting: false,
      sourceRunId: undefined,
      agentRunId: undefined,
      items: [{ content_id: 10, section: 'AI', featured: true }],
    });
    expect(body.meta.status).toBe('succeeded');
    expect(body.data.linkedCount).toBe(1);
  });

  it('keeps source run metadata on the apply request payload', async () => {
    applyWeeklySuggestionMock.mockResolvedValueOnce({
      status: 'applied',
      weeklyIssueId: 7,
      sourceRunId: 'auto_suggest',
      agentRunId: 'hermes_1',
      linkedCount: 1,
      skippedCount: 0,
      linkedContents: [{ id: 10, title: 'A', section: 'AI', featured: false }],
      skippedContents: [],
    });

    await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions/7/apply', {
      method: 'POST',
      headers: { 'idempotency-key': 'apply-7-source' },
      body: JSON.stringify({
        sourceRunId: 'auto_suggest',
        agentRunId: 'hermes_1',
        items: [{ content_id: 10, section: 'AI' }],
      }),
    }), { params: Promise.resolve({ id: '7' }) });

    expect(applyWeeklySuggestionMock).toHaveBeenCalledWith({
      weeklyIssueId: 7,
      replaceExisting: false,
      sourceRunId: 'auto_suggest',
      agentRunId: 'hermes_1',
      items: [{ content_id: 10, section: 'AI', featured: false }],
    });
  });
});

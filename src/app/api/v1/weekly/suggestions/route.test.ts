// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutomationRouteMock = vi.fn();
const organizeWeeklyMock = vi.fn();
const validateWeeklySuggestionItemsMock = vi.fn();

vi.mock('@/lib/automation/http', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/http')>('@/lib/automation/http');
  return {
    ...actual,
    runAutomationRoute: (...args: unknown[]) => runAutomationRouteMock(...args),
  };
});

vi.mock('@/lib/ai/server/weekly-organizer', () => ({
  organizeWeekly: (...args: unknown[]) => organizeWeeklyMock(...args),
}));

vi.mock('@/lib/automation/weekly-suggestions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/weekly-suggestions')>('@/lib/automation/weekly-suggestions');
  return {
    ...actual,
    validateWeeklySuggestionItems: (...args: unknown[]) => validateWeeklySuggestionItemsMock(...args),
  };
});

import { POST } from './route';

describe('/api/v1/weekly/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateWeeklySuggestionItemsMock.mockResolvedValue({ issue: {}, contents: [] });
    runAutomationRouteMock.mockImplementation(async (_request, options) => {
      const outcome = await options.handler();
      return Response.json({ success: true, data: outcome.result, meta: { status: outcome.status } });
    });
  });

  it('requires idempotency for suggestion generation', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      body: JSON.stringify({ weeklyIssueId: 1 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
  });

  it('returns preview artifact without applying weekly items', async () => {
    organizeWeeklyMock.mockResolvedValueOnce({ intro: 'hello', items: [{ content_id: 1, section: 'AI' }] });

    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      headers: { 'idempotency-key': 'suggest-1' },
      body: JSON.stringify({ weeklyIssueId: 1, maxItems: 5 }),
    }));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'weekly:suggest',
      workflow: 'weekly',
      step: 'suggest',
      targetType: 'weekly_issue',
      targetId: 1,
    }));
    expect(organizeWeeklyMock).toHaveBeenCalledWith({ weeklyIssueId: 1, maxItems: 5 });
    expect(body.data.status).toBe('preview');
    expect(body.data.provider).toBe('admin');
    expect(body.data.suggestion.items).toHaveLength(1);
  });

  it('registers Hermes preview artifacts without applying weekly items', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      headers: { 'idempotency-key': 'hermes-suggest-7' },
      body: JSON.stringify({
        mode: 'register',
        artifact: {
          provider: 'hermes',
          weeklyIssueId: 7,
          agentRunId: 'hermes_1',
          confidence: 0.8,
          evidenceRefs: [{ label: 'feedback digest', runId: 'auto_digest' }],
          preferenceRefs: ['pref_1'],
          items: [{ content_id: 10, section: 'AI', reason: 'matches preference' }],
        },
      }),
    }));
    const body = await response.json();

    expect(runAutomationRouteMock).toHaveBeenCalledWith(expect.any(NextRequest), expect.objectContaining({
      scope: 'weekly:suggest',
      workflow: 'weekly',
      step: 'suggest',
      targetType: 'weekly_issue',
      targetId: 7,
    }));
    expect(validateWeeklySuggestionItemsMock).toHaveBeenCalledWith({
      weeklyIssueId: 7,
      items: [expect.objectContaining({ content_id: 10, section: 'AI' })],
    });
    expect(organizeWeeklyMock).not.toHaveBeenCalled();
    expect(body.meta.status).toBe('succeeded');
    expect(body.data).toMatchObject({
      status: 'preview',
      provider: 'hermes',
      weeklyIssueId: 7,
      agentRunId: 'hermes_1',
      confidence: 0.8,
      suggestion: {
        items: [{ content_id: 10, section: 'AI', featured: false, reason: 'matches preference', evidenceRefs: [] }],
      },
    });
  });

  it('returns empty when Hermes registers an empty artifact', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      headers: { 'idempotency-key': 'hermes-empty-7' },
      body: JSON.stringify({
        mode: 'register',
        provider: 'hermes',
        weeklyIssueId: 7,
        agentRunId: 'hermes_1',
        status: 'empty',
        items: [],
      }),
    }));
    const body = await response.json();

    expect(validateWeeklySuggestionItemsMock).not.toHaveBeenCalled();
    expect(body.meta.status).toBe('empty');
    expect(body.data).toMatchObject({
      status: 'empty',
      provider: 'hermes',
      suggestion: { items: [] },
    });
  });

  it('rejects register payloads with secret-like fields', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/weekly/suggestions', {
      method: 'POST',
      headers: { 'idempotency-key': 'hermes-secret-7' },
      body: JSON.stringify({
        mode: 'register',
        provider: 'hermes',
        weeklyIssueId: 7,
        agentRunId: 'hermes_1',
        token: 'wa_secret',
        items: [{ content_id: 10, section: 'AI' }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

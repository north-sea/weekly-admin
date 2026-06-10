// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const previewWeeklySuggestionMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/services/weekly-workbench', () => ({
  previewWeeklySuggestion: (...args: unknown[]) => previewWeeklySuggestionMock(...args),
}));

import { POST } from './route';

describe('/api/weekly/workbench/[id]/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires human auth', async () => {
    authMiddlewareMock.mockRejectedValueOnce(new Error('无效的认证令牌'));

    const response = await POST(
      new NextRequest('http://localhost/api/weekly/workbench/7/suggest', {
        method: 'POST',
        body: JSON.stringify({ maxItems: 5 }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(previewWeeklySuggestionMock).not.toHaveBeenCalled();
  });

  it('returns a preview artifact without requiring automation idempotency', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    previewWeeklySuggestionMock.mockResolvedValueOnce({
      status: 'preview',
      weeklyIssueId: 7,
      suggestion: { items: [{ content_id: 10, section: 'AI' }] },
    });

    const response = await POST(
      new NextRequest('http://localhost/api/weekly/workbench/7/suggest', {
        method: 'POST',
        body: JSON.stringify({ maxItems: 5 }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('preview');
    expect(previewWeeklySuggestionMock).toHaveBeenCalledWith({ weeklyIssueId: 7, maxItems: 5 });
  });

  it('validates the weekly issue id', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });

    const response = await POST(
      new NextRequest('http://localhost/api/weekly/workbench/nope/suggest', {
        method: 'POST',
        body: JSON.stringify({ maxItems: 5 }),
      }),
      { params: Promise.resolve({ id: 'nope' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(previewWeeklySuggestionMock).not.toHaveBeenCalled();
  });
});

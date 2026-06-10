// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMiddlewareMock = vi.fn();
const applyWorkbenchSuggestionMock = vi.fn();

vi.mock('@/lib/auth-middleware', () => ({
  authMiddleware: (...args: unknown[]) => authMiddlewareMock(...args),
}));

vi.mock('@/lib/services/weekly-workbench', () => ({
  applyWorkbenchSuggestion: (...args: unknown[]) => applyWorkbenchSuggestionMock(...args),
}));

import { POST } from './route';

describe('/api/weekly/workbench/[id]/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires human auth', async () => {
    authMiddlewareMock.mockRejectedValueOnce(new Error('无效的认证令牌'));

    const response = await POST(
      new NextRequest('http://localhost/api/weekly/workbench/7/apply', {
        method: 'POST',
        body: JSON.stringify({ items: [{ content_id: 10, section: 'AI' }] }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(applyWorkbenchSuggestionMock).not.toHaveBeenCalled();
  });

  it('applies suggestion items without automation token semantics', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });
    applyWorkbenchSuggestionMock.mockResolvedValueOnce({
      status: 'applied',
      weeklyIssueId: 7,
      linkedCount: 1,
      skippedCount: 0,
      linkedContents: [{ id: 10, title: 'A', section: 'AI' }],
      skippedContents: [],
    });

    const response = await POST(
      new NextRequest('http://localhost/api/weekly/workbench/7/apply', {
        method: 'POST',
        body: JSON.stringify({ items: [{ content_id: 10, section: 'AI', featured: true }] }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.linkedCount).toBe(1);
    expect(applyWorkbenchSuggestionMock).toHaveBeenCalledWith({
      weeklyIssueId: 7,
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: true }],
    });
  });

  it('validates non-empty apply items', async () => {
    authMiddlewareMock.mockResolvedValueOnce({ id: 1 });

    const response = await POST(
      new NextRequest('http://localhost/api/weekly/workbench/7/apply', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(applyWorkbenchSuggestionMock).not.toHaveBeenCalled();
  });
});

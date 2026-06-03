import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { getSearchSuggestions, searchContentsWithFallback } from '@/lib/search';

vi.mock('@/lib/search', () => ({
  getSearchSuggestions: vi.fn(),
  searchContentsWithFallback: vi.fn(),
}));

describe('/api/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchContentsWithFallback).mockResolvedValue({
      hits: [],
      total: 0,
      page: 1,
      limit: 20,
      processingTimeMs: 1,
      query: 'test',
      meta: { mode: 'fallback', degraded: true, reason: 'meilisearch_fetch_failed' },
    });
    vi.mocked(getSearchSuggestions).mockResolvedValue([]);
  });

  it('returns fallback search results with HTTP 200 for GET', async () => {
    const request = new NextRequest('http://localhost/api/search?q=test');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.meta.mode).toBe('fallback');
  });

  it('returns fallback search results with HTTP 200 for POST', async () => {
    const request = new NextRequest('http://localhost/api/search', {
      method: 'POST',
      body: JSON.stringify({ q: 'test' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.meta.mode).toBe('fallback');
  });

  it('keeps validation errors as HTTP 400', async () => {
    const request = new NextRequest('http://localhost/api/search?limit=999');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('keeps suggestions successful when Meilisearch returns no suggestions', async () => {
    const request = new NextRequest('http://localhost/api/search?action=suggestions&q=test');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.suggestions).toEqual([]);
  });
});


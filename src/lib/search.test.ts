import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import {
  getSearchConfig,
  searchContents,
  searchContentsInMysql,
  searchContentsWithFallback,
  syncContentToSearch,
} from './search';

const { indexMock, meiliClientMock } = vi.hoisted(() => {
  const index = {
    addDocuments: vi.fn(),
    search: vi.fn(),
  };

  return {
    indexMock: index,
    meiliClientMock: {
      index: vi.fn(() => index),
    },
  };
});

vi.mock('meilisearch', () => ({
  MeiliSearch: vi.fn(function MockMeiliSearch() {
    return meiliClientMock;
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    contents: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('search service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MEILISEARCH_CONTENT_INDEX;
    delete process.env.MEILISEARCH_SHARED_INSTANCE;
    meiliClientMock.index.mockClear();
    indexMock.addDocuments.mockResolvedValue({ taskUid: 1 });
    indexMock.search.mockResolvedValue({
      hits: [{ id: 1, title: 'Result' }],
      estimatedTotalHits: 1,
      processingTimeMs: 3,
    });
    vi.mocked(prisma.contents.findMany).mockResolvedValue([
      {
        id: BigInt(1),
        title: 'Fallback',
        description: 'Desc',
        summary: 'Summary',
        content: 'Body',
        source: 'Source',
        source_url: 'https://example.com',
        content_type_id: 3,
        status: 'draft',
        category_id: 2,
        categories: { name: 'Tech' },
        content_tags: [{ tag_id: 5, tag: { name: 'AI' } }],
        view_count: BigInt(7),
        word_count: 120,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
        published_at: null,
      },
    ] as any);
    vi.mocked(prisma.contents.count).mockResolvedValue(1);
  });

  it('uses an Admin-specific index by default', async () => {
    expect(getSearchConfig().contentIndex).toBe('weekly_admin_contents');

    await searchContents({ query: 'react' });

    expect(meiliClientMock.index).toHaveBeenCalledWith('weekly_admin_contents');
  });

  it('uses the configured index name', async () => {
    process.env.MEILISEARCH_CONTENT_INDEX = 'admin_test_contents';

    await searchContents({ query: 'react' });

    expect(meiliClientMock.index).toHaveBeenCalledWith('admin_test_contents');
  });

  it('skips writes for dangerous shared index configuration', async () => {
    process.env.MEILISEARCH_SHARED_INSTANCE = 'true';
    process.env.MEILISEARCH_CONTENT_INDEX = 'contents';

    await syncContentToSearch({ id: 1, title: 'Title', content_type_id: 3 });

    expect(indexMock.addDocuments).not.toHaveBeenCalled();
    expect(getSearchConfig().misconfigured).toBe(true);
  });

  it('falls back to MySQL when Meilisearch search fails', async () => {
    indexMock.search.mockRejectedValue(new Error('fetch failed'));

    const result = await searchContentsWithFallback({ query: 'fallback', limit: 200 });

    expect(result.meta?.mode).toBe('fallback');
    expect(result.meta?.degraded).toBe(true);
    expect(result.limit).toBe(100);
    expect(result.hits[0].title).toBe('Fallback');
    expect(result.hits[0].category_name).toBe('Tech');
  });

  it('builds conservative MySQL fallback query and reports unsupported filters', async () => {
    const result = await searchContentsInMysql({
      query: 'ai',
      filters: {
        contentType: 'weekly',
        status: ['draft'],
        tagIds: [1],
      },
      sort: ['unsupported:asc'],
      limit: 10,
    }, 'test');

    expect(prisma.contents.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 10,
      orderBy: { updated_at: 'desc' },
      include: expect.objectContaining({
        categories: true,
      }),
    }));
    expect(result.meta?.unsupportedFilters).toEqual(['tagIds', 'sort:unsupported:asc']);
  });
});

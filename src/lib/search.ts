import { MeiliSearch } from 'meilisearch';
import { prisma } from '@/lib/db';

// Meilisearch client instance
const clientConfig: any = {
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
};

// Only add apiKey if it's provided
if (process.env.MEILISEARCH_MASTER_KEY) {
  clientConfig.apiKey = process.env.MEILISEARCH_MASTER_KEY;
}

const client = new MeiliSearch(clientConfig);

const DEFAULT_CONTENT_INDEX = 'weekly_admin_contents';
const DANGEROUS_SHARED_INDEX_NAMES = new Set([
  'contents',
  'bookmarks',
  'karakeep',
  'karakeep_contents',
]);

// Backward-compatible export for callers that imported the constant directly.
export const CONTENT_INDEX = DEFAULT_CONTENT_INDEX;

export type SearchMode = 'meilisearch' | 'fallback' | 'disabled' | 'misconfigured';

export interface SearchMetadata {
  mode: SearchMode;
  degraded: boolean;
  reason?: string;
  unsupportedFilters?: string[];
}

export interface SearchConfig {
  host: string;
  contentIndex: string;
  sharedInstance: boolean;
  misconfigured: boolean;
  reason?: string;
}

export const getSearchConfig = (): SearchConfig => {
  const host = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
  const contentIndex = process.env.MEILISEARCH_CONTENT_INDEX || DEFAULT_CONTENT_INDEX;
  const sharedInstance = process.env.MEILISEARCH_SHARED_INSTANCE === 'true';
  const normalizedIndex = contentIndex.trim().toLowerCase();
  const misconfigured = sharedInstance && DANGEROUS_SHARED_INDEX_NAMES.has(normalizedIndex);

  return {
    host,
    contentIndex,
    sharedInstance,
    misconfigured,
    reason: misconfigured
      ? `Shared Meilisearch instances cannot use the generic "${contentIndex}" index`
      : undefined,
  };
};

const getContentIndex = () => client.index(getSearchConfig().contentIndex);

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error)
);

const getSafeFailureReason = (error: unknown) => {
  const message = getErrorMessage(error);

  if (message.includes('ECONNREFUSED')) return 'meilisearch_connection_refused';
  if (message.includes('ENOTFOUND')) return 'meilisearch_host_not_found';
  if (message.includes('fetch failed')) return 'meilisearch_fetch_failed';
  if (message.toLowerCase().includes('auth') || message.includes('Invalid API key')) {
    return 'meilisearch_auth_failed';
  }
  if (message.toLowerCase().includes('not found')) return 'meilisearch_index_not_found';

  return 'meilisearch_unavailable';
};

// Search document interface
export interface SearchDocument {
  id: number;
  title: string;
  description?: string;
  content: string;
  source?: string;
  source_url?: string;
  content_type_id: number;
  content_type_name: string;
  status: string;
  category_id?: number;
  category_name?: string;
  tag_ids: number[];
  tag_names: string;
  user_id?: number;
  user_name?: string;
  view_count: number;
  word_count: number;
  created_at: number; // Unix timestamp for better sorting
  updated_at: number;
  published_at?: number;
}

// Search filters interface
export interface SearchFilters {
  contentType?: 'blog' | 'weekly';
  status?: string[];
  categoryIds?: number[];
  tagIds?: number[];
  dateRange?: [string, string];
  sources?: string[];
  userId?: number;
}

// Search options interface
export interface SearchOptions {
  query?: string;
  filters?: SearchFilters;
  sort?: string[];
  page?: number;
  limit?: number;
  attributesToHighlight?: string[];
}

// Search result interface
export interface SearchResult {
  hits: SearchDocument[];
  total: number;
  page: number;
  limit: number;
  processingTimeMs: number;
  query: string;
  meta?: SearchMetadata;
}

/**
 * Setup content search index with proper configuration
 */
export const setupContentIndex = async (): Promise<void> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    throw new Error(config.reason);
  }

  try {
    const index = getContentIndex();
    
    // Set searchable attributes (fields that can be searched)
    await index.updateSearchableAttributes([
      'title',
      'description', 
      'content',
      'source',
      'category_name',
      'tag_names',
      'user_name'
    ]);
    
    // Set filterable attributes (fields that can be used in filters)
    await index.updateFilterableAttributes([
      'content_type_id',
      'content_type_name',
      'status',
      'category_id',
      'category_name',
      'tag_ids',
      'user_id',
      'created_at',
      'updated_at',
      'published_at',
      'source'
    ]);
    
    // Set sortable attributes (fields that can be used for sorting)
    await index.updateSortableAttributes([
      'created_at',
      'updated_at', 
      'published_at',
      'view_count',
      'word_count',
      'title'
    ]);
    
    // Set ranking rules for search relevance
    await index.updateRankingRules([
      'words',
      'typo',
      'exactness',
      'proximity',
      'attribute',
      'sort'
    ]);
    
    // Configure typo tolerance for better search experience
    await index.updateTypoTolerance({
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,
        twoTypos: 8
      }
    });
    
    // Set pagination limits
    await index.updatePagination({
      maxTotalHits: 10000
    });
    
    console.log('Meilisearch content index configured successfully');
  } catch (error) {
    console.error('Failed to setup content index:', error);
    throw error;
  }
};

/**
 * Add or update a document in the search index
 */
export const syncContentToSearch = async (content: any): Promise<void> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    console.warn(`Search index sync skipped: ${config.reason}`);
    return;
  }

  try {
    const index = getContentIndex();
    
    const searchDocument: SearchDocument = {
      id: Number(content.id),
      title: content.title,
      description: content.description || '',
      content: content.content,
      source: content.source || '',
      source_url: content.source_url || '',
      content_type_id: content.content_type_id,
      content_type_name: content.content_type_id === 3 ? 'Weekly' : 'Blog',
      status: content.status,
      category_id: content.category_id,
      category_name: content.category?.name || '',
      tag_ids: content.tags?.map((t: any) => t.id) || [],
      tag_names: content.tags?.map((t: any) => t.name).join(' ') || '',
      user_id: content.user_id,
      user_name: content.user?.display_name || content.user?.username || '',
      view_count: content.view_count || 0,
      word_count: content.word_count || 0,
      created_at: new Date(content.created_at).getTime(),
      updated_at: new Date(content.updated_at).getTime(),
      published_at: content.published_at ? new Date(content.published_at).getTime() : undefined,
    };
    
    const task = await index.addDocuments([searchDocument]);
    console.log(`Content ${content.id} synced to search index, task ID: ${task.taskUid}`);
  } catch (error) {
    // Don't throw error if Meilisearch is unavailable - just log it
    console.warn(`Failed to sync content ${content.id} to search (Meilisearch may be unavailable):`, error instanceof Error ? error.message : error);
  }
};

/**
 * Remove a document from the search index
 */
export const removeContentFromSearch = async (contentId: number): Promise<void> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    console.warn(`Search index removal skipped: ${config.reason}`);
    return;
  }

  try {
    const index = getContentIndex();
    await index.deleteDocument(contentId);
    console.log(`Content ${contentId} removed from search index`);
  } catch (error) {
    // Don't throw error if Meilisearch is unavailable - just log it
    console.warn(`Failed to remove content ${contentId} from search (Meilisearch may be unavailable):`, error instanceof Error ? error.message : error);
  }
};

/**
 * Bulk sync multiple contents to search index
 */
export const bulkSyncContentsToSearch = async (contents: any[]): Promise<any> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    console.warn(`Bulk search index sync skipped: ${config.reason}`);
    return null;
  }

  try {
    const index = getContentIndex();
    
    const searchDocuments: SearchDocument[] = contents.map(content => ({
      id: Number(content.id),
      title: content.title,
      description: content.description || '',
      content: content.content,
      source: content.source || '',
      source_url: content.source_url || '',
      content_type_id: content.content_type_id,
      content_type_name: content.content_type_id === 3 ? 'Weekly' : 'Blog',
      status: content.status,
      category_id: content.category_id,
      category_name: content.category?.name || '',
      tag_ids: content.tags?.map((t: any) => t.id) || [],
      tag_names: content.tags?.map((t: any) => t.name).join(' ') || '',
      user_id: content.user_id,
      user_name: content.user?.display_name || content.user?.username || '',
      view_count: content.view_count || 0,
      word_count: content.word_count || 0,
      created_at: new Date(content.created_at).getTime(),
      updated_at: new Date(content.updated_at).getTime(),
      published_at: content.published_at ? new Date(content.published_at).getTime() : undefined,
    }));
    
    const task = await index.addDocuments(searchDocuments);
    console.log(`${contents.length} contents synced to search index, task ID: ${task.taskUid}`);
    return task;
  } catch (error) {
    // Don't throw error if Meilisearch is unavailable - just log it
    console.warn('Failed to bulk sync contents to search (Meilisearch may be unavailable):', error instanceof Error ? error.message : error);
    return null;
  }
};

/**
 * Search contents with filters and options
 */
export const searchContents = async (options: SearchOptions): Promise<SearchResult> => {
  try {
    const index = getContentIndex();
    const { query = '', filters, sort, page = 1, limit = 20, attributesToHighlight } = options;
    
    // Build filter string
    let filterString = '';
    if (filters) {
      const filterParts: string[] = [];
      
      if (filters.contentType) {
        const typeId = filters.contentType === 'weekly' ? 3 : 4;
        filterParts.push(`content_type_id = ${typeId}`);
      }
      
      if (filters.status && filters.status.length > 0) {
        const statusFilter = filters.status.map(s => `status = "${s}"`).join(' OR ');
        filterParts.push(`(${statusFilter})`);
      }
      
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        const categoryFilter = filters.categoryIds.map(id => `category_id = ${id}`).join(' OR ');
        filterParts.push(`(${categoryFilter})`);
      }
      
      if (filters.tagIds && filters.tagIds.length > 0) {
        const tagFilter = filters.tagIds.map(id => `tag_ids = ${id}`).join(' OR ');
        filterParts.push(`(${tagFilter})`);
      }
      
      if (filters.userId) {
        filterParts.push(`user_id = ${filters.userId}`);
      }
      
      if (filters.sources && filters.sources.length > 0) {
        const sourceFilter = filters.sources.map(s => `source = "${s}"`).join(' OR ');
        filterParts.push(`(${sourceFilter})`);
      }
      
      if (filters.dateRange && filters.dateRange.length === 2) {
        const startTime = new Date(filters.dateRange[0]).getTime();
        const endTime = new Date(filters.dateRange[1]).getTime();
        filterParts.push(`created_at >= ${startTime} AND created_at <= ${endTime}`);
      }
      
      filterString = filterParts.join(' AND ');
    }
    
    // Perform search
    const searchParams: any = {
      q: query,
      offset: (page - 1) * limit,
      limit,
      attributesToHighlight: attributesToHighlight || ['title', 'description', 'content'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    };
    
    if (filterString) {
      searchParams.filter = filterString;
    }
    
    if (sort && sort.length > 0) {
      searchParams.sort = sort;
    }
    
    const result = await index.search(query, searchParams);
    
    return {
      hits: result.hits as SearchDocument[],
      total: result.estimatedTotalHits || 0,
      page,
      limit,
      processingTimeMs: result.processingTimeMs,
      query,
      meta: {
        mode: 'meilisearch',
        degraded: false,
      },
    };
  } catch (error) {
    console.warn('Meilisearch search failed:', getSafeFailureReason(error));
    throw error;
  }
};

const clampLimit = (limit: number | undefined) => Math.min(Math.max(limit || 20, 1), 100);

const parseSort = (sort?: string[]) => {
  const unsupportedFilters: string[] = [];
  const allowedFields = new Set([
    'created_at',
    'updated_at',
    'published_at',
    'view_count',
    'word_count',
    'title',
  ]);

  const firstSort = sort?.[0];
  if (!firstSort) {
    return {
      orderBy: { updated_at: 'desc' as const },
      unsupportedFilters,
    };
  }

  const [field, direction = 'desc'] = firstSort.split(':');
  if (!allowedFields.has(field) || !['asc', 'desc'].includes(direction)) {
    unsupportedFilters.push(`sort:${firstSort}`);
    return {
      orderBy: { updated_at: 'desc' as const },
      unsupportedFilters,
    };
  }

  return {
    orderBy: { [field]: direction as 'asc' | 'desc' },
    unsupportedFilters,
  };
};

const mapContentToSearchDocument = (content: any): SearchDocument => ({
  id: Number(content.id),
  title: content.title,
  description: content.description || '',
  content: content.content || '',
  source: content.source || '',
  source_url: content.source_url || '',
  content_type_id: content.content_type_id,
  content_type_name: content.content_type_id === 3 ? 'Weekly' : 'Blog',
  status: content.status || '',
  category_id: content.category_id || undefined,
  category_name: content.category?.name || '',
  tag_ids: content.content_tags?.map((item: any) => item.tag_id) || [],
  tag_names: content.content_tags?.map((item: any) => item.tag?.name).filter(Boolean).join(' ') || '',
  user_id: content.user_id || undefined,
  user_name: content.user?.display_name || content.user?.username || '',
  view_count: Number(content.view_count || 0),
  word_count: content.word_count || 0,
  created_at: content.created_at ? new Date(content.created_at).getTime() : 0,
  updated_at: content.updated_at ? new Date(content.updated_at).getTime() : 0,
  published_at: content.published_at ? new Date(content.published_at).getTime() : undefined,
});

export const searchContentsInMysql = async (
  options: SearchOptions,
  reason: string,
): Promise<SearchResult> => {
  const startTime = Date.now();
  const { query = '', filters, page = 1, sort } = options;
  const limit = clampLimit(options.limit);
  const skip = (page - 1) * limit;
  const unsupportedFilters: string[] = [];
  const trimmedQuery = query.trim();
  const whereParts: any[] = [];

  if (trimmedQuery) {
    whereParts.push({
      OR: [
        { title: { contains: trimmedQuery } },
        { description: { contains: trimmedQuery } },
        { summary: { contains: trimmedQuery } },
        { content: { contains: trimmedQuery } },
        { source: { contains: trimmedQuery } },
        { source_url: { contains: trimmedQuery } },
      ],
    });
  }

  if (filters?.contentType) {
    whereParts.push({ content_type_id: filters.contentType === 'weekly' ? 3 : 4 });
  }

  if (filters?.status?.length) {
    whereParts.push({ status: { in: filters.status } });
  }

  if (filters?.categoryIds?.length) {
    whereParts.push({ category_id: { in: filters.categoryIds } });
  }

  if (filters?.sources?.length) {
    whereParts.push({ source: { in: filters.sources } });
  }

  if (filters?.userId) {
    whereParts.push({ user_id: filters.userId });
  }

  if (filters?.dateRange?.length === 2) {
    whereParts.push({
      created_at: {
        gte: new Date(filters.dateRange[0]),
        lte: new Date(filters.dateRange[1]),
      },
    });
  }

  if (filters?.tagIds?.length) {
    unsupportedFilters.push('tagIds');
  }

  const { orderBy, unsupportedFilters: unsupportedSorts } = parseSort(sort);
  unsupportedFilters.push(...unsupportedSorts);

  const where = whereParts.length > 0 ? { AND: whereParts } : {};

  const [contents, total] = await Promise.all([
    prisma.contents.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: true,
        content_tags: {
          include: {
            tag: true,
          },
        },
      },
    } as any),
    prisma.contents.count({ where } as any),
  ]);

  return {
    hits: contents.map(mapContentToSearchDocument),
    total,
    page,
    limit,
    processingTimeMs: Date.now() - startTime,
    query,
    meta: {
      mode: 'fallback',
      degraded: true,
      reason,
      unsupportedFilters: unsupportedFilters.length > 0 ? unsupportedFilters : undefined,
    },
  };
};

export const searchContentsWithFallback = async (options: SearchOptions): Promise<SearchResult> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    console.warn(`Search request using MySQL fallback: ${config.reason}`);
    return searchContentsInMysql(options, 'meilisearch_misconfigured');
  }

  try {
    return await searchContents(options);
  } catch (error) {
    const reason = getSafeFailureReason(error);
    console.warn(`Search request using MySQL fallback: ${reason}`);
    return searchContentsInMysql(options, reason);
  }
};

/**
 * Get search suggestions/autocomplete
 */
export const getSearchSuggestions = async (query: string, limit: number = 5): Promise<string[]> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    console.warn(`Search suggestions skipped: ${config.reason}`);
    return [];
  }

  try {
    const index = getContentIndex();
    
    const result = await index.search(query, {
      limit,
      attributesToRetrieve: ['title'],
      attributesToHighlight: [],
    });
    
    return result.hits.map((hit: any) => hit.title).filter(Boolean);
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
};

/**
 * Get index statistics
 */
export const getIndexStats = async () => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    throw new Error(config.reason);
  }

  try {
    const index = getContentIndex();
    const stats = await index.getStats();
    return stats;
  } catch (error) {
    console.error('Failed to get index stats:', error);
    throw error;
  }
};

/**
 * Clear all documents from the index
 */
export const clearSearchIndex = async (): Promise<void> => {
  const config = getSearchConfig();
  if (config.misconfigured) {
    throw new Error(config.reason);
  }

  try {
    const index = getContentIndex();
    await index.deleteAllDocuments();
    console.log('Search index cleared');
  } catch (error) {
    console.error('Failed to clear search index:', error);
    throw error;
  }
};

/**
 * Wait for a task to complete
 */
export const waitForTask = async (taskUid: number): Promise<void> => {
  try {
    let task;
    do {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      task = await (client as any).getTask(taskUid);
    } while (task.status === 'enqueued' || task.status === 'processing');
    
    if (task.status === 'succeeded') {
      console.log(`Task ${taskUid} completed successfully`);
    } else {
      console.error(`Task ${taskUid} failed:`, task.error);
      throw new Error(`Task ${taskUid} failed: ${task.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`Failed to wait for task ${taskUid}:`, error);
    throw error;
  }
};

/**
 * Get task status
 */
export const getTaskStatus = async (taskUid: number) => {
  try {
    return await (client as any).getTask(taskUid);
  } catch (error) {
    console.error(`Failed to get task ${taskUid} status:`, error);
    throw error;
  }
};

export default client;

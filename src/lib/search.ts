import { MeiliSearch, Index } from 'meilisearch';

// Meilisearch client instance
const clientConfig: any = {
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
};

// Only add apiKey if it's provided
if (process.env.MEILISEARCH_MASTER_KEY) {
  clientConfig.apiKey = process.env.MEILISEARCH_MASTER_KEY;
}

const client = new MeiliSearch(clientConfig);

// Content index name
export const CONTENT_INDEX = 'contents';

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
}

/**
 * Setup content search index with proper configuration
 */
export const setupContentIndex = async (): Promise<void> => {
  try {
    const index = client.index(CONTENT_INDEX);
    
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
  try {
    const index = client.index(CONTENT_INDEX);
    
    const searchDocument: SearchDocument = {
      id: Number(content.id),
      title: content.title,
      description: content.description || '',
      content: content.content,
      source: content.source || '',
      source_url: content.source_url || '',
      content_type_id: content.content_type_id,
      content_type_name: content.content_type_id === 3 ? 'Blog' : 'Weekly',
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
  try {
    const index = client.index(CONTENT_INDEX);
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
  try {
    const index = client.index(CONTENT_INDEX);
    
    const searchDocuments: SearchDocument[] = contents.map(content => ({
      id: Number(content.id),
      title: content.title,
      description: content.description || '',
      content: content.content,
      source: content.source || '',
      source_url: content.source_url || '',
      content_type_id: content.content_type_id,
      content_type_name: content.content_type_id === 3 ? 'Blog' : 'Weekly',
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
    const index = client.index(CONTENT_INDEX);
    const { query = '', filters, sort, page = 1, limit = 20, attributesToHighlight } = options;
    
    // Build filter string
    let filterString = '';
    if (filters) {
      const filterParts: string[] = [];
      
      if (filters.contentType) {
        const typeId = filters.contentType === 'blog' ? 3 : 4;
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
    };
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
};

/**
 * Get search suggestions/autocomplete
 */
export const getSearchSuggestions = async (query: string, limit: number = 5): Promise<string[]> => {
  try {
    const index = client.index(CONTENT_INDEX);
    
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
  try {
    const index = client.index(CONTENT_INDEX);
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
  try {
    const index = client.index(CONTENT_INDEX);
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
      task = await client.getTask(taskUid);
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
    return await client.getTask(taskUid);
  } catch (error) {
    console.error(`Failed to get task ${taskUid} status:`, error);
    throw error;
  }
};

export default client;
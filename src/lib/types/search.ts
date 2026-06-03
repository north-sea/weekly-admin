export interface SearchFilters {
  contentType?: 'blog' | 'weekly';
  status?: string[];
  categoryIds?: number[];
  tagIds?: number[];
  dateRange?: [string, string];
  sources?: string[];
  userId?: number;
}

export interface SearchOptions {
  query?: string;
  filters?: SearchFilters;
  sort?: string[];
  page?: number;
  limit?: number;
  highlight?: boolean;
  attributesToHighlight?: string[];
}

export interface SearchResult {
  hits: any[];
  total: number;
  page: number;
  limit: number;
  processingTimeMs: number;
  query: string;
  meta?: {
    mode: 'meilisearch' | 'fallback' | 'disabled' | 'misconfigured';
    degraded: boolean;
    reason?: string;
    unsupportedFilters?: string[];
  };
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  filters?: SearchFilters;
  timestamp: number;
}

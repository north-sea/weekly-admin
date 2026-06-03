// Search API Service
// 搜索服务 - 提供搜索相关的 API 端点和类型定义

import { SearchOptions, SearchResult } from '@/hooks/useSearch';

// 搜索建议响应类型
export interface SearchSuggestionsResponse {
  suggestions: string[];
}

// 构建搜索查询参数的工具函数
export function buildSearchQueryParams(options: SearchOptions): string {
  const params = new URLSearchParams();
  
  if (options.query) params.set('q', options.query);
  if (options.page) params.set('page', options.page.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.highlight !== undefined) params.set('highlight', options.highlight.toString());
  
  if (options.filters) {
    const { contentType, status, categoryIds, tagIds, dateRange, sources, userId } = options.filters;
    
    if (contentType) params.set('contentType', contentType);
    if (status && status.length > 0) params.set('status', status.join(','));
    if (categoryIds && categoryIds.length > 0) params.set('categoryIds', categoryIds.join(','));
    if (tagIds && tagIds.length > 0) params.set('tagIds', tagIds.join(','));
    if (sources && sources.length > 0) params.set('sources', sources.join(','));
    if (userId) params.set('userId', userId.toString());
    if (dateRange && dateRange.length === 2) params.set('dateRange', dateRange.join(','));
  }
  
  if (options.sort && options.sort.length > 0) {
    params.set('sort', options.sort.join(','));
  }
  
  return params.toString();
}

// 搜索 API 端点常量
export const SEARCH_ENDPOINTS = {
  search: '/api/search',
  suggestions: '/api/search',
} as const;

// 搜索 API 函数 - 用于 React Query
export const searchApi = {
  // 执行搜索
  search: async (options: SearchOptions): Promise<SearchResult> => {
    const { apiClient } = await import('@/lib/api-client');
    const queryString = buildSearchQueryParams(options);
    const response = await apiClient.get<{ success: boolean; data: SearchResult }>(
      `${SEARCH_ENDPOINTS.search}?${queryString}`
    );
    return response.data;
  },
  
  // 获取搜索建议
  suggestions: async (query: string, limit: number = 5): Promise<SearchSuggestionsResponse> => {
    const { apiClient } = await import('@/lib/api-client');
    const response = await apiClient.get<{ success: boolean; data: SearchSuggestionsResponse }>(
      `${SEARCH_ENDPOINTS.suggestions}?action=suggestions&q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return response.data;
  },
};

// Search Queries - React Query hooks for search functionality
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useApi';
import { searchApi } from '@/lib/services/search-api';
import { SearchOptions, SearchResult } from '@/lib/types/search';

// 搜索查询 hook
export function useSearchQuery(options: SearchOptions, enabled: boolean = false) {
  return useQuery({
    queryKey: queryKeys.search.query(options as Record<string, unknown>),
    queryFn: () => searchApi.search(options),
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// 搜索建议查询 hook
export function useSearchSuggestions(query: string, limit: number = 5, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.search.suggestions(query, limit),
    queryFn: () => searchApi.suggestions(query, limit),
    enabled: enabled && !!query.trim(),
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// 搜索 mutation hook (用于手动触发搜索)
export function useSearchMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (options: SearchOptions) => searchApi.search(options),
    onSuccess: (data, variables) => {
      // 更新查询缓存
      queryClient.setQueryData(queryKeys.search.query(variables as Record<string, unknown>), data);
    },
  });
}

// 预取搜索结果
export function usePrefetchSearch() {
  const queryClient = useQueryClient();
  
  return (options: SearchOptions) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.search.query(options as Record<string, unknown>),
      queryFn: () => searchApi.search(options),
      staleTime: 30000,
    });
  };
}

// 预取搜索建议
export function usePrefetchSuggestions() {
  const queryClient = useQueryClient();
  
  return (query: string, limit: number = 5) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.search.suggestions(query, limit),
      queryFn: () => searchApi.suggestions(query, limit),
      staleTime: 60000,
    });
  };
}

// 清除搜索缓存
export function useClearSearchCache() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.removeQueries({ queryKey: ['search'] });
  };
}

'use client';

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, ApiOptions } from '@/lib/api-client';

// 查询键生成器
export const queryKeys = {
  // 内容相关
  content: {
    all: ['content'] as const,
    lists: () => [...queryKeys.content.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.content.lists(), params] as const,
    details: () => [...queryKeys.content.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.content.details(), id] as const,
  },
  // 分类相关
  categories: {
    all: ['categories'] as const,
    lists: () => [...queryKeys.categories.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.categories.lists(), params] as const,
    details: () => [...queryKeys.categories.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.categories.details(), id] as const,
  },
  // 标签相关
  tags: {
    all: ['tags'] as const,
    lists: () => [...queryKeys.tags.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.tags.lists(), params] as const,
    details: () => [...queryKeys.tags.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.tags.details(), id] as const,
  },
  // 用户相关
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
  },
} as const;

// 通用查询钩子
export function useApiQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, ...queryOptions } = options || {};
  
  return useQuery<TData, TError>({
    queryKey,
    queryFn: () => apiClient.get<TData>(url, apiOptions),
    ...queryOptions,
  });
}

// GET 请求钩子
export function useGet<TData = unknown, TError = Error>(
  url: string,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryFn'> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, queryKey, ...queryOptions } = options || {};
  const defaultQueryKey = [url];
  
  return useQuery<TData, TError>({
    queryKey: queryKey || defaultQueryKey,
    queryFn: () => apiClient.get<TData>(url, apiOptions),
    ...queryOptions,
  });
}

// POST 突变钩子
export function usePost<TData = unknown, TVariables = unknown, TError = Error>(
  url: string,
  options?: UseMutationOptions<TData, TError, TVariables> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, ...mutationOptions } = options || {};
  
  return useMutation<TData, TError, TVariables>({
    mutationFn: (variables: TVariables) => apiClient.post<TData>(url, variables, apiOptions),
    ...mutationOptions,
  });
}

// PUT 突变钩子
export function usePut<TData = unknown, TVariables = unknown, TError = Error>(
  url: string,
  options?: UseMutationOptions<TData, TError, TVariables> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, ...mutationOptions } = options || {};
  
  return useMutation<TData, TError, TVariables>({
    mutationFn: (variables: TVariables) => apiClient.put<TData>(url, variables, apiOptions),
    ...mutationOptions,
  });
}

// DELETE 突变钩子
export function useDelete<TData = unknown, TVariables = unknown, TError = Error>(
  url: string,
  options?: UseMutationOptions<TData, TError, TVariables> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, ...mutationOptions } = options || {};
  
  return useMutation<TData, TError, TVariables>({
    mutationFn: (variables: TVariables) => apiClient.delete<TData>(url, apiOptions),
    ...mutationOptions,
  });
}

// 通用突变钩子
export function useApiMutation<TData = unknown, TVariables = unknown, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables>
) {
  return useMutation<TData, TError, TVariables>({
    mutationFn,
    ...options,
  });
}

// 无效化查询的辅助钩子
export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    // 无效化所有查询
    invalidateAll: () => queryClient.invalidateQueries(),
    
    // 无效化特定查询
    invalidate: (queryKey: readonly unknown[]) => 
      queryClient.invalidateQueries({ queryKey }),
    
    // 无效化内容相关查询
    invalidateContent: () => 
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all }),
    
    // 无效化分类相关查询
    invalidateCategories: () => 
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
    
    // 无效化标签相关查询
    invalidateTags: () => 
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all }),
    
    // 移除查询
    remove: (queryKey: readonly unknown[]) => 
      queryClient.removeQueries({ queryKey }),
    
    // 设置查询数据
    setQueryData: <T>(queryKey: readonly unknown[], data: T) => 
      queryClient.setQueryData(queryKey, data),
  };
}

// 预取数据的辅助钩子
export function usePrefetch() {
  const queryClient = useQueryClient();
  
  return {
    prefetchQuery: <TData>(queryKey: readonly unknown[], url: string, apiOptions?: ApiOptions) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => apiClient.get<TData>(url, apiOptions),
        staleTime: 5 * 60 * 1000, // 5分钟
      }),
  };
}
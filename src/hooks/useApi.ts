'use client';

import { 
  useQuery, 
  useMutation, 
  useInfiniteQuery,
  useQueryClient, 
  UseQueryOptions, 
  UseMutationOptions,
  UseInfiniteQueryOptions,
  InfiniteData
} from '@tanstack/react-query';
import { apiClient, ApiOptions } from '@/lib/api-client';
import type { ApiResponse, PaginatedData, QueryParams } from '@/types';

// 通用类型定义
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BatchOperationParams {
  action: 'create' | 'update' | 'delete';
  ids?: (string | number)[];
  data?: Record<string, any>;
}

// 增强的查询键生成器
export const queryKeys = {
  // 内容相关
  content: {
    all: ['content'] as const,
    lists: () => [...queryKeys.content.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.content.lists(), params] as const,
    infinite: (params?: Record<string, any>) => [...queryKeys.content.all, 'infinite', params] as const,
    details: () => [...queryKeys.content.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.content.details(), id] as const,
    versions: (id: string | number) => [...queryKeys.content.detail(id), 'versions'] as const,
    stats: () => [...queryKeys.content.all, 'stats'] as const,
  },
  // 分类相关
  categories: {
    all: ['categories'] as const,
    lists: () => [...queryKeys.categories.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.categories.lists(), params] as const,
    details: () => [...queryKeys.categories.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.categories.details(), id] as const,
    stats: () => [...queryKeys.categories.all, 'stats'] as const,
  },
  // 标签相关
  tags: {
    all: ['tags'] as const,
    lists: () => [...queryKeys.tags.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.tags.lists(), params] as const,
    details: () => [...queryKeys.tags.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.tags.details(), id] as const,
    popular: (limit?: number) => [...queryKeys.tags.all, 'popular', limit] as const,
    stats: () => [...queryKeys.tags.all, 'stats'] as const,
  },
  // 分析相关
  analytics: {
    all: ['analytics'] as const,
    overview: (timeRange?: number) => [...queryKeys.analytics.all, 'overview', timeRange] as const,
    sources: (timeRange?: number) => [...queryKeys.analytics.all, 'sources', timeRange] as const,
    advanced: (timeRange?: number) => [...queryKeys.analytics.all, 'advanced', timeRange] as const,
    export: () => [...queryKeys.analytics.all, 'export'] as const,
  },
  // 周刊相关
  weekly: {
    all: ['weekly'] as const,
    lists: () => [...queryKeys.weekly.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.weekly.lists(), params] as const,
    details: () => [...queryKeys.weekly.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.weekly.details(), id] as const,
    contents: (id: string | number) => [...queryKeys.weekly.detail(id), 'contents'] as const,
    availableContents: () => [...queryKeys.weekly.all, 'available-contents'] as const,
    stats: (id: string | number) => [...queryKeys.weekly.detail(id), 'stats'] as const,
  },
  // 操作日志相关
  operationLogs: {
    all: ['operation-logs'] as const,
    lists: () => [...queryKeys.operationLogs.all, 'list'] as const,
    list: (params?: Record<string, any>) => [...queryKeys.operationLogs.lists(), params] as const,
    stats: () => [...queryKeys.operationLogs.all, 'stats'] as const,
    export: () => [...queryKeys.operationLogs.all, 'export'] as const,
  },
  // 搜索相关
  search: {
    all: ['search'] as const,
    results: (query: string, filters?: Record<string, any>) => [...queryKeys.search.all, 'results', query, filters] as const,
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



// 分页查询钩子
export function usePaginatedQuery<TData = unknown, TError = Error>(
  url: string,
  params?: PaginationParams & Record<string, any>,
  options?: Omit<UseQueryOptions<PaginatedResponse<TData>, TError>, 'queryFn'> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, queryKey, ...queryOptions } = options || {};
  const queryParams = new URLSearchParams();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }
  
  const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
  const defaultQueryKey = [url, 'paginated', params];
  
  return useQuery<PaginatedResponse<TData>, TError>({
    queryKey: queryKey || defaultQueryKey,
    queryFn: () => apiClient.get<PaginatedResponse<TData>>(fullUrl, apiOptions),
    ...queryOptions,
  });
}

// 无限滚动查询钩子
export function useInfiniteScrollQuery<TData = unknown, TError = Error>(
  url: string,
  params?: Omit<PaginationParams, 'page'> & Record<string, any>,
  options?: {
    apiOptions?: ApiOptions;
    queryKey?: readonly unknown[];
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
    retry?: boolean | number;
  }
) {
  const { apiOptions, queryKey, ...queryOptions } = options || {};
  const defaultQueryKey = [url, 'infinite', params];
  
  return useInfiniteQuery({
    queryKey: queryKey || defaultQueryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => {
      const queryParams = new URLSearchParams();
      
      // 添加分页参数
      queryParams.append('page', String(pageParam));
      
      // 添加其他参数
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const fullUrl = `${url}?${queryParams.toString()}`;
      return apiClient.get<PaginatedResponse<TData>>(fullUrl, apiOptions);
    },
    getNextPageParam: (lastPage: PaginatedResponse<TData>) => {
      const { pagination } = lastPage;
      return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
    },
    ...queryOptions,
  });
}

// 批量操作钩子
export function useBatchMutation<TData = unknown, TError = Error>(
  url: string,
  options?: UseMutationOptions<TData, TError, BatchOperationParams> & {
    apiOptions?: ApiOptions;
  }
) {
  const { apiOptions, ...mutationOptions } = options || {};
  
  return useMutation<TData, TError, BatchOperationParams>({
    mutationFn: (params: BatchOperationParams) => {
      return apiClient.post<TData>(`${url}/batch`, params, apiOptions);
    },
    ...mutationOptions,
  });
}

// 乐观更新钩子
export function useOptimisticUpdate() {
  const queryClient = useQueryClient();
  
  return {
    // 乐观更新单个项目
    updateItem: <T>(
      queryKey: readonly unknown[],
      id: string | number,
      updater: (oldData: T) => T
    ) => {
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        
        // 处理分页数据结构
        if (oldData.data && Array.isArray(oldData.data)) {
          return {
            ...oldData,
            data: oldData.data.map((item: any) => 
              item.id === id ? updater(item) : item
            ),
          };
        }
        
        // 处理普通数组
        if (Array.isArray(oldData)) {
          return oldData.map((item: any) => 
            item.id === id ? updater(item) : item
          );
        }
        
        // 处理单个对象
        if (oldData.id === id) {
          return updater(oldData);
        }
        
        return oldData;
      });
    },
    
    // 乐观添加项目
    addItem: <T>(
      queryKey: readonly unknown[],
      newItem: T,
      position: 'start' | 'end' = 'start'
    ) => {
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        
        // 处理分页数据结构
        if (oldData.data && Array.isArray(oldData.data)) {
          const newData = position === 'start' 
            ? [newItem, ...oldData.data]
            : [...oldData.data, newItem];
          
          return {
            ...oldData,
            data: newData,
            pagination: {
              ...oldData.pagination,
              total: oldData.pagination.total + 1,
            },
          };
        }
        
        // 处理普通数组
        if (Array.isArray(oldData)) {
          return position === 'start' 
            ? [newItem, ...oldData]
            : [...oldData, newItem];
        }
        
        return oldData;
      });
    },
    
    // 乐观删除项目
    removeItem: <T>(
      queryKey: readonly unknown[],
      id: string | number
    ) => {
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        
        // 处理分页数据结构
        if (oldData.data && Array.isArray(oldData.data)) {
          const filteredData = oldData.data.filter((item: any) => item.id !== id);
          
          return {
            ...oldData,
            data: filteredData,
            pagination: {
              ...oldData.pagination,
              total: Math.max(0, oldData.pagination.total - 1),
            },
          };
        }
        
        // 处理普通数组
        if (Array.isArray(oldData)) {
          return oldData.filter((item: any) => item.id !== id);
        }
        
        return oldData;
      });
    },
  };
}

// 增强的无效化查询钩子
export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    // 无效化所有查询
    invalidateAll: () => queryClient.invalidateQueries(),
    
    // 无效化特定查询
    invalidate: (queryKey: readonly unknown[]) => 
      queryClient.invalidateQueries({ queryKey }),
    
    // 无效化内容相关查询
    invalidateContent: (id?: string | number) => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.content.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.content.versions(id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.content.all });
    },
    
    // 无效化分类相关查询
    invalidateCategories: (id?: string | number) => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.detail(id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
    
    // 无效化标签相关查询
    invalidateTags: (id?: string | number) => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tags.detail(id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
    
    // 无效化分析相关查询
    invalidateAnalytics: () => 
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    
    // 无效化周刊相关查询
    invalidateWeekly: (id?: string | number) => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.weekly.detail(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.weekly.contents(id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.weekly.stats(id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.weekly.all });
    },
    
    // 无效化搜索相关查询
    invalidateSearch: () => 
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    
    // 移除查询
    remove: (queryKey: readonly unknown[]) => 
      queryClient.removeQueries({ queryKey }),
    
    // 设置查询数据
    setQueryData: <T>(queryKey: readonly unknown[], data: T) => 
      queryClient.setQueryData(queryKey, data),
    
    // 获取查询数据
    getQueryData: <T>(queryKey: readonly unknown[]): T | undefined =>
      queryClient.getQueryData<T>(queryKey),
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
      
    prefetchPaginatedQuery: <TData>(
      queryKey: readonly unknown[], 
      url: string, 
      params?: PaginationParams, 
      apiOptions?: ApiOptions
    ) => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const fullUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
      
      return queryClient.prefetchQuery({
        queryKey,
        queryFn: () => apiClient.get<PaginatedResponse<TData>>(fullUrl, apiOptions),
        staleTime: 5 * 60 * 1000, // 5分钟
      });
    },
  };
}
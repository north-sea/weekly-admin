'use client';

import { 
  useGet, 
  usePaginatedQuery, 
  usePost, 
  usePut, 
  useDelete,
  useOptimisticUpdate,
  useInvalidateQueries,
  queryKeys,
  PaginationParams
} from '@/hooks/useApi';

import {
  WeeklyIssue,
  WeeklyContent,
  WeeklyStats,
  WeeklyInput,
  WeeklyUpdate,
} from '@/lib/services/weekly-api';

// 重新导出类型以保持兼容性
export type {
  WeeklyIssue,
  WeeklyContent,
  WeeklyStats,
  WeeklyInput,
  WeeklyUpdate,
};

// 周刊列表查询
export function useWeeklyList(params?: PaginationParams & {
  status?: 'draft' | 'published' | 'archived';
  search?: string;
  year?: number;
  sort_by?: 'issue_number' | 'publication_date' | 'view_count';
}) {
  return usePaginatedQuery<WeeklyIssue>(
    '/api/weekly',
    params,
    {
      queryKey: queryKeys.weekly.list(params),
      staleTime: 3 * 60 * 1000, // 3分钟缓存
    }
  );
}

// 单个周刊详情查询
export function useWeeklyDetail(id: string | number, enabled = true) {
  return useGet<WeeklyIssue>(
    `/api/weekly/${id}`,
    {
      queryKey: queryKeys.weekly.detail(id),
      enabled: enabled && !!id,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  );
}

// 周刊内容列表查询
export function useWeeklyContents(weeklyId: string | number, enabled = true) {
  return useGet<WeeklyContent[]>(
    `/api/weekly/${weeklyId}/contents`,
    {
      queryKey: queryKeys.weekly.contents(weeklyId),
      enabled: enabled && !!weeklyId,
      staleTime: 2 * 60 * 1000, // 2分钟缓存
    }
  );
}

// 可用于添加到周刊的内容查询
export function useAvailableContents(params?: {
  content_type?: string;
  category_id?: number;
  tag_ids?: number[];
  exclude_weekly_id?: number;
  search?: string;
  limit?: number;
}) {
  return useGet<Array<{
    id: number;
    title: string;
    slug: string;
    description?: string;
    content_type: string;
    category?: string;
    tags: string[];
    published_at?: string;
    already_used: boolean;
  }>>('/api/weekly/available-contents', {
    queryKey: queryKeys.weekly.availableContents(),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

// 周刊统计数据
export function useWeeklyStats(id?: string | number) {
  const url = id ? `/api/weekly/${id}/stats` : '/api/weekly/stats';
  const queryKey = id 
    ? queryKeys.weekly.stats(id)
    : [...queryKeys.weekly.all, 'stats'];
    
  return useGet<WeeklyStats>(url, {
    queryKey,
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  });
}

// 周刊发布历史
export function useWeeklyPublishHistory(limit = 10) {
  return useGet<Array<{
    issue_number: number;
    title: string;
    publication_date: string;
    content_count: number;
    initial_views: number;
  }>>(`/api/weekly/publish-history?limit=${limit}`, {
    queryKey: [...queryKeys.weekly.all, 'publish-history', limit],
    staleTime: 30 * 60 * 1000, // 30分钟缓存
  });
}

// 创建周刊
export function useCreateWeekly() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePost<WeeklyIssue, WeeklyInput>('/api/weekly', {
    onMutate: async (newWeekly) => {
      // 乐观更新：立即添加到列表
      const tempId = Date.now();
      const optimisticWeekly = {
        id: tempId,
        ...newWeekly,
        issue_number: newWeekly.issue_number || 0,
        status: newWeekly.status || 'draft',
        content_count: 0,
        view_count: 0,
        share_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as WeeklyIssue;
      
      optimistic.addItem(queryKeys.weekly.lists(), optimisticWeekly);
      
      return { tempId, optimisticWeekly };
    },
    onSuccess: (data, variables, context) => {
      // 移除乐观更新的临时数据
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.weekly.lists(), context.tempId);
      }
      
      // 无效化相关查询
      invalidate.invalidateWeekly();
    },
    onError: (error, variables, context) => {
      // 回滚乐观更新
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.weekly.lists(), context.tempId);
      }
    },
  });
}

// 更新周刊
export function useUpdateWeekly() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePut<WeeklyIssue, WeeklyUpdate & { id: string | number }>(
    ({ id }) => `/api/weekly/${id}`,
    {
      onMutate: async (updateData) => {
        const { id, ...updates } = updateData;
        
        // 乐观更新
        optimistic.updateItem(
          queryKeys.weekly.list(),
          id,
          (old: WeeklyIssue) => ({
            ...old,
            ...updates,
            updated_at: new Date().toISOString(),
          })
        );
        
        // 同时更新详情页
        optimistic.updateItem(
          queryKeys.weekly.detail(id),
          id,
          (old: WeeklyIssue) => ({
            ...old,
            ...updates,
            updated_at: new Date().toISOString(),
          })
        );
        
        return { id, updates };
      },
      onSuccess: (data, variables) => {
        const { id } = variables;
        
        // 更新缓存中的实际数据
        invalidate.setQueryData(queryKeys.weekly.detail(id), data);
        
        // 无效化相关查询
        invalidate.invalidateWeekly(id);
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚乐观更新
          invalidate.invalidateWeekly(context.id);
        }
      },
    }
  );
}

// 删除周刊
export function useDeleteWeekly() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return useDelete<void, { id: string | number }>(
    ({ id }) => `/api/weekly/${id}`,
    {
      onMutate: async ({ id }) => {
        // 乐观更新：立即从列表中移除
        optimistic.removeItem(queryKeys.weekly.lists(), id);
        
        return { id };
      },
      onSuccess: (data, variables) => {
        // 移除相关缓存
        invalidate.remove(queryKeys.weekly.detail(variables.id));
        invalidate.remove(queryKeys.weekly.contents(variables.id));
        invalidate.remove(queryKeys.weekly.stats(variables.id));
        
        // 无效化列表查询
        invalidate.invalidateWeekly();
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚：重新获取数据
          invalidate.invalidateWeekly();
        }
      },
    }
  );
}

// 添加内容到周刊
export function useAddContentToWeekly() {
  const invalidate = useInvalidateQueries();
  
  return usePost<WeeklyContent, {
    weekly_id: number;
    content_id: number;
    section?: string;
    position?: number;
    notes?: string;
  }>('/api/weekly/add-content', {
    onSuccess: (data, variables) => {
      // 无效化周刊内容列表
      invalidate.invalidate(queryKeys.weekly.contents(variables.weekly_id));
      
      // 更新周刊详情（内容数量可能变化）
      invalidate.invalidate(queryKeys.weekly.detail(variables.weekly_id));
      
      // 无效化可用内容列表
      invalidate.invalidate(queryKeys.weekly.availableContents());
    },
  });
}

// 从周刊移除内容
export function useRemoveContentFromWeekly() {
  const invalidate = useInvalidateQueries();
  
  return useDelete<void, {
    weekly_id: number;
    content_id: number;
  }>(`/api/weekly/remove-content`, {
    onSuccess: (data, variables) => {
      // 无效化周刊内容列表
      invalidate.invalidate(queryKeys.weekly.contents(variables.weekly_id));
      
      // 更新周刊详情
      invalidate.invalidate(queryKeys.weekly.detail(variables.weekly_id));
      
      // 无效化可用内容列表
      invalidate.invalidate(queryKeys.weekly.availableContents());
    },
  });
}

// 重新排序周刊内容
export function useReorderWeeklyContents() {
  const invalidate = useInvalidateQueries();
  
  return usePut<WeeklyContent[], {
    weekly_id: number;
    content_orders: Array<{
      content_id: number;
      position: number;
      section?: string;
    }>;
  }>('/api/weekly/reorder-contents', {
    onMutate: async ({ weekly_id, content_orders }) => {
      // 乐观更新内容排序
      const currentContents = invalidate.getQueryData<WeeklyContent[]>(
        queryKeys.weekly.contents(weekly_id)
      );
      
      if (currentContents) {
        const reorderedContents = [...currentContents].sort((a, b) => {
          const orderA = content_orders.find(o => o.content_id === a.content_id)?.position || a.position;
          const orderB = content_orders.find(o => o.content_id === b.content_id)?.position || b.position;
          return orderA - orderB;
        });
        
        invalidate.setQueryData(
          queryKeys.weekly.contents(weekly_id),
          reorderedContents
        );
      }
      
      return { weekly_id, previousContents: currentContents };
    },
    onSuccess: (data, variables) => {
      // 更新为服务器返回的实际数据
      invalidate.setQueryData(
        queryKeys.weekly.contents(variables.weekly_id),
        data
      );
    },
    onError: (error, variables, context) => {
      if (context?.previousContents) {
        // 回滚乐观更新
        invalidate.setQueryData(
          queryKeys.weekly.contents(variables.weekly_id),
          context.previousContents
        );
      }
    },
  });
}

// 发布周刊
export function usePublishWeekly() {
  const invalidate = useInvalidateQueries();
  
  return usePost<WeeklyIssue, {
    id: number;
    publication_date?: string;
    send_notification?: boolean;
  }>(`/api/weekly/publish`, {
    onSuccess: (data, variables) => {
      // 更新周刊状态
      invalidate.setQueryData(queryKeys.weekly.detail(variables.id), data);
      
      // 无效化列表和统计数据
      invalidate.invalidateWeekly();
    },
  });
}

// 归档周刊
export function useArchiveWeekly() {
  const invalidate = useInvalidateQueries();
  
  return usePut<WeeklyIssue, { id: number }>(
    ({ id }) => `/api/weekly/${id}/archive`,
    {
      onSuccess: (data, variables) => {
        // 更新周刊状态
        invalidate.setQueryData(queryKeys.weekly.detail(variables.id), data);
        
        // 无效化列表查询
        invalidate.invalidateWeekly();
      },
    }
  );
}
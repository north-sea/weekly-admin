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
import { TagWithStats } from '@/lib/services/tag-api';

export interface TagInput {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
}

export interface TagUpdate {
  name?: string;
  slug?: string;
  description?: string;
  color?: string;
}

export interface TagMergeParams {
  source_tag_ids: number[];
  target_tag_id: number;
}

// 标签列表查询
export function useTagList(params?: PaginationParams & {
  search?: string;
  sort_by?: 'name' | 'count' | 'created_at';
  sort_order?: 'asc' | 'desc';
  min_count?: number;
}) {
  return usePaginatedQuery<TagWithStats>(
    '/api/tags',
    params,
    {
      queryKey: queryKeys.tags.list(params),
      staleTime: 3 * 60 * 1000, // 3分钟缓存
    }
  );
}

// 获取所有标签（不分页，用于选择器）
export function useAllTags(params?: {
  sort_by?: 'name' | 'count';
  sort_order?: 'asc' | 'desc';
  limit?: number;
}) {
  return useGet<TagWithStats[]>('/api/tags/all', {
    queryKey: [...queryKeys.tags.all, 'all', params],
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

// 单个标签详情查询
export function useTagDetail(id: string | number, enabled = true) {
  return useGet<TagWithStats>(
    `/api/tags/${id}`,
    {
      queryKey: queryKeys.tags.detail(id),
      enabled: enabled && !!id,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  );
}

// 热门标签查询
export function usePopularTags(limit = 20) {
  return useGet<TagWithStats[]>(`/api/tags/popular?limit=${limit}`, {
    queryKey: queryKeys.tags.popular(limit),
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  });
}

// 标签统计信息
export function useTagStats() {
  return useGet<Array<{ 
    tag: TagWithStats; 
    content_count: number 
  }>>('/api/tags/stats', {
    queryKey: queryKeys.tags.stats(),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

// 标签使用趋势
export function useTagTrends(timeRange = 30) {
  return useGet<Array<{
    tag_id: number;
    tag_name: string;
    usage_count: number;
    trend: 'up' | 'down' | 'stable';
  }>>(`/api/tags/trends?timeRange=${timeRange}`, {
    queryKey: [...queryKeys.tags.all, 'trends', timeRange],
    staleTime: 30 * 60 * 1000, // 30分钟缓存
  });
}

// 相关标签推荐
export function useRelatedTags(tagIds: number[], enabled = true) {
  return useGet<TagWithStats[]>(
    `/api/tags/related?ids=${tagIds.join(',')}`,
    {
      queryKey: [...queryKeys.tags.all, 'related', tagIds],
      enabled: enabled && tagIds.length > 0,
      staleTime: 15 * 60 * 1000, // 15分钟缓存
    }
  );
}

// 创建标签
export function useCreateTag() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePost<TagWithStats, TagInput>('/api/tags', {
    onMutate: async (newTag) => {
      // 乐观更新：立即添加到列表
      const tempId = Date.now();
      const optimisticTag = {
        id: tempId,
        ...newTag,
        content_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as TagWithStats;
      
      optimistic.addItem(queryKeys.tags.lists(), optimisticTag);
      
      return { tempId, optimisticTag };
    },
    onSuccess: (data, variables, context) => {
      // 移除乐观更新的临时数据
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.tags.lists(), context.tempId);
      }
      
      // 无效化相关查询
      invalidate.invalidateTags();
    },
    onError: (error, variables, context) => {
      // 回滚乐观更新
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.tags.lists(), context.tempId);
      }
    },
  });
}

// 更新标签
export function useUpdateTag() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePut<TagWithStats, TagUpdate & { id: string | number }>(
    ({ id }) => `/api/tags/${id}`,
    {
      onMutate: async (updateData) => {
        const { id, ...updates } = updateData;
        
        // 乐观更新
        optimistic.updateItem(
          queryKeys.tags.list(),
          id,
          (old: TagWithStats) => ({
            ...old,
            ...updates,
            updated_at: new Date().toISOString(),
          })
        );
        
        // 同时更新详情页
        optimistic.updateItem(
          queryKeys.tags.detail(id),
          id,
          (old: TagWithStats) => ({
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
        invalidate.setQueryData(queryKeys.tags.detail(id), data);
        
        // 无效化相关查询
        invalidate.invalidateTags(id);
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚乐观更新
          invalidate.invalidateTags(context.id);
        }
      },
    }
  );
}

// 删除标签
export function useDeleteTag() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return useDelete<void, { id: string | number }>(
    ({ id }) => `/api/tags/${id}`,
    {
      onMutate: async ({ id }) => {
        // 乐观更新：立即从列表中移除
        optimistic.removeItem(queryKeys.tags.lists(), id);
        
        return { id };
      },
      onSuccess: (data, variables) => {
        // 移除详情页缓存
        invalidate.remove(queryKeys.tags.detail(variables.id));
        
        // 无效化列表查询和相关内容查询
        invalidate.invalidateTags();
        invalidate.invalidateContent(); // 因为内容可能关联了被删除的标签
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚：重新获取数据
          invalidate.invalidateTags();
        }
      },
    }
  );
}

// 合并标签
export function useMergeTags() {
  const invalidate = useInvalidateQueries();
  
  return usePost<void, TagMergeParams>('/api/tags/merge', {
    onSuccess: () => {
      // 标签合并影响多个数据，需要完全重新获取
      invalidate.invalidateTags();
      invalidate.invalidateContent(); // 内容的标签关联也会变化
    },
  });
}

// 更新标签计数
export function useUpdateTagCounts() {
  const invalidate = useInvalidateQueries();
  
  return usePost<void, void>('/api/tags/update-counts', {
    onSuccess: () => {
      // 更新所有标签相关缓存
      invalidate.invalidateTags();
    },
  });
}

// 批量删除标签
export function useBatchDeleteTags() {
  const invalidate = useInvalidateQueries();
  
  return usePost<void, { ids: (string | number)[] }>(
    '/api/tags/batch-delete',
    {
      onSuccess: () => {
        // 批量删除后完全重新获取
        invalidate.invalidateTags();
        invalidate.invalidateContent(); // 可能影响内容
      },
    }
  );
}

// 导入标签
export function useImportTags() {
  const invalidate = useInvalidateQueries();
  
  return usePost<{ imported: number; skipped: number }, { 
    tags: TagInput[];
    merge_duplicates?: boolean;
  }>('/api/tags/import', {
    onSuccess: () => {
      // 导入后重新获取标签列表
      invalidate.invalidateTags();
    },
  });
}
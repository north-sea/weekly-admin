'use client';

import { 
  useGet, 
  usePaginatedQuery, 
  usePost, 
  usePut, 
  useDelete,
  useBatchMutation,
  useOptimisticUpdate,
  useInvalidateQueries,
  queryKeys,
  PaginationParams
} from '@/hooks/useApi';
import { ContentWithRelations, ContentListResponse } from '@/lib/services/content-api';
import { ContentInput, ContentUpdate, BatchOperation } from '@/lib/validations/content';

// 内容列表查询
export function useContentList(params?: PaginationParams & {
  status?: string;
  category_id?: number;
  content_type?: string;
  search?: string;
  featured?: boolean;
  tag_ids?: number[];
}) {
  return usePaginatedQuery<ContentWithRelations>(
    '/api/content',
    params,
    {
      queryKey: queryKeys.content.list(params),
      staleTime: 2 * 60 * 1000, // 2分钟缓存
    }
  );
}

// 单个内容详情查询
export function useContentDetail(id: string | number, enabled = true) {
  return useGet<ContentWithRelations>(
    `/api/content/${id}`,
    {
      queryKey: queryKeys.content.detail(id),
      enabled: enabled && !!id,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  );
}

// 内容版本历史查询
export function useContentVersions(id: string | number, enabled = true) {
  return useGet<Array<{
    version_number: number;
    title: string;
    created_at: string;
    created_by: string;
  }>>(
    `/api/content/${id}/versions`,
    {
      queryKey: queryKeys.content.versions(id),
      enabled: enabled && !!id,
      staleTime: 10 * 60 * 1000, // 10分钟缓存
    }
  );
}

// 比较内容版本
export function useContentVersionCompare(
  id: string | number, 
  version1: number, 
  version2: number,
  enabled = true
) {
  return useGet<{
    version1: any;
    version2: any;
    diff: string;
  }>(
    `/api/content/${id}/versions/compare?v1=${version1}&v2=${version2}`,
    {
      queryKey: [...queryKeys.content.versions(id), 'compare', version1, version2],
      enabled: enabled && !!id && !!version1 && !!version2,
      staleTime: 30 * 60 * 1000, // 30分钟缓存
    }
  );
}

// 创建内容
export function useCreateContent() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePost<ContentWithRelations, ContentInput>('/api/content', {
    onMutate: async (newContent) => {
      // 乐观更新：立即添加到列表
      const tempId = Date.now();
      const optimisticContent = {
        id: tempId,
        ...newContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ContentWithRelations;
      
      optimistic.addItem(queryKeys.content.lists(), optimisticContent);
      
      return { tempId, optimisticContent };
    },
    onSuccess: (data, variables, context) => {
      // 移除乐观更新的临时数据
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.content.lists(), context.tempId);
      }
      
      // 无效化相关查询
      invalidate.invalidateContent();
    },
    onError: (error, variables, context) => {
      // 回滚乐观更新
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.content.lists(), context.tempId);
      }
    },
  });
}

// 更新内容
export function useUpdateContent() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePut<{ success: boolean; data: ContentWithRelations }, ContentUpdate & { id: string | number }>(
    ({ id }) => `/api/content/${id}`,
    {
      onMutate: async (updateData) => {
        const { id, ...updates } = updateData;
        
        // 乐观更新
        optimistic.updateItem(
          queryKeys.content.list(),
          id,
          (old: ContentWithRelations) => ({
            ...old,
            ...updates,
            updated_at: new Date().toISOString(),
          })
        );
        
        // 同时更新详情页
        optimistic.updateItem(
          queryKeys.content.detail(id),
          id,
          (old: ContentWithRelations) => ({
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
        invalidate.setQueryData(queryKeys.content.detail(id), data.data);
        
        // 无效化相关查询
        invalidate.invalidateContent(id);
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚乐观更新
          invalidate.invalidateContent(context.id);
        }
      },
    }
  );
}

// 删除内容
export function useDeleteContent() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return useDelete<void, { id: string | number }>(
    ({ id }) => `/api/content/${id}`,
    {
      onMutate: async ({ id }) => {
        // 乐观更新：立即从列表中移除
        optimistic.removeItem(queryKeys.content.lists(), id);
        
        return { id };
      },
      onSuccess: (data, variables) => {
        // 移除详情页缓存
        invalidate.remove(queryKeys.content.detail(variables.id));
        invalidate.remove(queryKeys.content.versions(variables.id));
        
        // 无效化列表查询
        invalidate.invalidateContent();
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚：重新获取数据
          invalidate.invalidateContent();
        }
      },
    }
  );
}

// 批量操作内容
export function useBatchContentOperation() {
  const invalidate = useInvalidateQueries();
  
  return useBatchMutation<void>('/api/content', {
    onSuccess: () => {
      // 批量操作后无效化所有内容相关缓存
      invalidate.invalidateContent();
    },
  });
}

// 内容回滚到指定版本
export function useContentRollback() {
  const invalidate = useInvalidateQueries();
  
  return usePost<{ success: boolean; data: ContentWithRelations }, { 
    id: string | number; 
    version: number 
  }>(
    ({ id }) => `/api/content/${id}/rollback`,
    {
      onSuccess: (data, variables) => {
        const { id } = variables;
        
        // 更新缓存中的数据
        invalidate.setQueryData(queryKeys.content.detail(id), data.data);
        
        // 无效化相关查询
        invalidate.invalidateContent(id);
      },
    }
  );
}

// 获取内容统计信息
export function useContentStats() {
  return useGet<{
    total: number;
    published: number;
    draft: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    recentActivity: Array<{
      date: string;
      count: number;
    }>;
  }>('/api/content/stats', {
    queryKey: queryKeys.content.stats(),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}
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
import { CategoryWithStats } from '@/types/category';
import { CategoryMerge } from '@/lib/validations/category';

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  parent_id?: number;
}

export interface CategoryUpdate {
  name?: string;
  slug?: string;
  description?: string;
  parent_id?: number;
}

// 分类列表查询
export function useCategoryList(params?: PaginationParams & {
  parent_id?: number;
  search?: string;
  include_stats?: boolean;
}) {
  const queryParams = new URLSearchParams();

  if (params?.parent_id !== undefined) queryParams.set('parent_id', String(params.parent_id));
  if (params?.search) queryParams.set('keyword', params.search);
  if (params?.include_stats !== undefined) queryParams.set('include_children', String(params.include_stats));

  const url = queryParams.toString()
    ? `/api/categories?${queryParams.toString()}`
    : '/api/categories';

  return useGet<CategoryWithStats[]>(url, {
    queryKey: queryKeys.categories.list({
      parent_id: params?.parent_id,
      keyword: params?.search,
      include_children: params?.include_stats,
    }),
    staleTime: 5 * 60 * 1000, // 5分钟缓存，分类变化频率较低
    select: (data) => {
      // 兼容非数组结构（旧接口或分页数据）
      if (Array.isArray(data)) return data;
      // @ts-expect-error 兼容 data 字段
      if (Array.isArray((data as any)?.data)) return (data as any).data;
      return [];
    },
  });
}

// 获取所有分类（不分页，用于选择器）
export function useAllCategories(params?: {
  include_stats?: boolean;
  parent_id?: number;
}) {
  return useGet<CategoryWithStats[]>('/api/categories/all', {
    queryKey: [...queryKeys.categories.all, 'all', params],
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  });
}

// 单个分类详情查询
export function useCategoryDetail(id: string | number, enabled = true) {
  return useGet<CategoryWithStats>(
    `/api/categories/${id}`,
    {
      queryKey: queryKeys.categories.detail(id),
      enabled: enabled && !!id,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    }
  );
}

// 分类统计信息
export function useCategoryStats() {
  return useGet<Array<{ 
    category: CategoryWithStats; 
    content_count: number 
  }>>('/api/categories/stats', {
    queryKey: queryKeys.categories.stats(),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

// 获取分类树状结构
export function useCategoryTree() {
  return useGet<CategoryWithStats[]>('/api/categories/tree', {
    queryKey: [...queryKeys.categories.all, 'tree'],
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  });
}

// 创建分类
export function useCreateCategory() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePost<CategoryWithStats, CategoryInput>('/api/categories', {
    onMutate: async (newCategory) => {
      // 乐观更新：立即添加到列表
      const tempId = Date.now();
      const optimisticCategory = {
        id: tempId,
        ...newCategory,
        content_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as CategoryWithStats;
      
      optimistic.addItem(queryKeys.categories.lists(), optimisticCategory);
      
      return { tempId, optimisticCategory };
    },
    onSuccess: (data, variables, context) => {
      // 移除乐观更新的临时数据
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.categories.lists(), context.tempId);
      }
      
      // 无效化相关查询
      invalidate.invalidateCategories();
    },
    onError: (error, variables, context) => {
      // 回滚乐观更新
      if (context?.tempId) {
        optimistic.removeItem(queryKeys.categories.lists(), context.tempId);
      }
    },
  });
}

// 更新分类
export function useUpdateCategory() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return usePut<CategoryWithStats, CategoryUpdate & { id: string | number }>(
    ({ id }) => `/api/categories/${id}`,
    {
      onMutate: async (updateData) => {
        const { id, ...updates } = updateData;
        
        // 乐观更新
        optimistic.updateItem(
          queryKeys.categories.list(),
          id,
          (old: CategoryWithStats) => ({
            ...old,
            ...updates,
            updated_at: new Date().toISOString(),
          })
        );
        
        // 同时更新详情页
        optimistic.updateItem(
          queryKeys.categories.detail(id),
          id,
          (old: CategoryWithStats) => ({
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
        invalidate.setQueryData(queryKeys.categories.detail(id), data);
        
        // 无效化相关查询
        invalidate.invalidateCategories(id);
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚乐观更新
          invalidate.invalidateCategories(context.id);
        }
      },
    }
  );
}

// 删除分类
export function useDeleteCategory() {
  const invalidate = useInvalidateQueries();
  const optimistic = useOptimisticUpdate();
  
  return useDelete<void, { id: string | number }>(
    ({ id }) => `/api/categories/${id}`,
    {
      onMutate: async ({ id }) => {
        // 乐观更新：立即从列表中移除
        optimistic.removeItem(queryKeys.categories.lists(), id);
        
        return { id };
      },
      onSuccess: (data, variables) => {
        // 移除详情页缓存
        invalidate.remove(queryKeys.categories.detail(variables.id));
        
        // 无效化列表查询和相关内容查询
        invalidate.invalidateCategories();
        invalidate.invalidateContent(); // 因为内容可能关联了被删除的分类
      },
      onError: (error, variables, context) => {
        if (context) {
          // 回滚：重新获取数据
          invalidate.invalidateCategories();
        }
      },
    }
  );
}

// 合并分类
export function useMergeCategories() {
  const invalidate = useInvalidateQueries();

  return usePost<void, CategoryMerge>('/api/categories/merge', {
    onSuccess: () => {
      invalidate.invalidateCategories();
      invalidate.invalidateContent();
    },
  });
}

// 移动分类（调整父子关系）
export function useMoveCategory() {
  const invalidate = useInvalidateQueries();
  
  return usePut<CategoryWithStats, { 
    id: string | number; 
    parent_id?: number;
    position?: number;
  }>(
    ({ id }) => `/api/categories/${id}/move`,
    {
      onSuccess: (data, variables) => {
        // 分类层级变更影响树状结构，需要完全重新获取
        invalidate.invalidateCategories();
      },
    }
  );
}

// 批量删除分类
export function useBatchDeleteCategories() {
  const invalidate = useInvalidateQueries();
  
  return usePost<void, { ids: (string | number)[] }>(
    '/api/categories/batch-delete',
    {
      onSuccess: () => {
        // 批量删除后完全重新获取
        invalidate.invalidateCategories();
        invalidate.invalidateContent(); // 可能影响内容
      },
    }
  );
}

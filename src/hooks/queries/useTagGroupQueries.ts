'use client';

import {
  useGet,
  usePost,
  usePut,
  useDelete,
  useInvalidateQueries,
  queryKeys,
} from '@/hooks/useApi';
import { TagGroup } from '@/types/tag';

// 扩展 queryKeys
const tagGroupKeys = {
  all: ['tag-groups'] as const,
  lists: () => [...tagGroupKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...tagGroupKeys.lists(), params] as const,
  details: () => [...tagGroupKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...tagGroupKeys.details(), id] as const,
};

export interface TagGroupWithStats extends TagGroup {
  tag_count: number;
}

export interface TagGroupInput {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface TagGroupUpdate extends Partial<TagGroupInput> {
  id: number;
}

// 获取标签组列表
export function useTagGroupList(params?: {
  keyword?: string;
  sort_by?: 'name' | 'sort_order' | 'created_at';
  sort_order?: 'asc' | 'desc';
}) {
  const queryParams = new URLSearchParams();

  if (params?.keyword) queryParams.set('keyword', params.keyword);
  if (params?.sort_by) queryParams.set('sort_by', params.sort_by);
  if (params?.sort_order) queryParams.set('sort_order', params.sort_order);

  const url = queryParams.toString()
    ? `/api/tag-groups?${queryParams.toString()}`
    : '/api/tag-groups';

  return useGet<TagGroupWithStats[]>(url, {
    queryKey: tagGroupKeys.list(params),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

// 获取所有标签组（用于下拉选择）
export function useAllTagGroups() {
  return useGet<Array<{ id: number; name: string; slug: string; color?: string }>>(
    '/api/tag-groups/all',
    {
      queryKey: [...tagGroupKeys.all, 'all'],
      staleTime: 10 * 60 * 1000, // 10分钟缓存
    }
  );
}

// 获取单个标签组
export function useTagGroupDetail(id: number, enabled = true) {
  return useGet<TagGroupWithStats>(`/api/tag-groups/${id}`, {
    queryKey: tagGroupKeys.detail(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// 创建标签组
export function useCreateTagGroup() {
  const invalidate = useInvalidateQueries();

  return usePost<TagGroupWithStats, TagGroupInput>('/api/tag-groups', {
    onSuccess: () => {
      invalidate.invalidate(tagGroupKeys.all);
    },
  });
}

// 更新标签组
export function useUpdateTagGroup() {
  const invalidate = useInvalidateQueries();

  return usePut<TagGroupWithStats, TagGroupUpdate>(
    ({ id }) => `/api/tag-groups/${id}`,
    {
      onSuccess: (data, variables) => {
        invalidate.setQueryData(tagGroupKeys.detail(variables.id), data);
        invalidate.invalidate(tagGroupKeys.lists());
      },
    }
  );
}

// 删除标签组
export function useDeleteTagGroup() {
  const invalidate = useInvalidateQueries();

  return useDelete<void, { id: number }>(({ id }) => `/api/tag-groups/${id}`, {
    onSuccess: (_, variables) => {
      invalidate.remove(tagGroupKeys.detail(variables.id));
      invalidate.invalidate(tagGroupKeys.all);
      // 标签组删除后，标签的 group_id 会被置为 null，需要刷新标签列表
      invalidate.invalidateTags();
    },
  });
}

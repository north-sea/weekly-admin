'use client';

/**
 * 草稿相关的 React Query Hooks
 * 用于管理草稿数据的查询和 mutations
 */

import { UseQueryOptions } from '@tanstack/react-query';
import {
  useDelete,
  useGet,
  usePaginatedQuery,
  usePatch,
  usePost,
  useInvalidateQueries,
  queryKeys,
  type PaginatedResponse,
} from '@/hooks/useApi';

// ============================================================================
// 类型定义
// ============================================================================

export interface Draft {
  id: string;
  karakeep_id: string;
  title: string;
  url: string;
  description: string | null;
  note: string | null;
  favicon_url: string | null;
  image_url: string | null;
  karakeep_created_at: string | null;
  karakeep_updated_at: string | null;
  status: 'pending' | 'adopted' | 'rejected';
  priority: number | null;
  category_suggestion: string | null;
  tags_suggestion: string | null;
  duplicate_of_draft_id: string | null;
  content_id: string | null;
  synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  summary?: string | null;
  content?: string | null;
  source?: string | null;
  domain?: string | null;
  duplicate_of?: {
    id: string;
    title: string;
    url: string;
  } | null;
}

export interface DraftListParams {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'adopted' | 'rejected';
  priority?: number;
  keyword?: string;
  showDuplicates?: 'all' | 'original' | 'duplicate';
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'title' | 'synced_at' | 'karakeep_created_at';
  sortOrder?: 'asc' | 'desc';
  stage?: 'inbox' | 'editor' | 'all';
}

export type DraftListResponse = PaginatedResponse<Draft>;

export interface SyncStats {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  duplicatesDetected: number;
  categoriesSuggested: number;
}

export interface DraftStatsResponse {
  inbox: { all: number; pending: number; adopted: number };
  editor: { all: number };
}

export interface UpdateDraftParams {
  status?: 'pending' | 'adopted' | 'rejected';
  priority?: number;
  category_suggestion?: string;
  tags_suggestion?: string;
  note?: string;
}

export interface ConvertDraftParams {
  content_type_id?: number;
  category_id?: number;
  tags?: number[];
  content_format?: 'markdown' | 'mdx' | 'html' | 'plain';
}

export interface BatchUpdateParams {
  ids: string[];
  action: 'updateStatus';
  status: 'pending' | 'adopted' | 'rejected';
}

// ============================================================================
// 辅助方法
// ============================================================================

function buildDraftListQuery(params: DraftListParams = {}) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    status: params.status,
    priority: params.priority,
    keyword: params.keyword,
    show_duplicates: params.showDuplicates,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    stage: params.stage,
  } satisfies Record<string, unknown>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取草稿列表
 */
export function useDraftList(
  params: DraftListParams = {},
  options?: Omit<UseQueryOptions<DraftListResponse>, 'queryKey' | 'queryFn'>
) {
  const queryParams = buildDraftListQuery(params);

  return usePaginatedQuery<Draft>(
    '/api/drafts',
    queryParams,
    {
      queryKey: queryKeys.drafts.list(queryParams),
      staleTime: 30 * 1000, // 30秒
      ...options,
    }
  );
}

/**
 * 获取草稿详情
 */
export function useDraftDetail(
  id: string,
  options?: Omit<UseQueryOptions<Draft>, 'queryKey' | 'queryFn'>
) {
  return useGet<Draft>(`/api/drafts/${id}`, {
    queryKey: queryKeys.drafts.detail(id),
    enabled: !!id,
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * 同步草稿
 */
export function useSyncDrafts() {
  const invalidate = useInvalidateQueries();

  return usePost<SyncStats, void>('/api/drafts/sync', {
    mutationKey: [...queryKeys.drafts.all, 'sync'],
    onSuccess: () => {
      invalidate.invalidateDrafts();
    },
  });
}

/**
 * 获取草稿统计（合并请求）
 */
export function useDraftStats(
  options?: Omit<UseQueryOptions<DraftStatsResponse>, 'queryKey' | 'queryFn'>
) {
  return useGet<DraftStatsResponse>('/api/drafts/stats', {
    queryKey: queryKeys.drafts.stats(),
    staleTime: 30 * 1000,
    ...options,
  });
}

/**
 * 更新草稿
 */
export function useUpdateDraft() {
  const invalidate = useInvalidateQueries();

  return usePatch<Draft, UpdateDraftParams & { id: string }>(
    ({ id }) => `/api/drafts/${id}`,
    {
      mutationKey: [...queryKeys.drafts.all, 'update'],
      onSuccess: (data, variables) => {
        invalidate.setQueryData(queryKeys.drafts.detail(variables.id), data);
        invalidate.invalidateDrafts(variables.id);
      },
    }
  );
}

/**
 * 删除草稿
 */
export function useDeleteDraft() {
  const invalidate = useInvalidateQueries();

  return useDelete<void, { id: string }>(
    ({ id }) => `/api/drafts/${id}`,
    {
      mutationKey: [...queryKeys.drafts.all, 'delete'],
      onSuccess: (_data, variables) => {
        invalidate.remove(queryKeys.drafts.detail(variables.id));
        invalidate.invalidateDrafts();
      },
    }
  );
}

/**
 * 转换草稿为内容
 */
export function useConvertDraft() {
  const invalidate = useInvalidateQueries();

  return usePost<{ id: string }, ConvertDraftParams & { id: string }>(
    ({ id }) => `/api/drafts/${id}/convert`,
    {
      mutationKey: [...queryKeys.drafts.all, 'convert'],
      onSuccess: (_data, variables) => {
        invalidate.invalidateDrafts(variables.id);
        invalidate.invalidateContent();
      },
    }
  );
}

/**
 * 批量更新草稿
 */
export function useBatchUpdateDrafts() {
  const invalidate = useInvalidateQueries();

  return usePost<{ count: number }, BatchUpdateParams>(
    '/api/drafts/batch',
    {
      mutationKey: [...queryKeys.drafts.all, 'batch-update'],
      onSuccess: () => {
        invalidate.invalidateDrafts();
      },
    }
  );
}

/**
 * 单独同步草稿
 */
export function useSyncSingleDraft() {
  const invalidate = useInvalidateQueries();

  return usePost<{ success: boolean; message: string }, { id: string; addToList?: string }>(
    ({ id }) => `/api/drafts/${id}/sync`,
    {
      mutationKey: [...queryKeys.drafts.all, 'sync-single'],
      onSuccess: (_data, variables) => {
        invalidate.invalidateDrafts(variables.id);
      },
    }
  );
}

/**
 * 批量同步草稿
 */
export function useSyncBatchDrafts() {
  const invalidate = useInvalidateQueries();

  return usePost<{
    total: number;
    success: number;
    failed: number;
    updated: number;
    unchanged: number;
  }, { draftIds: string[]; addToList?: string }>(
    '/api/drafts/sync-batch',
    {
      mutationKey: [...queryKeys.drafts.all, 'sync-batch'],
      onSuccess: () => {
        invalidate.invalidateDrafts();
      },
    }
  );
}

// 导出便捷方法
export const useDrafts = useDraftList;
export const useDraft = useDraftDetail;

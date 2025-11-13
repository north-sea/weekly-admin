/**
 * 草稿相关的 React Query Hooks
 * 用于管理草稿数据的查询和 mutations
 */

import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'title' | 'synced_at';
  sortOrder?: 'asc' | 'desc';
  stage?: 'inbox' | 'editor' | 'all';
}

export interface DraftListResponse {
  data: Draft[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

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
// Query Keys
// ============================================================================

export const draftKeys = {
  all: ['drafts'] as const,
  lists: () => [...draftKeys.all, 'list'] as const,
  list: (params: DraftListParams) => [...draftKeys.lists(), params] as const,
  details: () => [...draftKeys.all, 'detail'] as const,
  detail: (id: string) => [...draftKeys.details(), id] as const,
};

// ============================================================================
// API 函数
// ============================================================================

async function fetchDraftList(params: DraftListParams): Promise<DraftListResponse> {
  const query = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, value.toString());
    }
  });

  return apiClient.get<DraftListResponse>(`/api/drafts?${query.toString()}`);
}

async function fetchDraftDetail(id: string): Promise<Draft> {
  return apiClient.get<Draft>(`/api/drafts/${id}`);
}

async function syncDrafts(): Promise<SyncStats> {
  return apiClient.post<SyncStats>('/api/drafts/sync');
}

async function updateDraft(id: string, data: UpdateDraftParams): Promise<Draft> {
  return apiClient.patch<Draft>(`/api/drafts/${id}`, data);
}

async function deleteDraft(id: string): Promise<void> {
  return apiClient.delete<void>(`/api/drafts/${id}`);
}

async function convertDraft(id: string, data: ConvertDraftParams): Promise<{ id: string }> {
  return apiClient.post<{ id: string }>(`/api/drafts/${id}/convert`, data);
}

async function batchUpdateDrafts(data: BatchUpdateParams): Promise<{ count: number }> {
  return apiClient.post<{ count: number }>('/api/drafts/batch', data);
}

async function syncSingleDraft(id: string, addToList?: string): Promise<{ success: boolean; message: string }> {
  return apiClient.post(`/api/drafts/${id}/sync`, { addToList });
}

async function syncBatchDrafts(draftIds: string[], addToList?: string): Promise<{
  total: number;
  success: number;
  failed: number;
  updated: number;
  unchanged: number;
}> {
  return apiClient.post('/api/drafts/sync-batch', { draftIds, addToList });
}

async function fetchDraftStats(): Promise<DraftStatsResponse> {
  return apiClient.get<DraftStatsResponse>('/api/drafts/stats');
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
  return useQuery({
    queryKey: draftKeys.list(params),
    queryFn: () => fetchDraftList(params),
    staleTime: 30000, // 30秒
    ...options,
  });
}

/**
 * 获取草稿详情
 */
export function useDraftDetail(
  id: string,
  options?: Omit<UseQueryOptions<Draft>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: draftKeys.detail(id),
    queryFn: () => fetchDraftDetail(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * 同步草稿
 */
export function useSyncDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncDrafts,
    onSuccess: () => {
      // 刷新所有草稿列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * 获取草稿统计（合并请求）
 */
export function useDraftStats(
  options?: Omit<UseQueryOptions<DraftStatsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...draftKeys.all, 'stats'],
    queryFn: fetchDraftStats,
    staleTime: 30000,
    ...options,
  });
}

/**
 * 更新草稿
 */
export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateDraftParams & { id: string }) =>
      updateDraft(id, data),
    onSuccess: (data, variables) => {
      // 刷新详情
      queryClient.invalidateQueries({ queryKey: draftKeys.detail(variables.id) });
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * 删除草稿
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => {
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * 转换草稿为内容
 */
export function useConvertDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: ConvertDraftParams & { id: string }) =>
      convertDraft(id, data),
    onSuccess: (data, variables) => {
      // 刷新草稿详情
      queryClient.invalidateQueries({ queryKey: draftKeys.detail(variables.id) });
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
      // 刷新内容列表（如果需要）
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

/**
 * 批量更新草稿
 */
export function useBatchUpdateDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchUpdateDrafts,
    onSuccess: () => {
      // 刷新所有列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * 单独同步草稿
 */
export function useSyncSingleDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, addToList }: { id: string; addToList?: string }) => syncSingleDraft(id, addToList),
    onSuccess: (data, variables) => {
      // 刷新草稿详情
      queryClient.invalidateQueries({ queryKey: draftKeys.detail(variables.id) });
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

/**
 * 批量同步草稿
 */
export function useSyncBatchDrafts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftIds, addToList }: { draftIds: string[]; addToList?: string }) => 
      syncBatchDrafts(draftIds, addToList),
    onSuccess: () => {
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: draftKeys.lists() });
    },
  });
}

// 导出便捷方法
export const useDrafts = useDraftList;
export const useDraft = useDraftDetail;


'use client';

import { apiClient } from '@/lib/api-client';
import { queryKeys, useApiMutation, useDelete, useGet, useInvalidateQueries, usePost } from '@/hooks/useApi';

export type DataSourceType = 'rss' | 'karakeep' | 'webhook' | 'manual';

export type DataSource = {
  id: number;
  name: string;
  type: DataSourceType;
  config?: unknown | null;
  enabled?: boolean | null;
  auto_promote_threshold?: number | null;
  auto_score_override?: boolean | null;
  default_category_id?: number | null;
  default_content_type_id?: number | null;
  last_synced_at?: string | null;
  sync_count?: number | null;
  error_count?: number | null;
  last_error?: string | null;
  score_weight?: number | null;
  total_synced?: number | null;
  total_promoted?: number | null;
  total_published?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DataSourceInput = {
  name: string;
  type: DataSourceType;
  enabled?: boolean;
  config?: unknown;
  auto_promote_threshold?: number | null;
  auto_score_override?: boolean | null;
  default_category_id?: number | null;
  default_content_type_id?: number | null;
};

export type SyncResult = {
  source_id: number;
  fetched_at: string;
  total_candidates: number;
  upserted: number;
  skipped_duplicates: number;
  errors: string[];
  preprocess_result?: {
    scored: number;
    similar_detected: number;
    errors: string[];
  };
};

export type SyncOptions = {
  max_items?: number;
  similarity_check?: boolean;
  incremental?: boolean;
  auto_preprocess?: boolean;
};

export type SyncAllStartedResult = {
  started: boolean;
  total: number;
  started_at?: string;
  message?: string;
};

export type SyncAllWaitResult = {
  started: boolean;
  started_at: string;
  finished_at: string;
  total_sources: number;
  ok_count: number;
  failed_count: number;
  results: Array<{ source_id: number; name: string; ok: boolean; result?: SyncResult; error?: string }>;
};

export function useDataSources(params?: { type?: DataSourceType; enabled?: boolean }) {
  const query = params ? { ...params } : undefined;
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.set('type', params.type);
  if (params?.enabled !== undefined) queryParams.set('enabled', String(params.enabled));
  const url = queryParams.toString() ? `/api/sources?${queryParams.toString()}` : '/api/sources';

  return useGet<DataSource[]>(url, {
    queryKey: queryKeys.sources.list(query as any),
    staleTime: 30 * 1000,
  });
}

export function useCreateDataSource() {
  const invalidate = useInvalidateQueries();
  return usePost<DataSource, DataSourceInput>('/api/sources', {
    onSuccess: async () => {
      await invalidate.invalidateSources();
    },
  });
}

export function useUpdateDataSource() {
  const invalidate = useInvalidateQueries();
  return useApiMutation<DataSource, { id: number; data: Partial<DataSourceInput> }>(
    ({ id, data }) => apiClient.patch<DataSource>(`/api/sources/${id}`, data),
    {
      onSuccess: async (_data, variables) => {
        await invalidate.invalidateSources(variables.id);
      },
    }
  );
}

export function useDeleteDataSource() {
  const invalidate = useInvalidateQueries();
  return useDelete<void, number>((id) => `/api/sources/${id}`, {
    onSuccess: async () => {
      await invalidate.invalidateSources();
    },
  });
}

export function useSyncDataSource() {
  const invalidate = useInvalidateQueries();
  return useApiMutation<SyncResult, { id: number; options?: SyncOptions }>(
    ({ id, options }) => apiClient.post<SyncResult>(`/api/sources/${id}/sync`, options ?? {}),
    {
      onSuccess: async (_data, variables) => {
        await invalidate.invalidateSources(variables.id);
        await invalidate.invalidateInbox();
      },
    }
  );
}

export function useSyncAllSources() {
  const invalidate = useInvalidateQueries();
  return useApiMutation<
    SyncAllStartedResult | SyncAllWaitResult,
    {
      type?: DataSourceType;
      max_items?: number;
      similarity_check?: boolean;
      incremental?: boolean;
      auto_preprocess?: boolean;
      only_due?: boolean;
      wait?: boolean;
    }
  >(
    (payload) => apiClient.post('/api/sources/sync-all', payload),
    {
      onSuccess: async () => {
        await invalidate.invalidateSources();
        await invalidate.invalidateInbox();
      },
    }
  );
}

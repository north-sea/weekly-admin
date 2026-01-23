'use client';

import { useGet, usePost, useDelete, queryKeys, useInvalidateQueries, useApiMutation } from '@/hooks/useApi';
import { apiClient } from '@/lib/api-client';
import type { RssFetchResult, RssSource, RssSourceType } from '@/types/rss';

export type RssSourceInput = {
  name: string;
  feed_url: string;
  type?: RssSourceType;
  enabled?: boolean;
  content_type_id?: number;
  category_id?: number | null;
  config?: unknown;
};

export function useRssSources() {
  return useGet<RssSource[]>('/api/rss/sources', {
    queryKey: queryKeys.rss.sources(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateRssSource() {
  const invalidate = useInvalidateQueries();
  return usePost<RssSource, RssSourceInput>('/api/rss/sources', {
    onSuccess: async () => {
      await invalidate(queryKeys.rss.sources());
    },
  });
}

export function useUpdateRssSource() {
  const invalidate = useInvalidateQueries();
  return useApiMutation<RssSource, { id: number; data: Partial<RssSourceInput> }>(
    ({ id, data }) => apiClient.put<RssSource>(`/api/rss/sources/${id}`, data),
    {
    onSuccess: async () => {
      await invalidate(queryKeys.rss.sources());
    },
    }
  );
}

export function useDeleteRssSource() {
  const invalidate = useInvalidateQueries();
  return useDelete<RssSource, number>((id) => `/api/rss/sources/${id}`, {
    onSuccess: async () => {
      await invalidate(queryKeys.rss.sources());
    },
  });
}

export function useFetchRssSource() {
  const invalidate = useInvalidateQueries();
  return usePost<
    RssFetchResult,
    { source_id: number; max_items?: number; include_images?: boolean; image_fetch_limit?: number; similarity_check?: boolean }
  >('/api/rss/fetch', {
    onSuccess: async () => {
      await invalidate(queryKeys.content.lists());
    },
  });
}

export function usePreviewAggregator() {
  return usePost<
    {
      feed_url: string;
      feed_title?: string;
      item_index: number;
      item_title: string;
      is_aggregator: boolean;
      links: Array<{
        url: string;
        title?: string;
        is_duplicate: boolean;
        existing_source?: string;
        existing_id?: number | string | bigint;
        existing_title?: string;
      }>;
    },
    { source_id?: number; feed_url?: string; item_index?: number }
  >('/api/rss/preview-aggregator');
}

'use client';

import { apiClient } from '@/lib/api-client';
import { queryKeys, useApiMutation, useGet, useInvalidateQueries, usePost, type PaginatedResponse } from '@/hooks/useApi';

export type InboxStatus = 'pending' | 'promoted' | 'rejected' | 'duplicate';

export type InboxItem = {
  id: string;
  source_id: number;
  source_item_id?: string | null;
  title?: string | null;
  url: string;
  description?: string | null;
  note?: string | null;
  summary?: string | null;
  content?: string | null;
  image_url?: string | null;
  favicon_url?: string | null;
  source_name?: string | null;
  ai_score?: number | null;
  ai_score_details?: any;
  category_suggestion?: string | null;
  tags_suggestion?: any;
  similar_item_id?: string | null;
  similarity_score?: number | null;
  image_status?: string | null;
  status?: InboxStatus | null;
  priority?: number | null;
  auto_promoted?: boolean | null;
  content_id?: string | null;
  duplicate_of_id?: string | null;
  source_published_at?: string | null;
  collected_at?: string | null;
  synced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  data_source?: any;
  linked_content?: any;
};

export type InboxListParams = {
  page?: number;
  pageSize?: number;
  status?: InboxStatus;
  source_id?: number;
  keyword?: string;
  showDuplicates?: 'all' | 'original' | 'duplicate';
  sortBy?: 'created_at' | 'updated_at' | 'priority' | 'ai_score' | 'source_published_at' | 'synced_at' | 'collected_at';
  sortOrder?: 'asc' | 'desc';
  ai_score_min?: number;
};

export type InboxStats = {
  all: number;
  pending: number;
  promoted: number;
  rejected: number;
  duplicate: number;
};

function buildInboxListQuery(params: InboxListParams = {}) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    status: params.status,
    source_id: params.source_id,
    keyword: params.keyword,
    showDuplicates: params.showDuplicates,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    ai_score_min: params.ai_score_min,
  } satisfies Record<string, unknown>;
}

export function useInboxList(params: InboxListParams = {}) {
  const queryParams = buildInboxListQuery(params);
  const search = new URLSearchParams();
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, String(v));
  });
  const url = search.toString() ? `/api/inbox?${search.toString()}` : '/api/inbox';

  return useGet<PaginatedResponse<InboxItem>>(url, {
    queryKey: queryKeys.inbox.list(queryParams),
    staleTime: 15 * 1000,
  });
}

export function useInboxStats() {
  return useGet<InboxStats>('/api/inbox/stats', {
    queryKey: queryKeys.inbox.stats(),
    staleTime: 30 * 1000,
  });
}

export function useInboxPromote() {
  const invalidate = useInvalidateQueries();
  return useApiMutation<any, { id: string; data?: { content_type_id?: number; category_id?: number | null; tag_ids?: number[] } }>(
    ({ id, data }) => apiClient.post(`/api/inbox/${id}/promote`, data ?? {}),
    {
      onSuccess: async (_data, variables) => {
        await invalidate.invalidateInbox(variables.id);
        await invalidate.invalidateContent();
      },
    }
  );
}

export function useInboxBatch() {
  const invalidate = useInvalidateQueries();
  return usePost<{ updated: number }, { ids: Array<string | number>; action: 'reject' | 'mark_duplicate' | 'mark_pending' }>(
    '/api/inbox/batch',
    {
      onSuccess: async () => {
        await invalidate.invalidateInbox();
      },
    }
  );
}

export type BatchPromoteResult = {
  promoted: number;
  failed: number;
  skipped: number;
  errors: string[];
  contentIds: string[];
};

export type BatchPromoteInput = {
  ids: Array<string | number>;
  content_type_id?: number;
  category_id?: number | null;
  tag_ids?: number[];
  content_format?: 'markdown' | 'mdx' | 'html' | 'plain';
};

export function useInboxBatchPromote() {
  const invalidate = useInvalidateQueries();
  return usePost<BatchPromoteResult, BatchPromoteInput>(
    '/api/inbox/batch-promote',
    {
      onSuccess: async () => {
        await invalidate.invalidateInbox();
        await invalidate.invalidateContent();
      },
    }
  );
}

export type BatchScoreResult = {
  scored: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export function useInboxScoreBatch() {
  const invalidate = useInvalidateQueries();
  return usePost<BatchScoreResult, { limit?: number; delay?: number }>(
    '/api/inbox/score-batch',
    {
      onSuccess: async () => {
        await invalidate.invalidateInbox();
      },
    }
  );
}

export type AutoPromoteResult = {
  promoted: number;
  failed: number;
  errors: string[];
};

export function useInboxAutoPromote() {
  const invalidate = useInvalidateQueries();
  return usePost<AutoPromoteResult, { source_id?: number; threshold?: number }>(
    '/api/inbox/auto-promote',
    {
      onSuccess: async () => {
        await invalidate.invalidateInbox();
        await invalidate.invalidateContent();
      },
    }
  );
}

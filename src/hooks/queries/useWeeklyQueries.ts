'use client';

import { useGet, usePost, useInvalidateQueries } from '@/hooks/useApi';

// 待关联内容类型
export interface PendingContent {
  id: number;
  title: string;
  summary?: string;
  image_url?: string;
  source?: string;
  source_url?: string;
  created_at: string;
  category?: {
    id: number;
    name: string;
  };
  tags?: Array<{
    id: number;
    name: string;
  }>;
}

// 待关联内容响应类型
export interface PendingContentsResponse {
  weeklyIssue: {
    id: number;
    issue_number: number;
    title: string;
    start_date: string;
    end_date: string;
  };
  pendingContents: PendingContent[];
  currentCount: number;
}

// 批量关联结果类型
export interface BatchLinkResult {
  linkedCount: number;
  skippedCount: number;
  linkedContents: Array<{ id: number; title: string }>;
  skippedContents: Array<{ id: number; title: string; reason: string }>;
}

// 查询键
export const weeklyKeys = {
  all: ['weekly'] as const,
  pendingContents: (weeklyId: number | string) => [...weeklyKeys.all, 'pending-contents', weeklyId] as const,
};

// 获取周刊的待关联内容
export function usePendingContents(weeklyId: number | string, enabled = true) {
  return useGet<PendingContentsResponse>(
    `/api/weekly/${weeklyId}/pending-contents`,
    {
      queryKey: weeklyKeys.pendingContents(weeklyId),
      enabled: enabled && !!weeklyId,
      staleTime: 1 * 60 * 1000, // 1分钟缓存
    }
  );
}

// 批量关联内容到周刊
export function useBatchLinkContents() {
  const invalidate = useInvalidateQueries();

  return usePost<BatchLinkResult, { weeklyId: number | string; contentIds: number[] }>(
    ({ weeklyId }) => `/api/weekly/${weeklyId}/batch-link`,
    {
      onSuccess: (data, variables) => {
        // 无效化待关联内容列表
        invalidate.invalidate(weeklyKeys.pendingContents(variables.weeklyId));
        // 无效化周刊列表
        invalidate.invalidate(['weekly']);
      },
    }
  );
}

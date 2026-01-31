'use client';

import { useGet, usePost, useInvalidateQueries } from '@/hooks/useApi';

// 内容周刊关联信息类型
export interface ContentWeeklyInfo {
  linkedIssue: {
    id: number;
    issue_number: number;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
  recommendedIssue: {
    id: number;
    issue_number: number;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
}

// 关联操作结果类型
export interface LinkActionResult {
  success: boolean;
  message: string;
  linkedIssue?: {
    id: number;
    issue_number: number;
    title: string;
  };
}

// 查询键
export const contentWeeklyKeys = {
  all: ['content-weekly'] as const,
  info: (contentId: number | string) => [...contentWeeklyKeys.all, 'info', contentId] as const,
};

// 获取内容的周刊关联信息
export function useContentWeekly(contentId: number | string, enabled = true) {
  return useGet<ContentWeeklyInfo>(
    `/api/contents/${contentId}/weekly`,
    {
      queryKey: contentWeeklyKeys.info(contentId),
      enabled: enabled && !!contentId,
      staleTime: 2 * 60 * 1000, // 2分钟缓存
    }
  );
}

// 关联内容到周刊
export function useLinkContentToWeekly() {
  const invalidate = useInvalidateQueries();

  return usePost<LinkActionResult, { contentId: number | string; weeklyIssueId: number; action: 'link' }>(
    ({ contentId }) => `/api/contents/${contentId}/weekly`,
    {
      onSuccess: (data, variables) => {
        // 无效化该内容的周刊关联信息
        invalidate.invalidate(contentWeeklyKeys.info(variables.contentId));
      },
    }
  );
}

// 取消内容与周刊的关联
export function useUnlinkContentFromWeekly() {
  const invalidate = useInvalidateQueries();

  return usePost<LinkActionResult, { contentId: number | string; action: 'unlink' }>(
    ({ contentId }) => `/api/contents/${contentId}/weekly`,
    {
      onSuccess: (data, variables) => {
        // 无效化该内容的周刊关联信息
        invalidate.invalidate(contentWeeklyKeys.info(variables.contentId));
      },
    }
  );
}

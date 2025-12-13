/**
 * Quail 相关的 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ============ 类型定义 ============

export interface QuailPost {
  id: string;
  slug: string;
  title: string;
  content?: string;
  summary?: string;
  cover_image?: string;
  page_view_count: number;
  email_view_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuailChannel {
  title: string;
  slug: string;
  description?: string;
  subscriberCount?: number;
  avatarUrl?: string;
}

export interface QuailPublishStatus {
  published: boolean;
  delivered: boolean;
  quailPostId?: string;
  quailPostSlug?: string;
  publishedAt?: string;
  deliveredAt?: string;
  error?: string;
}

export interface QuailSubscription {
  id: number;
  type: 'free' | 'silver' | 'gold';
  paid_expiry?: string;
  email_enabled: boolean;
  user: {
    id: number;
    name: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
}

// ============ Query Keys ============

export const quailKeys = {
  all: ['quail'] as const,
  channel: () => [...quailKeys.all, 'channel'] as const,
  history: (page?: number, limit?: number) => [...quailKeys.all, 'history', { page, limit }] as const,
  status: (issueId: number) => [...quailKeys.all, 'status', issueId] as const,
  subscriber: (userId: number) => [...quailKeys.all, 'subscriber', userId] as const,
};

// ============ Hooks ============

/**
 * 获取 Quail 频道信息
 */
export function useQuailChannel() {
  return useQuery({
    queryKey: quailKeys.channel(),
    queryFn: async () => {
      // apiClient.get 已自动处理 success 字段，直接返回 data
      const data = await apiClient.get<QuailChannel>('/api/quail/channel');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 分钟
    retry: false,
  });
}

/**
 * 获取 Quail 发布历史
 */
export function useQuailHistory(options?: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = options || {};

  return useQuery({
    queryKey: quailKeys.history(page, limit),
    queryFn: async () => {
      // apiClient.get 已自动处理 success 字段，直接返回 data
      const data = await apiClient.get<{
        posts: QuailPost[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/quail/history?page=${page}&limit=${limit}`);
      return data;
    },
    staleTime: 60 * 1000, // 1 分钟
  });
}

/**
 * 获取周刊的 Quail 发布状态
 */
export function useQuailStatus(issueId: number) {
  return useQuery({
    queryKey: quailKeys.status(issueId),
    queryFn: async () => {
      // apiClient.get 已自动处理 success 字段，直接返回 data
      const data = await apiClient.get<QuailPublishStatus>(
        `/api/quail/status/${issueId}`
      );
      return data;
    },
    enabled: !!issueId,
    staleTime: 30 * 1000, // 30 秒
  });
}

/**
 * 发布周刊到 Quail
 */
export function useQuailPublish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      issueId: number;
      forceRepublish?: boolean;
      deliver?: boolean;
    }) => {
      // apiClient.post 已自动处理 success 字段，失败时会抛出错误
      const data = await apiClient.post<{ quailPostId: string; quailPostSlug: string }>(
        '/api/quail/publish',
        params
      );
      return data;
    },
    onSuccess: (_, variables) => {
      // 刷新发布状态
      queryClient.invalidateQueries({ queryKey: quailKeys.status(variables.issueId) });
      // 刷新发布历史
      queryClient.invalidateQueries({ queryKey: quailKeys.all });
    },
  });
}

/**
 * 发送邮件给订阅者
 */
export function useQuailDeliver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { issueId: number }) => {
      // apiClient.post 已自动处理 success 字段，失败时会抛出错误
      await apiClient.post('/api/quail/deliver', params);
    },
    onSuccess: (_, variables) => {
      // 刷新发布状态
      queryClient.invalidateQueries({ queryKey: quailKeys.status(variables.issueId) });
    },
  });
}

/**
 * 获取订阅者信息
 */
export function useQuailSubscriber(userId: number) {
  return useQuery({
    queryKey: quailKeys.subscriber(userId),
    queryFn: async () => {
      // apiClient.get 已自动处理 success 字段，直接返回 data
      const data = await apiClient.get<QuailSubscription[]>(
        `/api/quail/subscribers/${userId}`
      );
      return data;
    },
    enabled: !!userId,
  });
}

/**
 * 添加订阅者
 */
export function useAddSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; name?: string }) => {
      // apiClient.post 已自动处理 success 字段，失败时会抛出错误
      await apiClient.post('/api/quail/subscribers', params);
    },
    onSuccess: () => {
      // 刷新频道信息（订阅者数量可能变化）
      queryClient.invalidateQueries({ queryKey: quailKeys.channel() });
    },
  });
}

/**
 * 更新订阅者邮件设置
 */
export function useUpdateSubscriberEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: number; enabled: boolean }) => {
      // apiClient.put 已自动处理 success 字段，失败时会抛出错误
      await apiClient.put(`/api/quail/subscribers/${params.userId}`, {
        enabled: params.enabled,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: quailKeys.subscriber(variables.userId) });
    },
  });
}

/**
 * 删除订阅者
 */
export function useDeleteSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: number) => {
      // apiClient.delete 已自动处理 success 字段，失败时会抛出错误
      await apiClient.delete(`/api/quail/subscribers/${userId}`);
    },
    onSuccess: () => {
      // 刷新频道信息
      queryClient.invalidateQueries({ queryKey: quailKeys.channel() });
    },
  });
}

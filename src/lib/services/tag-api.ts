// 标签 API 调用服务
// 重构为纯函数形式，配合react-query使用

import { TagInput, TagUpdate, TagQuery, TagMerge } from '@/lib/validations/tag';

export interface TagWithStats {
  id: number;
  name: string;
  slug: string;
  count: number;
  created_at?: string;
  updated_at?: string;
}

// 构建标签查询参数的工具函数
export function buildTagQueryParams(query: TagQuery): string {
  const params = new URLSearchParams();
  
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value.toString());
    }
  });

  return params.toString();
}

// 标签 API 端点常量
export const TAG_ENDPOINTS = {
  list: '/api/tags',
  all: '/api/tags/all',
  detail: (id: string | number) => `/api/tags/${id}`,
  create: '/api/tags',
  update: (id: string | number) => `/api/tags/${id}`,
  delete: (id: string | number) => `/api/tags/${id}`,
  merge: '/api/tags/merge',
  updateCounts: '/api/tags/update-counts',
  stats: '/api/tags/stats',
  popular: '/api/tags/popular',
  trends: '/api/tags/trends',
  related: '/api/tags/related',
  batchDelete: '/api/tags/batch-delete',
  import: '/api/tags/import',
} as const;

// 保持向后兼容的类形式（标记为已废弃）
/** @deprecated Use useTagQueries hooks instead */
export class TagApiService {
  /** @deprecated Use useTagList hook instead */
  static async getTagList(query: TagQuery = { sort_by: 'count', sort_order: 'desc', page: 1, pageSize: 20 }): Promise<{
    data: TagWithStats[];
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    console.warn('TagApiService.getTagList is deprecated. Use useTagList hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const queryString = buildTagQueryParams(query);
    return apiClient.get(`${TAG_ENDPOINTS.list}?${queryString}`);
  }

  /** @deprecated Use useTagDetail hook instead */
  static async getTagById(id: number): Promise<TagWithStats> {
    console.warn('TagApiService.getTagById is deprecated. Use useTagDetail hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<TagWithStats>(TAG_ENDPOINTS.detail(id));
  }

  /** @deprecated Use useCreateTag hook instead */
  static async createTag(data: TagInput): Promise<TagWithStats> {
    console.warn('TagApiService.createTag is deprecated. Use useCreateTag hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<TagWithStats>(TAG_ENDPOINTS.create, data);
  }

  /** @deprecated Use useUpdateTag hook instead */
  static async updateTag(data: TagUpdate): Promise<TagWithStats> {
    console.warn('TagApiService.updateTag is deprecated. Use useUpdateTag hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const { id, ...updateData } = data;
    return apiClient.put<TagWithStats>(TAG_ENDPOINTS.update(id), updateData);
  }

  /** @deprecated Use useDeleteTag hook instead */
  static async deleteTag(id: number): Promise<void> {
    console.warn('TagApiService.deleteTag is deprecated. Use useDeleteTag hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.delete<void>(TAG_ENDPOINTS.delete(id));
  }

  /** @deprecated Use useMergeTags hook instead */
  static async mergeTags(data: TagMerge): Promise<void> {
    console.warn('TagApiService.mergeTags is deprecated. Use useMergeTags hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<void>(TAG_ENDPOINTS.merge, data);
  }

  /** @deprecated Use useUpdateTagCounts hook instead */
  static async updateTagCounts(): Promise<void> {
    console.warn('TagApiService.updateTagCounts is deprecated. Use useUpdateTagCounts hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<void>(TAG_ENDPOINTS.updateCounts);
  }

  /** @deprecated Use useTagStats hook instead */
  static async getTagStats(): Promise<Array<{ tag: TagWithStats; content_count: number }>> {
    console.warn('TagApiService.getTagStats is deprecated. Use useTagStats hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<Array<{ tag: TagWithStats; content_count: number }>>(TAG_ENDPOINTS.stats);
  }

  /** @deprecated Use usePopularTags hook instead */
  static async getPopularTags(limit: number = 10): Promise<TagWithStats[]> {
    console.warn('TagApiService.getPopularTags is deprecated. Use usePopularTags hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<TagWithStats[]>(`${TAG_ENDPOINTS.popular}?limit=${limit}`);
  }
}

// 导出别名以保持向后兼容
/** @deprecated Use useTagQueries hooks instead */
export const TagService = TagApiService;

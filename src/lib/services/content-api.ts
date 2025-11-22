// 内容 API 调用服务
// 重构为纯函数形式，配合react-query使用

import { ContentInput, ContentQuery, ContentUpdate, BatchOperation } from '@/lib/validations/content';

// 内容数据类型
export interface ContentWithRelations {
  id: string | number;
  title: string;
  slug: string;
  description?: string;
  summary?: string | null;
  image_url?: string | null;
  cover_image?: string | null;
  content: string;
  content_format?: string | null;
  source?: string | null;
  source_url?: string | null;
  status: string;
  meta_title?: string | null;
  meta_description?: string | null;
  word_count?: number | null;
  reading_time?: number | null;
  view_count?: number | null;
  screenshot_api?: string | null;
  recommendation_reason?: string | null;
  featured?: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  content_type: {
    id: number;
    name: string;
    slug: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  attributes: Array<{
    attribute_name: string;
    attribute_value: string;
    attribute_type: string;
  }>;
}

export interface ContentListResponse {
  data: ContentWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 内容 API 纯函数服务
// 这些函数现在主要由 useContentQueries hooks 使用

// 构建查询参数的工具函数
export function buildContentQueryParams(query: ContentQuery): string {
  const params = new URLSearchParams();
  
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v.toString()));
      } else {
        params.set(key, value.toString());
      }
    }
  });

  return params.toString();
}

// 内容 API 端点常量
export const CONTENT_ENDPOINTS = {
  list: '/api/content',
  detail: (id: string | number) => `/api/content/${id}`,
  create: '/api/content',
  update: (id: string | number) => `/api/content/${id}`,
  delete: (id: string | number) => `/api/content/${id}`,
  batch: '/api/content/batch',
  versions: (id: string | number) => `/api/content/${id}/versions`,
  versionDetail: (id: string | number, version: number) => `/api/content/${id}/versions/${version}`,
  versionCompare: (id: string | number) => `/api/content/${id}/versions/compare`,
  rollback: (id: string | number) => `/api/content/${id}/rollback`,
  stats: '/api/content/stats',
} as const;

// 保持向后兼容的类形式（标记为已废弃）
/** @deprecated Use useContentQueries hooks instead */
export class ContentApiService {
  /** @deprecated Use useContentList hook instead */
  static async getContentList(query: ContentQuery): Promise<ContentListResponse> {
    console.warn('ContentApiService.getContentList is deprecated. Use useContentList hook instead.');
    // 为了兼容性保留实现，但建议使用新的hooks
    const { apiClient } = await import('@/lib/api-client');
    const queryString = buildContentQueryParams(query);
    return apiClient.get<ContentListResponse>(`${CONTENT_ENDPOINTS.list}?${queryString}`);
  }

  /** @deprecated Use useContentDetail hook instead */
  static async getContentById(id: string | number): Promise<ContentWithRelations> {
    console.warn('ContentApiService.getContentById is deprecated. Use useContentDetail hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<ContentWithRelations>(CONTENT_ENDPOINTS.detail(id));
  }

  /** @deprecated Use useCreateContent hook instead */
  static async createContent(data: ContentInput): Promise<ContentWithRelations> {
    console.warn('ContentApiService.createContent is deprecated. Use useCreateContent hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<ContentWithRelations>(CONTENT_ENDPOINTS.create, data);
  }

  /** @deprecated Use useUpdateContent hook instead */
  static async updateContent(data: ContentUpdate): Promise<ContentWithRelations> {
    console.warn('ContentApiService.updateContent is deprecated. Use useUpdateContent hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const { id, ...updateData } = data;
    const response = await apiClient.put<{ success: boolean; data: ContentWithRelations }>(CONTENT_ENDPOINTS.update(id), updateData);
    return response.data;
  }

  /** @deprecated Use useDeleteContent hook instead */
  static async deleteContent(id: string | number): Promise<void> {
    console.warn('ContentApiService.deleteContent is deprecated. Use useDeleteContent hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.delete<void>(CONTENT_ENDPOINTS.delete(id));
  }

  /** @deprecated Use useBatchContentOperation hook instead */
  static async batchOperation(operation: BatchOperation): Promise<void> {
    console.warn('ContentApiService.batchOperation is deprecated. Use useBatchContentOperation hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<void>(CONTENT_ENDPOINTS.batch, operation);
  }
}

// 导出别名以保持向后兼容
/** @deprecated Use useContentQueries hooks instead */
export const ContentService = ContentApiService;

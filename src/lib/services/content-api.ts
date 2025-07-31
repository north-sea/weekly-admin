// 内容 API 调用服务
// 这个文件替换直接的数据库调用，改为调用 API 端点

import { apiClient } from '@/lib/api-client';
import { ContentInput, ContentQuery, ContentUpdate, BatchOperation } from '@/lib/validations/content';

// 内容数据类型
export interface ContentWithRelations {
  id: string | number;
  title: string;
  slug: string;
  description?: string;
  content: string;
  status: string;
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

// 内容 API 服务类
export class ContentApiService {
  // 获取内容列表
  static async getContentList(query: ContentQuery): Promise<ContentListResponse> {
    const params = new URLSearchParams();
    
    // 构建查询参数
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v.toString()));
        } else {
          params.set(key, value.toString());
        }
      }
    });

    return apiClient.get<ContentListResponse>(`/api/content?${params.toString()}`);
  }

  // 获取单个内容
  static async getContentById(id: string | number): Promise<ContentWithRelations> {
    return apiClient.get<ContentWithRelations>(`/api/content/${id}`);
  }

  // 创建内容
  static async createContent(data: ContentInput): Promise<ContentWithRelations> {
    return apiClient.post<ContentWithRelations>('/api/content', data);
  }

  // 更新内容
  static async updateContent(data: ContentUpdate): Promise<ContentWithRelations> {
    const { id, ...updateData } = data;
    const response = await apiClient.put<{ success: boolean; data: ContentWithRelations }>(`/api/content/${id}`, updateData);
    return response.data;
  }

  // 删除内容
  static async deleteContent(id: string | number): Promise<void> {
    return apiClient.delete<void>(`/api/content/${id}`);
  }

  // 批量操作
  static async batchOperation(operation: BatchOperation): Promise<void> {
    return apiClient.post<void>('/api/content/batch', operation);
  }
}

// 导出别名以保持向后兼容
export const ContentService = ContentApiService;
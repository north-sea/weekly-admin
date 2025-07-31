// 标签 API 调用服务

import { apiClient } from '@/lib/api-client';
import { TagInput, TagUpdate, TagQuery, TagMerge } from '@/lib/validations/tag';

export interface TagWithStats {
  id: number;
  name: string;
  slug: string;
  count: number;
  created_at?: string;
  updated_at?: string;
}

export class TagApiService {
  // 获取标签列表
  static async getTagList(query: TagQuery = {}): Promise<TagWithStats[]> {
    const params = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString());
      }
    });

    return apiClient.get<TagWithStats[]>(`/api/tags?${params.toString()}`);
  }

  // 获取单个标签
  static async getTagById(id: number): Promise<TagWithStats> {
    return apiClient.get<TagWithStats>(`/api/tags/${id}`);
  }

  // 创建标签
  static async createTag(data: TagInput): Promise<TagWithStats> {
    return apiClient.post<TagWithStats>('/api/tags', data);
  }

  // 更新标签
  static async updateTag(data: TagUpdate): Promise<TagWithStats> {
    const { id, ...updateData } = data;
    return apiClient.put<TagWithStats>(`/api/tags/${id}`, updateData);
  }

  // 删除标签
  static async deleteTag(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/tags/${id}`);
  }

  // 合并标签
  static async mergeTags(data: TagMerge): Promise<void> {
    return apiClient.post<void>('/api/tags/merge', data);
  }

  // 更新标签使用计数
  static async updateTagCounts(): Promise<void> {
    return apiClient.post<void>('/api/tags/update-counts');
  }

  // 获取标签使用统计
  static async getTagStats(): Promise<Array<{ tag: TagWithStats; content_count: number }>> {
    return apiClient.get<Array<{ tag: TagWithStats; content_count: number }>>('/api/tags/stats');
  }

  // 获取热门标签
  static async getPopularTags(limit: number = 10): Promise<TagWithStats[]> {
    return apiClient.get<TagWithStats[]>(`/api/tags/popular?limit=${limit}`);
  }
}

// 导出别名以保持向后兼容
export const TagService = TagApiService;
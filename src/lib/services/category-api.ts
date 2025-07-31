// 分类 API 调用服务

import { apiClient } from '@/lib/api-client';
import { CategoryInput, CategoryUpdate, CategoryQuery } from '@/lib/validations/category';

export interface CategoryWithStats {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  description?: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  content_count: number;
  children?: CategoryWithStats[];
  parent?: {
    id: number;
    name: string;
    slug: string;
  };
}

export class CategoryApiService {
  // 获取分类列表（支持层级结构）
  static async getCategoryList(query: CategoryQuery = {}): Promise<CategoryWithStats[]> {
    const params = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString());
      }
    });

    return apiClient.get<CategoryWithStats[]>(`/api/categories?${params.toString()}`);
  }

  // 获取单个分类
  static async getCategoryById(id: number): Promise<CategoryWithStats> {
    return apiClient.get<CategoryWithStats>(`/api/categories/${id}`);
  }

  // 创建分类
  static async createCategory(data: CategoryInput): Promise<CategoryWithStats> {
    return apiClient.post<CategoryWithStats>('/api/categories', data);
  }

  // 更新分类
  static async updateCategory(data: CategoryUpdate): Promise<CategoryWithStats> {
    const { id, ...updateData } = data;
    return apiClient.put<CategoryWithStats>(`/api/categories/${id}`, updateData);
  }

  // 删除分类
  static async deleteCategory(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/categories/${id}`);
  }

  // 获取分类使用统计
  static async getCategoryStats(): Promise<Array<{ category: CategoryWithStats; content_count: number }>> {
    return apiClient.get<Array<{ category: CategoryWithStats; content_count: number }>>('/api/categories/stats');
  }
}

// 导出别名以保持向后兼容
export const CategoryService = CategoryApiService;
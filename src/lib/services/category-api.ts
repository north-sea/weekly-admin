// 分类 API 调用服务
// 重构为纯函数形式，配合react-query使用

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

// 构建分类查询参数的工具函数
export function buildCategoryQueryParams(query: CategoryQuery): string {
  const params = new URLSearchParams();
  
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value.toString());
    }
  });

  return params.toString();
}

// 分类 API 端点常量
export const CATEGORY_ENDPOINTS = {
  list: '/api/categories',
  all: '/api/categories/all',
  tree: '/api/categories/tree',
  detail: (id: string | number) => `/api/categories/${id}`,
  create: '/api/categories',
  update: (id: string | number) => `/api/categories/${id}`,
  delete: (id: string | number) => `/api/categories/${id}`,
  move: (id: string | number) => `/api/categories/${id}/move`,
  batchDelete: '/api/categories/batch-delete',
  stats: '/api/categories/stats',
} as const;

// 保持向后兼容的类形式（标记为已废弃）
/** @deprecated Use useCategoryQueries hooks instead */
export class CategoryApiService {
  /** @deprecated Use useCategoryList hook instead */
  static async getCategoryList(query: CategoryQuery = { include_children: true }): Promise<CategoryWithStats[]> {
    console.warn('CategoryApiService.getCategoryList is deprecated. Use useCategoryList hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const queryString = buildCategoryQueryParams(query);
    return apiClient.get<CategoryWithStats[]>(`${CATEGORY_ENDPOINTS.list}?${queryString}`);
  }

  /** @deprecated Use useCategoryDetail hook instead */
  static async getCategoryById(id: number): Promise<CategoryWithStats> {
    console.warn('CategoryApiService.getCategoryById is deprecated. Use useCategoryDetail hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<CategoryWithStats>(CATEGORY_ENDPOINTS.detail(id));
  }

  /** @deprecated Use useCreateCategory hook instead */
  static async createCategory(data: CategoryInput): Promise<CategoryWithStats> {
    console.warn('CategoryApiService.createCategory is deprecated. Use useCreateCategory hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<CategoryWithStats>(CATEGORY_ENDPOINTS.create, data);
  }

  /** @deprecated Use useUpdateCategory hook instead */
  static async updateCategory(data: CategoryUpdate): Promise<CategoryWithStats> {
    console.warn('CategoryApiService.updateCategory is deprecated. Use useUpdateCategory hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const { id, ...updateData } = data;
    return apiClient.put<CategoryWithStats>(CATEGORY_ENDPOINTS.update(id), updateData);
  }

  /** @deprecated Use useDeleteCategory hook instead */
  static async deleteCategory(id: number): Promise<void> {
    console.warn('CategoryApiService.deleteCategory is deprecated. Use useDeleteCategory hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.delete<void>(CATEGORY_ENDPOINTS.delete(id));
  }

  /** @deprecated Use useCategoryStats hook instead */
  static async getCategoryStats(): Promise<Array<{ category: CategoryWithStats; content_count: number }>> {
    console.warn('CategoryApiService.getCategoryStats is deprecated. Use useCategoryStats hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<Array<{ category: CategoryWithStats; content_count: number }>>(CATEGORY_ENDPOINTS.stats);
  }
}

// 导出别名以保持向后兼容
/** @deprecated Use useCategoryQueries hooks instead */
export const CategoryService = CategoryApiService;
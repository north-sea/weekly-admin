// 周刊 API 调用服务
// 重构为纯函数形式，配合react-query使用

// 周刊数据类型
export interface WeeklyIssue {
  id: number;
  title: string;
  issue_number: number;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  publication_date?: string;
  created_at: string;
  updated_at: string;
  content_count: number;
  view_count: number;
  share_count: number;
}

export interface WeeklyContent {
  id: number;
  content_id: number;
  weekly_issue_id: number;
  position: number;
  section?: string;
  notes?: string;
  content: {
    id: number;
    title: string;
    slug: string;
    description?: string;
    content_type: string;
    category?: string;
    tags: string[];
    published_at?: string;
  };
}

export interface WeeklyStats {
  total_views: number;
  total_shares: number;
  total_subscribers: number;
  avg_engagement_rate: number;
  top_performing_issues: Array<{
    issue_number: number;
    title: string;
    views: number;
    engagement_rate: number;
  }>;
  growth_metrics: {
    subscriber_growth: number;
    engagement_growth: number;
    content_growth: number;
  };
}

export interface WeeklyQuery {
  page?: number;
  pageSize?: number;
  status?: 'draft' | 'published' | 'archived';
  search?: string;
  year?: number;
  sort_by?: 'issue_number' | 'publication_date' | 'view_count';
  sort_order?: 'asc' | 'desc';
}

export interface WeeklyInput {
  title: string;
  issue_number?: number;
  description?: string;
  publication_date?: string;
  status?: 'draft' | 'published';
}

export interface WeeklyUpdate {
  id: string | number;
  title?: string;
  description?: string;
  publication_date?: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface WeeklyListResponse {
  data: WeeklyIssue[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 构建查询参数的工具函数
export function buildWeeklyQueryParams(query: WeeklyQuery): string {
  const params = new URLSearchParams();
  
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value.toString());
    }
  });

  return params.toString();
}

// 周刊 API 端点常量
export const WEEKLY_ENDPOINTS = {
  list: '/api/weekly',
  detail: (id: string | number) => `/api/weekly/${id}`,
  create: '/api/weekly',
  update: (id: string | number) => `/api/weekly/${id}`,
  delete: (id: string | number) => `/api/weekly/${id}`,
  contents: (id: string | number) => `/api/weekly/${id}/contents`,
  addContent: '/api/weekly/add-content',
  removeContent: '/api/weekly/remove-content',
  reorderContents: '/api/weekly/reorder-contents',
  availableContents: '/api/weekly/available-contents',
  stats: (id?: string | number) => id ? `/api/weekly/${id}/stats` : '/api/weekly/stats',
  publishHistory: '/api/weekly/publish-history',
} as const;

// 保持向后兼容的类形式（标记为已废弃）
/** @deprecated Use useWeeklyQueries hooks instead */
export class WeeklyApiService {
  /** @deprecated Use useWeeklyList hook instead */
  static async getWeeklyList(query: WeeklyQuery = {}): Promise<WeeklyListResponse> {
    console.warn('WeeklyApiService.getWeeklyList is deprecated. Use useWeeklyList hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const queryString = buildWeeklyQueryParams(query);
    return apiClient.get<WeeklyListResponse>(`${WEEKLY_ENDPOINTS.list}?${queryString}`);
  }

  /** @deprecated Use useWeeklyDetail hook instead */
  static async getWeeklyById(id: string | number): Promise<WeeklyIssue> {
    console.warn('WeeklyApiService.getWeeklyById is deprecated. Use useWeeklyDetail hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<WeeklyIssue>(WEEKLY_ENDPOINTS.detail(id));
  }

  /** @deprecated Use useWeeklyContents hook instead */
  static async getWeeklyContents(id: string | number): Promise<WeeklyContent[]> {
    console.warn('WeeklyApiService.getWeeklyContents is deprecated. Use useWeeklyContents hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<WeeklyContent[]>(WEEKLY_ENDPOINTS.contents(id));
  }

  /** @deprecated Use useCreateWeekly hook instead */
  static async createWeekly(data: WeeklyInput): Promise<WeeklyIssue> {
    console.warn('WeeklyApiService.createWeekly is deprecated. Use useCreateWeekly hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.post<WeeklyIssue>(WEEKLY_ENDPOINTS.create, data);
  }

  /** @deprecated Use useUpdateWeekly hook instead */
  static async updateWeekly(data: WeeklyUpdate): Promise<WeeklyIssue> {
    console.warn('WeeklyApiService.updateWeekly is deprecated. Use useUpdateWeekly hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const { id, ...updateData } = data;
    return apiClient.put<WeeklyIssue>(WEEKLY_ENDPOINTS.update(id), updateData);
  }

  /** @deprecated Use useDeleteWeekly hook instead */
  static async deleteWeekly(id: string | number): Promise<void> {
    console.warn('WeeklyApiService.deleteWeekly is deprecated. Use useDeleteWeekly hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.delete<void>(WEEKLY_ENDPOINTS.delete(id));
  }

  /** @deprecated Use useWeeklyStats hook instead */
  static async getWeeklyStats(id?: string | number): Promise<WeeklyStats> {
    console.warn('WeeklyApiService.getWeeklyStats is deprecated. Use useWeeklyStats hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<WeeklyStats>(WEEKLY_ENDPOINTS.stats(id));
  }

  /** @deprecated Use useAvailableContents hook instead */
  static async getAvailableContents(params?: {
    content_type?: string;
    category_id?: number;
    tag_ids?: number[];
    exclude_weekly_id?: number;
    search?: string;
    limit?: number;
  }): Promise<Array<{
    id: number;
    title: string;
    slug: string;
    description?: string;
    content_type: string;
    category?: string;
    tags: string[];
    published_at?: string;
    already_used: boolean;
  }>> {
    console.warn('WeeklyApiService.getAvailableContents is deprecated. Use useAvailableContents hook instead.');
    const { apiClient } = await import('@/lib/api-client');
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return apiClient.get(WEEKLY_ENDPOINTS.availableContents + query);
  }
}

// 导出别名以保持向后兼容
/** @deprecated Use useWeeklyQueries hooks instead */
export const WeeklyService = WeeklyApiService;

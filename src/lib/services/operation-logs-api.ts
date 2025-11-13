// Operation Logs API Service
// 操作日志服务 - 提供操作日志相关的 API 端点和类型定义

// 操作日志类型
export interface OperationLog {
  id: number;
  user_id: number;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  resource_type: string;
  resource_id?: number;
  operation_details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
  user?: {
    id: number;
    username: string;
    display_name?: string;
  };
}

// 操作日志查询参数
export interface OperationLogsQuery {
  page?: number;
  pageSize?: number;
  operationType?: string;
  resourceType?: string;
  userId?: number;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

// 操作日志列表响应
export interface OperationLogsResponse {
  data: OperationLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 操作统计
export interface OperationStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  operationsByUser: Array<{
    userId: number;
    username: string;
    count: number;
  }>;
  operationsByResource: Array<{
    resourceType: string;
    count: number;
  }>;
  recentOperations: OperationLog[];
}

// 异常操作
export interface AnomalousOperation {
  userId: number;
  username: string;
  operationCount: number;
  timeWindow: string;
}

// 构建查询参数的工具函数
export function buildOperationLogsQueryParams(query: OperationLogsQuery): string {
  const params = new URLSearchParams();
  
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value.toString());
    }
  });

  return params.toString();
}

// 操作日志 API 端点常量
export const OPERATION_LOGS_ENDPOINTS = {
  list: '/api/operation-logs',
  stats: '/api/operation-logs/stats',
  export: '/api/operation-logs/export',
  detect: '/api/operation-logs/detect-anomalous',
} as const;

// 操作日志 API 函数 - 用于 React Query
export const operationLogsApi = {
  // 获取操作日志列表
  list: async (query: OperationLogsQuery): Promise<OperationLogsResponse> => {
    const { apiClient } = await import('@/lib/api-client');
    const queryString = buildOperationLogsQueryParams(query);
    const url = queryString ? `${OPERATION_LOGS_ENDPOINTS.list}?${queryString}` : OPERATION_LOGS_ENDPOINTS.list;
    return apiClient.get<OperationLogsResponse>(url);
  },
  
  // 获取统计信息
  stats: async (params?: { startDate?: string; endDate?: string }): Promise<OperationStats> => {
    const { apiClient } = await import('@/lib/api-client');
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    
    const queryString = queryParams.toString();
    const url = queryString ? `${OPERATION_LOGS_ENDPOINTS.stats}?${queryString}` : OPERATION_LOGS_ENDPOINTS.stats;
    return apiClient.get<OperationStats>(url);
  },
  
  // 导出日志
  export: async (format: 'json' | 'csv', query?: OperationLogsQuery): Promise<Blob> => {
    const params = new URLSearchParams({ format });
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value.toString());
        }
      });
    }
    
    const { apiClient } = await import('@/lib/api-client');
    const url = `${OPERATION_LOGS_ENDPOINTS.export}?${params.toString()}`;
    const response = await apiClient.request(url);
    if (!response.ok) {
      throw new Error('Export failed');
    }
    return response.blob();
  },
  
  // 检测异常操作
  detectAnomalous: async (): Promise<AnomalousOperation[]> => {
    const { apiClient } = await import('@/lib/api-client');
    return apiClient.get<AnomalousOperation[]>(OPERATION_LOGS_ENDPOINTS.detect);
  },
};

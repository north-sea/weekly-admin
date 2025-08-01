// 分析数据 API 调用服务
// 纯函数形式，配合react-query使用

// 分析 API 端点常量
export const ANALYTICS_ENDPOINTS = {
  // 基础分析
  overview: '/api/analytics',
  sources: '/api/analytics/sources', 
  advanced: '/api/analytics/advanced',
  realtime: '/api/analytics/realtime',
  
  // 导出和报告
  export: '/api/analytics/export',
  
  // 对比分析
  compare: '/api/analytics/compare',
  
  // 自定义分析
  custom: '/api/analytics/custom',
  
  // 预警设置
  alerts: '/api/analytics/alerts',
  
  // 操作日志分析
  operationLogs: {
    list: '/api/operation-logs',
    stats: '/api/operation-logs/stats',
    export: '/api/operation-logs/export',
  },
} as const;

// 分析数据构建查询参数的工具函数
export function buildAnalyticsQueryParams(params: {
  timeRange?: number;
  startDate?: string;
  endDate?: string;
  granularity?: 'day' | 'week' | 'month';
  metrics?: string[];
  dimensions?: string[];
  filters?: Record<string, any>;
}): string {
  const urlParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        urlParams.append(key, value.join(','));
      } else {
        urlParams.append(key, String(value));
      }
    }
  });
  
  return urlParams.toString();
}

// 操作日志查询参数构建函数
export function buildOperationLogQueryParams(params: {
  page?: number;
  pageSize?: number;
  operation_type?: string;
  resource_type?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}): string {
  const urlParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      urlParams.append(key, String(value));
    }
  });
  
  return urlParams.toString();
}

// 分析数据相关的数据类型
export interface AnalyticsTimeRange {
  start: string;
  end: string;
  period: 'day' | 'week' | 'month' | 'year';
}

export interface AnalyticsFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: any;
}

export interface CustomAnalyticsQuery {
  metrics: string[];
  dimensions: string[];
  filters?: AnalyticsFilter[];
  timeRange: AnalyticsTimeRange;
  limit?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export interface AnalyticsAlert {
  id?: number;
  name: string;
  description?: string;
  metric: string;
  condition: 'above' | 'below' | 'change';
  threshold: number;
  period: string;
  enabled: boolean;
  notification_channels: string[];
  created_at?: string;
  updated_at?: string;
  last_triggered?: string;
}

// 操作日志相关类型
export interface OperationLog {
  id: number;
  operation_type: string;
  resource_type: string;
  resource_id?: string;
  user_id?: string;
  user_name?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface OperationLogStats {
  total_operations: number;
  operations_by_type: Record<string, number>;
  operations_by_resource: Record<string, number>;
  operations_by_user: Array<{
    user_id: string;
    user_name: string;
    operation_count: number;
  }>;
  operations_by_hour: Array<{
    hour: number;
    count: number;
  }>;
  recent_trends: Array<{
    date: string;
    count: number;
  }>;
}

// 导出配置类型
export interface AnalyticsExportConfig {
  type: 'overview' | 'sources' | 'advanced' | 'custom' | 'operation-logs';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  timeRange?: number;
  startDate?: string;
  endDate?: string;
  includeCharts?: boolean;
  includeRawData?: boolean;
  customQuery?: CustomAnalyticsQuery;
  filename?: string;
}

// 废弃提示：由于分析功能之前分散在多个hooks中，这里提供统一的警告信息
export function warnDeprecatedAnalyticsUsage(functionName: string) {
  console.warn(
    `Direct analytics API usage (${functionName}) is deprecated. ` +
    'Use useAnalyticsQueries hooks instead for better caching and state management.'
  );
}
// Operation Logs Queries - React Query hooks for operation logs functionality
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useApi';
import { 
  operationLogsApi, 
  OperationLogsQuery, 
  OperationLogsResponse,
  OperationStats,
  AnomalousOperation
} from '@/lib/services/operation-logs-api';

// 获取操作日志列表
export function useOperationLogs(query: OperationLogsQuery, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.operationLogs.list(query as Record<string, unknown>),
    queryFn: () => operationLogsApi.list(query),
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// 获取操作日志统计
export function useOperationLogsStats(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: queryKeys.operationLogs.stats(params as Record<string, unknown>),
    queryFn: () => operationLogsApi.stats(params),
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// 检测异常操作
export function useDetectAnomalousOperations() {
  return useQuery({
    queryKey: ['operation-logs', 'anomalous'],
    queryFn: () => operationLogsApi.detectAnomalous(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: false, // 手动触发
  });
}

// 导出操作日志 mutation
export function useExportOperationLogs() {
  return useMutation({
    mutationFn: ({ format, query }: { format: 'json' | 'csv'; query?: OperationLogsQuery }) => 
      operationLogsApi.export(format, query),
    onSuccess: (blob, { format }) => {
      // 下载文件
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operation-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}

// 预取操作日志
export function usePrefetchOperationLogs() {
  const queryClient = useQueryClient();
  
  return (query: OperationLogsQuery) => {
    return queryClient.prefetchQuery({
      queryKey: queryKeys.operationLogs.list(query as Record<string, unknown>),
      queryFn: () => operationLogsApi.list(query),
      staleTime: 30000,
    });
  };
}

// 刷新操作日志缓存
export function useRefreshOperationLogs() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.operationLogs.all });
  };
}

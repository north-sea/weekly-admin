'use client';

// 导出所有业务领域的查询hooks
export * from './useContentQueries';
export * from './useCategoryQueries';
export * from './useTagQueries';
export * from './useAnalyticsQueries';
export * from './useDraftQueries';
export * from './useSearchQueries';
export * from './useOperationLogsQueries';

// 导出缓存配置和管理工具
export * from '@/lib/cache-config';
export * from '@/hooks/useLoadingState';

// 重新导出基础API hooks，方便统一导入
export {
  useGet,
  usePost,
  usePut,
  usePatch,
  useDelete,
  usePaginatedQuery,
  useInfiniteScrollQuery,
  useBatchMutation,
  useOptimisticUpdate,
  useInvalidateQueries,
  usePrefetch,
  queryKeys,
  type PaginationParams,
  type PaginatedResponse,
  type BatchOperationParams,
} from '@/hooks/useApi';
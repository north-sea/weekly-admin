/**
 * 通用加载状态管理Hook
 * 统一管理应用中的各种加载状态
 */

import { useMemo } from 'react';
import { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

// 加载状态类型
export interface LoadingState {
  loading: boolean;
  error: Error | null;
  success: boolean;
  idle: boolean;
}

// 批量查询加载状态
export interface BatchLoadingState extends LoadingState {
  loadingCount: number;
  totalCount: number;
  progress: number;
}

/**
 * 从单个查询获取加载状态
 * @param query - React Query 查询结果
 */
export function useQueryLoadingState<T>(query: UseQueryResult<T>): LoadingState {
  return useMemo(() => ({
    loading: query.isLoading || query.isFetching,
    error: query.error,
    success: query.isSuccess && !query.isLoading,
    idle: query.isIdle,
  }), [query.isLoading, query.isFetching, query.error, query.isSuccess, query.isIdle]);
}

/**
 * 从单个突变获取加载状态
 * @param mutation - React Query 突变结果
 */
export function useMutationLoadingState<T>(mutation: UseMutationResult<T>): LoadingState {
  return useMemo(() => ({
    loading: mutation.isPending,
    error: mutation.error,
    success: mutation.isSuccess && !mutation.isPending,
    idle: mutation.isIdle,
  }), [mutation.isPending, mutation.error, mutation.isSuccess, mutation.isIdle]);
}

/**
 * 合并多个查询的加载状态
 * @param queries - 多个查询结果
 */
export function useBatchQueryLoadingState<T = any>(
  queries: UseQueryResult<T>[]
): BatchLoadingState {
  return useMemo(() => {
    const loadingCount = queries.filter(q => q.isLoading || q.isFetching).length;
    const errorQueries = queries.filter(q => q.error);
    const successCount = queries.filter(q => q.isSuccess && !q.isLoading).length;
    
    return {
      loading: loadingCount > 0,
      error: errorQueries.length > 0 ? errorQueries[0].error : null,
      success: successCount === queries.length && loadingCount === 0,
      idle: queries.every(q => q.isIdle),
      loadingCount,
      totalCount: queries.length,
      progress: queries.length > 0 ? (successCount / queries.length) * 100 : 0,
    };
  }, [queries]);
}

/**
 * 合并多个突变的加载状态
 * @param mutations - 多个突变结果
 */
export function useBatchMutationLoadingState<T = any>(
  mutations: UseMutationResult<T>[]
): BatchLoadingState {
  return useMemo(() => {
    const loadingCount = mutations.filter(m => m.isPending).length;
    const errorMutations = mutations.filter(m => m.error);
    const successCount = mutations.filter(m => m.isSuccess && !m.isPending).length;
    
    return {
      loading: loadingCount > 0,
      error: errorMutations.length > 0 ? errorMutations[0].error : null,
      success: successCount === mutations.length && loadingCount === 0,
      idle: mutations.every(m => m.isIdle),
      loadingCount,
      totalCount: mutations.length,
      progress: mutations.length > 0 ? (successCount / mutations.length) * 100 : 0,
    };
  }, [mutations]);
}

/**
 * 页面级别的加载状态管理
 * 整合页面中所有查询和突变的状态
 */
export function usePageLoadingState<TQuery = any, TMutation = any>(
  queries: UseQueryResult<TQuery>[] = [],
  mutations: UseMutationResult<TMutation>[] = []
): {
  queries: BatchLoadingState;
  mutations: BatchLoadingState;
  overall: LoadingState & { hasData: boolean };
} {
  const queryState = useBatchQueryLoadingState(queries);
  const mutationState = useBatchMutationLoadingState(mutations);
  
  const overall = useMemo(() => ({
    loading: queryState.loading || mutationState.loading,
    error: queryState.error || mutationState.error,
    success: queryState.success && mutationState.success,
    idle: queryState.idle && mutationState.idle,
    hasData: queries.some(q => q.data !== undefined),
  }), [queryState, mutationState, queries]);

  return {
    queries: queryState,
    mutations: mutationState,
    overall,
  };
}

/**
 * 自动重试状态管理
 * @param query - 查询结果
 * @param maxRetries - 最大重试次数
 */
export function useRetryState<T>(
  query: UseQueryResult<T>,
  maxRetries: number = 3
): LoadingState & {
  retryCount: number;
  canRetry: boolean;
  retry: () => void;
} {
  const baseState = useQueryLoadingState(query);
  
  return useMemo(() => ({
    ...baseState,
    retryCount: query.failureCount || 0,
    canRetry: (query.failureCount || 0) < maxRetries,
    retry: query.refetch,
  }), [baseState, query.failureCount, maxRetries, query.refetch]);
}

/**
 * 加载状态指示器Props生成器
 * @param state - 加载状态
 */
export function getLoadingProps(state: LoadingState) {
  return {
    loading: state.loading,
    spin: state.loading,
  };
}

/**
 * 进度条Props生成器
 * @param state - 批量加载状态
 */
export function getProgressProps(state: BatchLoadingState) {
  return {
    percent: Math.round(state.progress),
    status: state.error ? 'exception' as const : 
           state.success ? 'success' as const : 
           state.loading ? 'active' as const : 'normal' as const,
    showInfo: true,
  };
}

/**
 * 空状态Props生成器
 * @param state - 加载状态
 * @param hasData - 是否有数据
 */
export function getEmptyProps(state: LoadingState, hasData: boolean) {
  return {
    loading: state.loading,
    description: state.error ? '加载失败' : 
                hasData ? '' : '暂无数据',
    image: state.error ? 'error' : 'empty',
  };
}
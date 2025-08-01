'use client';

import React from 'react';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorHandler, queryErrorHandler, mutationErrorHandler } from '@/lib/error-handler';

// 创建查询客户端实例
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 根据数据类型优化缓存时间
        // 静态数据 (分类、标签) - 较长缓存时间
        // 动态数据 (内容列表、分析数据) - 较短缓存时间
        // 默认: 数据被认为是新鲜的时间 (5分钟)
        staleTime: 5 * 60 * 1000,
        // 默认: 数据在内存中的缓存时间 (30分钟)  
        gcTime: 30 * 60 * 1000,
        // 重试配置
        retry: (failureCount, error) => {
          // 对于客户端错误 (4xx) 不重试
          if (error instanceof Error && 'response' in error) {
            const response = (error as any).response;
            if (response?.status >= 400 && response?.status < 500) {
              return false;
            }
          }
          // 最多重试 2 次
          return failureCount < 2;
        },
        // 重试延迟 (指数退避)
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        // 窗口重新获得焦点时不自动重新获取
        refetchOnWindowFocus: false,
        // 网络重连时重新获取
        refetchOnReconnect: true,
      },
      mutations: {
        // 突变失败时重试 1 次
        retry: 1,
        // 突变重试延迟
        retryDelay: 1000,
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 使用统一的错误处理机制
        console.error('查询错误:', error, query);
        queryErrorHandler(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        // 使用统一的错误处理机制
        console.error('突变错误:', error, { variables, context, mutation });
        mutationErrorHandler(error);
      },
      onSuccess: (data, variables, context, mutation) => {
        // 全局突变成功处理
        if (process.env.NODE_ENV === 'development') {
          console.log('突变成功:', { data, variables, context, mutation });
        }
        
        // 根据操作类型显示不同的成功消息
        const mutationKey = mutation.options.mutationKey?.[0];
        if (typeof mutationKey === 'string') {
          if (mutationKey.includes('create')) {
            ErrorHandler.showSuccess('创建成功');
          } else if (mutationKey.includes('update')) {
            ErrorHandler.showSuccess('更新成功');
          } else if (mutationKey.includes('delete')) {
            ErrorHandler.showSuccess('删除成功');
          }
        }
      },
    }),
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // 服务器端: 总是创建新的客户端
    return makeQueryClient();
  } else {
    // 浏览器端: 复用现有客户端
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  // 注意: 在 React 18 中，Suspense 边界内不应该在渲染过程中创建新的客户端实例
  // 这里使用 useState 确保客户端实例的稳定性
  const [queryClient] = React.useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 仅在开发环境中显示开发工具 */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

// 导出查询客户端获取函数，用于在 React 组件外部使用
export { getQueryClient };
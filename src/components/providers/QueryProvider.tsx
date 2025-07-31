'use client';

import React from 'react';
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { message } from 'antd';

// 创建查询客户端实例
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 数据被认为是新鲜的时间 (5分钟)
        staleTime: 5 * 60 * 1000,
        // 数据在内存中的缓存时间 (10分钟)
        gcTime: 10 * 60 * 1000,
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
        // 全局查询错误处理
        console.error('查询错误:', error, query);
        
        // 对于用户界面显示的错误
        if (error instanceof Error) {
          // 避免在开发环境中显示过多错误提示
          if (process.env.NODE_ENV === 'production') {
            message.error(`数据获取失败: ${error.message}`);
          }
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        // 全局突变错误处理
        console.error('突变错误:', error, { variables, context, mutation });
        
        if (error instanceof Error) {
          message.error(`操作失败: ${error.message}`);
        }
      },
      onSuccess: (data, variables, context, mutation) => {
        // 全局突变成功处理
        if (process.env.NODE_ENV === 'development') {
          console.log('突变成功:', { data, variables, context, mutation });
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
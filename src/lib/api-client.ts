import ky, { Options as KyOptions } from 'ky';
import type { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from '@/types';
import { useAuthStore } from '@/stores/auth';

// 扩展 Ky 选项类型以支持 Next.js 缓存选项
interface ApiOptions extends KyOptions {
  cache?: RequestCache;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

// API客户端工具，基于 Ky，自动处理认证
class ApiClient {
  private kyInstance: typeof ky;

  constructor() {
    this.kyInstance = ky.create({
      // 基础配置
      prefixUrl: process.env.NEXT_PUBLIC_API_URL || '',
      timeout: 30000,
      retry: {
        limit: 2,
        methods: ['get', 'put', 'head', 'delete', 'options', 'trace'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
      hooks: {
        beforeRequest: [
          (request) => {
            // 自动添加认证头
            const token = useAuthStore.getState().token;
            if (token) {
              request.headers.set('Authorization', `Bearer ${token}`);
              if (process.env.NODE_ENV === 'development') {
                console.log('API Client - Token:', `${token.substring(0, 20)}...`);
              }
            }
          }
        ],
        beforeRetry: [
          async ({ request, options, error, retryCount }) => {
            console.warn(`重试请求 (${retryCount}):`, request.url, error);
            
            // 如果是认证错误，尝试刷新 token
            if (error instanceof Error && 'response' in error) {
              const response = (error as any).response;
              if (response?.status === 401) {
                // 清除过期的 token
                useAuthStore.getState().logout();
                throw error; // 停止重试，让用户重新登录
              }
            }
          }
        ],
        afterResponse: [
          async (request, options, response) => {
            // 处理全局响应
            if (!response.ok) {
              // 记录错误响应
              console.error('API响应错误:', {
                url: request.url,
                status: response.status,
                statusText: response.statusText,
              });
              // 401 统一登出并跳转登录页
              if (response.status === 401) {
                try {
                  useAuthStore.getState().logout();
                } catch {}
                if (typeof window !== 'undefined') {
                  const isLoginApi = request.url.includes('/api/auth/login');
                  const onLoginPage = window.location.pathname.startsWith('/login');
                  if (!isLoginApi && !onLoginPage) {
                    const redirect = `${window.location.pathname}${window.location.search}`;
                    window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
                  }
                }
              }
            }
            return response;
          }
        ],
        beforeError: [
          (error) => {
            // 增强错误信息
            if ('response' in error && error.response) {
              const response = error.response as Response;
              error.message = `API请求失败 ${response.status}: ${response.statusText}`;
            }
            return error;
          }
        ]
      }
    });
  }

  // GET 请求
  async get<T = unknown>(url: string, options: ApiOptions = {}): Promise<T> {
    const response = await this.kyInstance.get(url, options);
    const json = await response.json() as ApiResponse<T>;
    
    // 统一API响应格式处理
    if (json.success) {
      return json.data as T;
    } else {
      const error = new Error(json.error?.message || 'API请求失败');
      (error as any).code = json.error?.code;
      (error as any).details = json.error?.details;
      throw error;
    }
  }

  // POST 请求
  async post<T = unknown>(url: string, data?: any, options: ApiOptions = {}): Promise<T> {
    const requestOptions: ApiOptions = {
      ...options,
      json: data,
    };
    const response = await this.kyInstance.post(url, requestOptions);
    const json = await response.json() as ApiResponse<T>;
    
    // 统一API响应格式处理
    if (json.success) {
      return json.data as T;
    } else {
      const error = new Error(json.error?.message || 'API请求失败');
      (error as any).code = json.error?.code;
      (error as any).details = json.error?.details;
      throw error;
    }
  }

  // PUT 请求
  async put<T = unknown>(url: string, data?: any, options: ApiOptions = {}): Promise<T> {
    const requestOptions: ApiOptions = {
      ...options,
      json: data,
    };
    const response = await this.kyInstance.put(url, requestOptions);
    const json = await response.json() as ApiResponse<T>;
    
    // 统一API响应格式处理
    if (json.success) {
      return json.data as T;
    } else {
      const error = new Error(json.error?.message || 'API请求失败');
      (error as any).code = json.error?.code;
      (error as any).details = json.error?.details;
      throw error;
    }
  }

  // DELETE 请求
  async delete<T = unknown>(url: string, options: ApiOptions = {}): Promise<T> {
    const response = await this.kyInstance.delete(url, options);
    const json = await response.json() as ApiResponse<T>;
    
    // 统一API响应格式处理
    if (json.success) {
      return json.data as T;
    } else {
      const error = new Error(json.error?.message || 'API请求失败');
      (error as any).code = json.error?.code;
      (error as any).details = json.error?.details;
      throw error;
    }
  }

  // PATCH 请求
  async patch<T = unknown>(url: string, data?: any, options: ApiOptions = {}): Promise<T> {
    const requestOptions: ApiOptions = {
      ...options,
      json: data,
    };
    const response = await this.kyInstance.patch(url, requestOptions);
    const json = await response.json() as ApiResponse<T>;
    
    // 统一API响应格式处理
    if (json.success) {
      return json.data as T;
    } else {
      const error = new Error(json.error?.message || 'API请求失败');
      (error as any).code = json.error?.code;
      (error as any).details = json.error?.details;
      throw error;
    }
  }

  // 获取原始 Response 对象（用于特殊处理）
  async request(url: string, options: ApiOptions = {}): Promise<Response> {
    return this.kyInstance(url, options);
  }

  // 扩展方法：创建具有特定配置的新实例
  extend(options: ApiOptions) {
    const extended = this.kyInstance.extend(options);
    const client = new ApiClient();
    client.kyInstance = extended;
    return client;
  }
}

// 导出全局实例
export const apiClient = new ApiClient();

// 导出类型
export type { ApiOptions };
export default apiClient;
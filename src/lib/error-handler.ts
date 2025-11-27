/**
 * 全局错误处理机制
 * 统一处理react-query和应用中的各种错误类型
 */

import { toast } from '@/components/ui/use-toast';

export interface AppError {
  code?: string;
  message: string;
  details?: any;
  source?: 'api' | 'validation' | 'network' | 'unknown';
}

export class ErrorHandler {
  /**
   * 处理API错误
   * @param error - 错误对象
   * @param context - 错误上下文信息
   */
  static handleApiError(error: any, context?: string): AppError {
    const appError: AppError = {
      source: 'api',
      message: '操作失败'
    };

    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      appError.source = 'network';
      appError.message = '网络连接失败，请检查网络设置';
      appError.code = 'NETWORK_ERROR';
    } else if (error.status) {
      switch (error.status) {
        case 400:
          appError.message = '请求参数错误';
          appError.code = 'BAD_REQUEST';
          break;
        case 401:
          appError.message = '登录已过期，请重新登录';
          appError.code = 'UNAUTHORIZED';
          break;
        case 403:
          appError.message = '没有权限执行此操作';
          appError.code = 'FORBIDDEN';
          break;
        case 404:
          appError.message = '请求的资源不存在';
          appError.code = 'NOT_FOUND';
          break;
        case 422:
          appError.message = '数据验证失败';
          appError.code = 'VALIDATION_ERROR';
          break;
        case 500:
          appError.message = '服务器内部错误';
          appError.code = 'INTERNAL_ERROR';
          break;
        default:
          appError.message = `请求失败 (${error.status})`;
          appError.code = 'HTTP_ERROR';
      }
    } else if (error.message) {
      appError.message = error.message;
    } else if (typeof error === 'string') {
      appError.message = error;
    }

    if (context) {
      appError.details = { context };
    }

    return appError;
  }

  static showError(error: AppError | any, options: {
    showDetails?: boolean;
    context?: string;
  } = {}) {
    const { showDetails = false, context } = options;

    const appError = this.isAppError(error)
      ? error
      : this.handleApiError(error, context);

    let errorMessage = appError.message;

    if (process.env.NODE_ENV === 'development' && showDetails && appError.details) {
      errorMessage += ` (${JSON.stringify(appError.details)})`;
    }

    toast({
      title: '操作失败',
      description: errorMessage,
      variant: 'destructive'
    });

    console.error('App Error:', appError);
  }

  static showSuccess(msg: string) {
    toast({ title: msg });
  }

  static showWarning(msg: string) {
    toast({ title: msg, variant: 'default' });
  }

  private static isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'source' in error;
  }

  static createError(
    message: string,
    code?: string,
    source: AppError['source'] = 'unknown'
  ): AppError {
    return {
      message,
      code,
      source
    };
  }
}

export const queryErrorHandler = (error: any) => {
  ErrorHandler.showError(error, {
    context: 'Query Error',
    showDetails: process.env.NODE_ENV === 'development'
  });
};

export const mutationErrorHandler = (error: any) => {
  ErrorHandler.showError(error, {
    context: 'Mutation Error',
    showDetails: process.env.NODE_ENV === 'development'
  });
};

export const withErrorHandler = async <T>(
  operation: () => Promise<T>,
  context?: string,
  showError: boolean = true
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    if (showError) {
      ErrorHandler.showError(error, { context });
    }
    return null;
  }
};

/**
 * 全局错误处理机制
 * 统一处理react-query和应用中的各种错误类型
 */

import { message } from 'antd';

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
      message: '操作失败',
    };

    // 处理网络错误
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      appError.source = 'network';
      appError.message = '网络连接失败，请检查网络设置';
      appError.code = 'NETWORK_ERROR';
    }
    // 处理HTTP状态错误
    else if (error.status) {
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
    }
    // 处理自定义错误消息
    else if (error.message) {
      appError.message = error.message;
    }
    // 处理字符串错误
    else if (typeof error === 'string') {
      appError.message = error;
    }

    // 添加上下文信息
    if (context) {
      appError.details = { context };
    }

    return appError;
  }

  /**
   * 显示错误消息给用户
   * @param error - 错误对象
   * @param options - 显示选项
   */
  static showError(error: AppError | any, options: {
    showDetails?: boolean;
    duration?: number;
    context?: string;
  } = {}) {
    const { showDetails = false, duration = 4, context } = options;
    
    let appError: AppError;
    if (this.isAppError(error)) {
      appError = error;
    } else {
      appError = this.handleApiError(error, context);
    }

    let errorMessage = appError.message;
    
    // 在开发环境显示更多详细信息
    if (process.env.NODE_ENV === 'development' && showDetails && appError.details) {
      errorMessage += ` (${JSON.stringify(appError.details)})`;
    }

    message.error(errorMessage, duration);
    
    // 在控制台输出完整错误信息
    console.error('App Error:', appError);
  }

  /**
   * 处理成功消息
   * @param msg - 成功消息
   * @param duration - 显示时长
   */
  static showSuccess(msg: string, duration: number = 3) {
    message.success(msg, duration);
  }

  /**
   * 处理警告消息
   * @param msg - 警告消息
   * @param duration - 显示时长
   */
  static showWarning(msg: string, duration: number = 3) {
    message.warning(msg, duration);
  }

  /**
   * 检查是否为AppError类型
   */
  private static isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'source' in error;
  }

  /**
   * 创建应用错误
   * @param message - 错误消息
   * @param code - 错误代码
   * @param source - 错误来源
   */
  static createError(
    message: string, 
    code?: string, 
    source: AppError['source'] = 'unknown'
  ): AppError {
    return {
      message,
      code,
      source,
    };
  }
}

/**
 * React Query 错误处理配置
 */
export const queryErrorHandler = (error: any) => {
  ErrorHandler.showError(error, {
    context: 'Query Error',
    showDetails: process.env.NODE_ENV === 'development',
  });
};

/**
 * React Query Mutation 错误处理配置
 */
export const mutationErrorHandler = (error: any) => {
  ErrorHandler.showError(error, {
    context: 'Mutation Error',
    showDetails: process.env.NODE_ENV === 'development',
  });
};

/**
 * 通用的异步操作错误处理包装器
 * @param operation - 异步操作函数
 * @param context - 上下文信息
 * @param showError - 是否显示错误消息
 */
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
/**
 * 统一API响应格式类型定义
 */

/**
 * 通用API响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * 成功响应类型
 */
export interface ApiSuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * 错误响应类型
 */
export interface ApiErrorResponse extends ApiResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * 分页响应数据
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T> extends ApiSuccessResponse<PaginatedData<T>> {}

/**
 * API错误代码枚举
 */
export enum ApiErrorCode {
  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // 验证相关
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ID = 'INVALID_ID',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  
  // 资源相关
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  
  // 操作相关
  CREATE_ERROR = 'CREATE_ERROR',
  UPDATE_ERROR = 'UPDATE_ERROR',
  DELETE_ERROR = 'DELETE_ERROR',
  GET_ERROR = 'GET_ERROR',
  
  // 服务相关
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // 业务相关
  CONTENT_NOT_FOUND = 'CONTENT_NOT_FOUND',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  TAG_NOT_FOUND = 'TAG_NOT_FOUND',
  WEEKLY_NOT_FOUND = 'WEEKLY_NOT_FOUND',
}

/**
 * API客户端请求选项
 */
export interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  headers?: Record<string, string>;
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse {
  total: number;
  success: number;
  failed: number;
  errors?: Array<{
    id: number | string;
    error: string;
  }>;
}

/**
 * 文件上传响应
 */
export interface UploadResponse {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * API响应状态枚举
 */
export enum ApiResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  LOADING = 'loading',
  IDLE = 'idle',
}

/**
 * API Hook返回的通用状态
 */
export interface ApiHookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: ApiResponseStatus;
}

/**
 * API Mutation状态
 */
export interface ApiMutationState<T> extends ApiHookState<T> {
  mutate: (variables?: any) => Promise<T>;
  reset: () => void;
}

/**
 * 查询参数类型
 */
export interface QueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

/**
 * 内容相关API类型
 */
export namespace ContentApi {
  export interface CreateRequest {
    title: string;
    content: string;
    status: 'draft' | 'ready' | 'published' | 'archived' | 'hidden';
    categoryId?: number;
    tagIds?: number[];
    source?: string;
  }

  export interface UpdateRequest extends Partial<CreateRequest> {
    id: number;
  }

  export interface ListQuery extends QueryParams {
    status?: string[];
    categoryIds?: number[];
    tagIds?: number[];
    sources?: string[];
    dateRange?: [string, string];
  }
}

/**
 * 分类相关API类型
 */
export namespace CategoryApi {
  export interface CreateRequest {
    name: string;
    description?: string;
    parentId?: number;
    color?: string;
  }

  export interface UpdateRequest extends Partial<CreateRequest> {
    id: number;
  }

  export interface ListQuery extends QueryParams {
    parentId?: number;
    includeChildren?: boolean;
  }
}

/**
 * 标签相关API类型
 */
export namespace TagApi {
  export interface CreateRequest {
    name: string;
    description?: string;
    color?: string;
  }

  export interface UpdateRequest extends Partial<CreateRequest> {
    id: number;
  }

  export interface ListQuery extends QueryParams {
    sortBy?: 'name' | 'usage_count' | 'created_at';
  }
}

/**
 * 周刊相关API类型
 */
export namespace WeeklyApi {
  export interface CreateRequest {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    status: 'draft' | 'published' | 'archived';
  }

  export interface UpdateRequest extends Partial<CreateRequest> {
    id: number;
  }

  export interface ListQuery extends QueryParams {
    status?: 'draft' | 'published' | 'archived';
  }
}

/**
 * 类型守卫函数
 */
export function isApiSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true && 'data' in response;
}

export function isApiErrorResponse(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false && 'error' in response;
}

export function isPaginatedResponse<T>(response: ApiResponse<any>): response is PaginatedResponse<T> {
  return isApiSuccessResponse(response) && 
         typeof response.data === 'object' && 
         'items' in response.data && 
         'total' in response.data;
}

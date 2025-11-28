/**
 * 类型定义统一导出
 */

// API响应格式类型
export * from './api';
// 领域模型类型
export * from './content';
export * from './category';
export * from './tag';

// 重新导出常用类型以便快速访问
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
  PaginatedData,
  BatchOperationResponse,
  UploadResponse,
  ApiHookState,
  ApiMutationState,
  QueryParams,
} from './api';

// 导出常用枚举
export {
  ApiErrorCode,
  ApiResponseStatus,
} from './api';

// 导出类型守卫函数
export {
  isApiSuccessResponse,
  isApiErrorResponse,
  isPaginatedResponse,
} from './api';
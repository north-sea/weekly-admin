# API 响应格式统一指南

## 概述

本项目已实施统一的API响应格式，以提高前后端数据交互的一致性和可预测性。

## 响应格式标准

### 成功响应

```typescript
{
  success: true,
  data: T,                    // 实际数据
  meta?: {                    // 可选元数据
    timestamp?: string,
    [key: string]: any
  }
}
```

### 错误响应

```typescript
{
  success: false,
  error: {
    code: string,             // 错误代码
    message: string,          // 错误消息
    details?: any             // 错误详情（可选）
  },
  meta?: {                    // 可选元数据
    timestamp?: string,
    [key: string]: any
  }
}
```

### 分页响应

```typescript
{
  success: true,
  data: {
    items: T[],              // 数据列表
    total: number,           // 总数
    page: number,            // 当前页
    pageSize: number,        // 每页大小
    totalPages: number       // 总页数
  }
}
```

## 工具函数

### 后端（API路由）

```typescript
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

// 成功响应
return createNextSuccessResponse(data, status, meta);

// 错误响应
return createNextErrorResponse(code, message, status, details);
```

### 前端（类型定义）

```typescript
import type { 
  ApiResponse, 
  ApiSuccessResponse, 
  ApiErrorResponse,
  isApiSuccessResponse,
  isApiErrorResponse 
} from '@/types';

// 类型守卫使用
if (isApiSuccessResponse(response)) {
  // response.data 现在是类型安全的
  console.log(response.data);
}
```

## API Client 智能处理

API Client (`src/lib/api-client.ts`) 已优化为智能处理统一响应格式：

**处理逻辑：**
1. **成功响应** `{ success: true, data: ... }` → 自动提取 `data` 字段
2. **错误响应** `{ success: false, error: ... }` → 自动抛出结构化错误
3. **向后兼容** 直接返回数据（用于少数旧格式API）

**错误处理增强：**
```typescript
// API Client 会自动将错误响应转换为异常
try {
  const data = await apiClient.get('/api/some-endpoint');
  // data 是已提取的实际数据
} catch (error) {
  // error 包含 code, message, details 属性
  console.log(error.code);     // 错误代码
  console.log(error.message);  // 错误消息  
  console.log(error.details);  // 错误详情
}
```

## 错误代码标准

```typescript
export enum ApiErrorCode {
  // 认证相关
  UNAUTHORIZED = 'UNAUTHORIZED',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // 验证相关
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ID = 'INVALID_ID',
  
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
}
```

## 最佳实践

### 1. API路由实现

```typescript
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const data = await SomeService.getData();
    return createNextSuccessResponse(data);
  } catch (error) {
    console.error('API Error:', error);
    return createNextErrorResponse('GET_ERROR', '获取数据失败', 500);
  }
}
```

### 2. 前端Hook使用

```typescript
import { useGet } from '@/hooks/useApi';
import type { ApiSuccessResponse } from '@/types';

export function useSomeData() {
  return useGet<SomeDataType>('/api/some-endpoint', {
    onSuccess: (data) => {
      // data 已经是解包后的实际数据
      console.log('Data received:', data);
    },
    onError: (error) => {
      // error 包含完整的错误信息
      console.error('API Error:', error);
    }
  });
}
```

### 3. 错误处理

```typescript
// 全局错误处理在 QueryProvider 中已配置
// 具体业务错误可以在组件中处理

const { data, error, isLoading } = useSomeData();

if (error) {
  // 错误已经被统一处理，这里可以显示特定的UI
  return <ErrorDisplay message={error} />;
}
```

## 已更新的API端点

以下API端点已使用统一响应格式：

- ✅ `/api/content` (GET, POST)
- ✅ `/api/content/[id]` (GET, PUT, DELETE)
- ✅ `/api/categories` (GET, POST)
- ✅ `/api/categories/[id]` (GET, PUT, DELETE)
- ✅ `/api/tags` (GET, POST)
- ✅ `/api/tags/[id]` (GET, PUT, DELETE)
- ✅ `/api/analytics` (GET)
- ✅ `/api/analytics/sources` (GET)
- ✅ `/api/analytics/advanced` (GET)
- ✅ `/api/search` (GET)
- ✅ `/api/weekly` (GET, POST)
- ✅ `/api/weekly/[id]` (GET, PUT, DELETE)

## 迁移注意事项

1. **向后兼容**：API Client 自动处理新旧格式，现有代码无需修改
2. **类型安全**：使用新的类型定义可以获得更好的TypeScript支持
3. **错误处理**：统一的错误格式使错误处理更加一致
4. **调试友好**：标准化的响应格式便于调试和日志记录

## 相关文件

- `src/types/api.ts` - 统一API类型定义
- `src/types/index.ts` - 类型导出
- `src/lib/utils/serialization.ts` - 响应格式工具函数
- `src/lib/api-client.ts` - API客户端（自动兼容）
- `src/hooks/useApi.ts` - React Query封装
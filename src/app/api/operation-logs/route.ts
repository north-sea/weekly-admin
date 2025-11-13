import { NextRequest, NextResponse } from 'next/server';
import { OperationLogService } from '@/lib/services/operation-log';
import { authMiddleware } from '@/lib/auth-middleware';
import { prepareApiResponse } from '@/lib/utils/serialization';
import { z } from 'zod';

const OperationLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  userId: z.coerce.number().int().positive().optional(),
  operationType: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  keyword: z.string().optional()
});

// GET /api/operation-logs - 获取操作日志列表
export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);

    // 只有管理员可以查看操作日志
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ 
        success: false, 
        error: { 
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '权限不足，需要管理员权限' 
        } 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // 处理日期参数
    if (queryParams.startDate) {
      queryParams.startDate = new Date(queryParams.startDate).toISOString();
    }
    if (queryParams.endDate) {
      queryParams.endDate = new Date(queryParams.endDate).toISOString();
    }
    
    const validatedQuery = OperationLogQuerySchema.parse(queryParams);
    
    // 转换日期字符串为Date对象
    const query = {
      ...validatedQuery,
      startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
      endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined
    };
    
    const result = await OperationLogService.getOperationLogs(query);
    
    // 处理序列化问题
    const serializedResult = prepareApiResponse(result);
    return NextResponse.json({ success: true, data: serializedResult });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    
    // 处理认证错误
    if (error instanceof Error && error.message.includes('认证')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'AUTHENTICATION_REQUIRED', 
            message: '请先登录' 
          } 
        },
        { status: 401 }
      );
    }
    
    // 处理参数验证错误
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: '参数验证失败', 
            details: error.message 
          } 
        },
        { status: 400 }
      );
    }
    
    // 其他错误
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'GET_OPERATION_LOGS_ERROR', 
          message: '获取操作日志失败' 
        } 
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { OperationLogService } from '@/lib/services/operation-log';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';
import { z } from 'zod';

const OperationLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  userId: z.coerce.number().int().positive().optional(),
  operationType: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']).optional(),
  resourceType: z.string().optional(),
  resourceId: z.coerce.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  keyword: z.string().optional()
});

// GET /api/operation-logs - 获取操作日志列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 只有管理员可以查看操作日志
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
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
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '参数验证失败', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '获取操作日志失败' },
      { status: 500 }
    );
  }
}
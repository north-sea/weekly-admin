import { NextRequest, NextResponse } from 'next/server';
import { OperationLogService } from '@/lib/services/operation-log';
import { authenticateRequest } from '@/lib/auth';
import { z } from 'zod';

const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  userId: z.coerce.number().int().positive().optional(),
  operationType: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  keyword: z.string().optional()
});

// GET /api/operation-logs/export - 导出操作日志
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 只有管理员可以导出操作日志
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
    
    const validatedQuery = ExportQuerySchema.parse(queryParams);
    
    // 转换日期字符串为Date对象
    const query = {
      ...validatedQuery,
      startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
      endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined
    };
    
    const exportData = await OperationLogService.exportOperationLogs(query, validatedQuery.format);
    
    // 设置响应头
    const headers = new Headers();
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (validatedQuery.format === 'csv') {
      headers.set('Content-Type', 'text/csv; charset=utf-8');
      headers.set('Content-Disposition', `attachment; filename="operation-logs-${timestamp}.csv"`);
    } else {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Content-Disposition', `attachment; filename="operation-logs-${timestamp}.json"`);
    }
    
    return new NextResponse(exportData, { headers });
  } catch (error) {
    console.error('导出操作日志失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '参数验证失败', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '导出操作日志失败' },
      { status: 500 }
    );
  }
}
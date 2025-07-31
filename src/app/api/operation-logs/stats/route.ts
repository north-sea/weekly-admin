import { NextRequest, NextResponse } from 'next/server';
import { OperationLogService } from '@/lib/services/operation-log';
import { authMiddleware } from '@/lib/auth-middleware';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/operation-logs/stats - 获取操作统计信息
export async function GET(request: NextRequest) {
  try {
    const user = await authMiddleware(request);

    // 只有管理员可以查看操作统计
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
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const stats = await OperationLogService.getOperationStats(startDate, endDate);
    
    // 处理序列化问题
    const serializedStats = prepareApiResponse(stats);
    return NextResponse.json({ success: true, data: serializedStats });
  } catch (error) {
    console.error('获取操作统计失败:', error);
    
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
    
    // 其他错误
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'GET_OPERATION_STATS_ERROR', 
          message: '获取操作统计失败' 
        } 
      },
      { status: 500 }
    );
  }
}
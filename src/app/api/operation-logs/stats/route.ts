import { NextRequest, NextResponse } from 'next/server';
import { OperationLogService } from '@/lib/services/operation-log';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/operation-logs/stats - 获取操作统计信息
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 只有管理员可以查看操作统计
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
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
    return NextResponse.json(
      { error: '获取操作统计失败' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { getJobWorkerHealth } from '@/lib/jobs/health';
import { serializeSpecialTypes } from '@/lib/utils/serialization';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const data = await getJobWorkerHealth();

    return NextResponse.json(serializeSpecialTypes({ success: true, data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取任务队列状态失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    return NextResponse.json({
      success: false,
      error: {
        code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'GET_WORKBENCH_JOBS_ERROR',
        message,
      },
    }, { status });
  }
}

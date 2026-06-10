import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/lib/auth-middleware';
import { getWorkbenchRuns, WorkbenchRunsQuerySchema } from '@/lib/services/weekly-workbench';
import { serializeSpecialTypes } from '@/lib/utils/serialization';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    const query = WorkbenchRunsQuerySchema.parse({
      workflow: searchParams.get('workflow') ?? undefined,
      step: searchParams.get('step') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      targetType: searchParams.get('targetType') ?? undefined,
      targetId: searchParams.get('targetId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    const data = await getWorkbenchRuns(query);

    return NextResponse.json(serializeSpecialTypes({ success: true, data }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          details: error.issues,
        },
      }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : '获取自动化运行记录失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    return NextResponse.json({
      success: false,
      error: {
        code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'GET_WORKBENCH_RUNS_ERROR',
        message,
      },
    }, { status });
  }
}

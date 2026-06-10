import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/lib/auth-middleware';
import { getWorkbenchCandidates } from '@/lib/services/weekly-workbench';
import { serializeSpecialTypes } from '@/lib/utils/serialization';

export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);
    const { searchParams } = new URL(request.url);
    const data = await getWorkbenchCandidates({
      weekOffset: searchParams.get('weekOffset') ?? undefined,
      date: searchParams.get('date') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

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

    const message = error instanceof Error ? error.message : '获取候选内容失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    return NextResponse.json({
      success: false,
      error: {
        code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'GET_WORKBENCH_CANDIDATES_ERROR',
        message,
      },
    }, { status });
  }
}

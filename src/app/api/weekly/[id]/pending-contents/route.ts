import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { getPendingContentsForWeekly } from '@/lib/services/weekly-automation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = await params;
    const weeklyId = parseInt(resolvedParams.id);

    if (isNaN(weeklyId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的周刊ID',
          },
        },
        { status: 400 }
      );
    }

    const result = await getPendingContentsForWeekly(weeklyId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get pending contents error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_PENDING_CONTENTS_ERROR',
          message: error instanceof Error ? error.message : '获取待关联内容失败',
        },
      },
      { status: 500 }
    );
  }
}

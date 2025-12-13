import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { quailService } from '@/lib/services/quail';

/**
 * GET /api/quail/status/:issueId
 * 获取周刊的 Quail 发布状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = await params;
    const issueId = parseInt(resolvedParams.issueId);

    if (isNaN(issueId)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ID',
            message: '无效的周刊 ID',
          },
        },
        { status: 400 }
      );
    }

    const status = await quailService.checkPublishStatus(issueId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Quail status error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: error instanceof Error ? error.message : '获取状态失败',
        },
      },
      { status: 500 }
    );
  }
}

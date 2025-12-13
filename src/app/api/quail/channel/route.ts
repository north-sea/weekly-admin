import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { quailService } from '@/lib/services/quail';

/**
 * GET /api/quail/channel
 * 获取 Quail 频道信息
 */
export async function GET(request: NextRequest) {
  try {
    await authMiddleware(request);

    const channelInfo = await quailService.getChannelInfo();

    if (!channelInfo) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CHANNEL_NOT_FOUND',
            message: 'Quail 频道未配置或获取失败',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: channelInfo,
    });
  } catch (error) {
    console.error('Quail channel error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CHANNEL_ERROR',
          message: error instanceof Error ? error.message : '获取频道信息失败',
        },
      },
      { status: 500 }
    );
  }
}

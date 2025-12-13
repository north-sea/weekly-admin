import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { quailService } from '@/lib/services/quail';
import { z } from 'zod';

const DeliverSchema = z.object({
  issueId: z.number().int().positive(),
});

/**
 * POST /api/quail/deliver
 * 发送周刊邮件给订阅者
 */
export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);
    const body = await request.json();
    const data = DeliverSchema.parse(body);

    const result = await quailService.deliverWeekly(data.issueId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DELIVER_FAILED',
            message: result.error || '发送失败',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '邮件发送成功',
    });
  } catch (error) {
    console.error('Quail deliver error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELIVER_ERROR',
          message: error instanceof Error ? error.message : '发送失败',
        },
      },
      { status: 500 }
    );
  }
}

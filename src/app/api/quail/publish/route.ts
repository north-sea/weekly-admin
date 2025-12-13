import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { quailService } from '@/lib/services/quail';
import { z } from 'zod';

const PublishSchema = z.object({
  issueId: z.number().int().positive(),
  forceRepublish: z.boolean().optional(),
  deliver: z.boolean().optional(),
});

/**
 * POST /api/quail/publish
 * 发布周刊到 Quail
 */
export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);
    const body = await request.json();
    const data = PublishSchema.parse(body);

    const result = await quailService.publishWeekly(data.issueId, {
      forceRepublish: data.forceRepublish,
      deliver: data.deliver,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PUBLISH_FAILED',
            message: result.error || '发布失败',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        quailPostId: result.quailPostId,
        quailPostSlug: result.quailPostSlug,
      },
    });
  } catch (error) {
    console.error('Quail publish error:', error);

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
          code: 'PUBLISH_ERROR',
          message: error instanceof Error ? error.message : '发布失败',
        },
      },
      { status: 500 }
    );
  }
}

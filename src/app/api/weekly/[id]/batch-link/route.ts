import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { batchLinkContentsToWeekly } from '@/lib/services/weekly-automation';
import { z } from 'zod';

const BatchLinkSchema = z.object({
  contentIds: z.array(z.number().int().positive()).min(1).max(30),
});

export async function POST(
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

    const body = await request.json();
    const { contentIds } = BatchLinkSchema.parse(body);

    const result = await batchLinkContentsToWeekly(weeklyId, contentIds);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Batch link contents error:', error);

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
          code: 'BATCH_LINK_ERROR',
          message: error instanceof Error ? error.message : '批量关联失败',
        },
      },
      { status: 500 }
    );
  }
}

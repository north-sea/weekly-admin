import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { autoLinkWeeklyContents } from '@/lib/services/weekly-automation';
import { z } from 'zod';

const AutoLinkSchema = z.object({
  maxItems: z.number().int().positive().max(30).default(15),
  weekOffset: z.number().int().min(-52).max(52).default(0),
});

export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);

    const body = await request.json().catch(() => ({}));
    const options = AutoLinkSchema.parse(body);

    const result = await autoLinkWeeklyContents(options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Auto link weekly contents error:', error);

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
          code: 'AUTO_LINK_ERROR',
          message: error instanceof Error ? error.message : '自动关联失败',
        },
      },
      { status: 500 }
    );
  }
}

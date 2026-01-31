import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { autoCreateWeeklyIssue } from '@/lib/services/weekly-automation';
import { z } from 'zod';

const AutoCreateSchema = z.object({
  forceCreate: z.boolean().default(false),
  weekOffset: z.number().int().min(-52).max(52).default(0),
});

export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);

    const body = await request.json().catch(() => ({}));
    const options = AutoCreateSchema.parse(body);

    const result = await autoCreateWeeklyIssue(options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Auto create weekly issue error:', error);

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
          code: 'AUTO_CREATE_ERROR',
          message: error instanceof Error ? error.message : '自动创建失败',
        },
      },
      { status: 500 }
    );
  }
}

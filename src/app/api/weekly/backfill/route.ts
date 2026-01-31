import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { backfillWeeklyContents } from '@/lib/services/weekly-automation';
import { z } from 'zod';

const BackfillSchema = z.object({
  dryRun: z.boolean().default(false),
  maxItemsPerIssue: z.number().int().positive().max(30).default(15),
});

export async function POST(request: NextRequest) {
  try {
    await authMiddleware(request);

    const body = await request.json().catch(() => ({}));
    const options = BackfillSchema.parse(body);

    const result = await backfillWeeklyContents(options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Backfill weekly contents error:', error);

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
          code: 'BACKFILL_ERROR',
          message: error instanceof Error ? error.message : '回填失败',
        },
      },
      { status: 500 }
    );
  }
}

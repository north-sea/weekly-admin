import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/lib/auth-middleware';
import { getLatestHermesSuggestionPreview, previewWeeklySuggestion } from '@/lib/services/weekly-workbench';
import { serializeSpecialTypes } from '@/lib/utils/serialization';

const ParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const BodySchema = z.object({
  maxItems: z.number().int().positive().max(30).default(12),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = ParamsSchema.parse(await params);
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const data = await previewWeeklySuggestion({
      weeklyIssueId: resolvedParams.id,
      maxItems: body.maxItems,
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

    const message = error instanceof Error ? error.message : '生成周刊建议失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    return NextResponse.json({
      success: false,
      error: {
        code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'PREVIEW_WEEKLY_SUGGESTION_ERROR',
        message,
      },
    }, { status });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = ParamsSchema.parse(await params);
    const data = await getLatestHermesSuggestionPreview(resolvedParams.id);

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

    const message = error instanceof Error ? error.message : '获取 Hermes 建议失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    return NextResponse.json({
      success: false,
      error: {
        code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'GET_HERMES_SUGGESTION_ERROR',
        message,
      },
    }, { status });
  }
}

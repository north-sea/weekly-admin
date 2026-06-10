import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/lib/auth-middleware';
import { applyWorkbenchSuggestion } from '@/lib/services/weekly-workbench';
import { serializeSpecialTypes } from '@/lib/utils/serialization';

const ParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const ApplyItemSchema = z.object({
  content_id: z.number().int().positive(),
  section: z.string().min(1).max(100),
  featured: z.boolean().optional().default(false),
  reason: z.string().max(200).optional(),
});

const BodySchema = z.object({
  replaceExisting: z.boolean().optional().default(false),
  sourceRunId: z.string().min(1).max(160).optional(),
  agentRunId: z.string().min(1).max(160).optional(),
  items: z.array(ApplyItemSchema).min(1).max(30),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authMiddleware(request);
    const resolvedParams = ParamsSchema.parse(await params);
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const data = await applyWorkbenchSuggestion({
      weeklyIssueId: resolvedParams.id,
      replaceExisting: body.replaceExisting,
      sourceRunId: body.sourceRunId,
      agentRunId: body.agentRunId,
      items: body.items,
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

    const message = error instanceof Error ? error.message : '应用周刊建议失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    const code = 'code' in Object(error) && typeof Object(error).code === 'string'
      ? Object(error).code
      : status === 401
        ? 'AUTHENTICATION_REQUIRED'
        : 'APPLY_WEEKLY_SUGGESTION_ERROR';

    return NextResponse.json({
      success: false,
      error: {
        code,
        message,
      },
    }, { status });
  }
}

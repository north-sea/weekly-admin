import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { POST as postAutomationPublish } from '@/app/api/v1/weekly/publish/route';
import { authMiddleware } from '@/lib/auth-middleware';

const ParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const BodySchema = z.object({
  forceRepublish: z.boolean().optional().default(false),
  deliver: z.boolean().optional().default(false),
});

function getServerAutomationToken() {
  return process.env.ADMIN_UI_AUTOMATION_TOKEN?.trim() || process.env.CRON_API_TOKEN?.trim() || null;
}

function getRequiredIdempotencyKey(request: NextRequest) {
  const value = request.headers.get('idempotency-key')?.trim();
  return value || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authMiddleware(request);
    const token = getServerAutomationToken();
    if (!token) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ADMIN_UI_AUTOMATION_TOKEN_MISSING',
          message: 'Admin UI publish requires ADMIN_UI_AUTOMATION_TOKEN or CRON_API_TOKEN with weekly:publish scope',
        },
      }, { status: 500 });
    }

    const idempotencyKey = getRequiredIdempotencyKey(request);
    if (!idempotencyKey) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required for publish',
        },
      }, { status: 409 });
    }

    const resolvedParams = ParamsSchema.parse(await params);
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const automationRequest = new NextRequest(new URL('/api/v1/weekly/publish', request.url), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        weeklyIssueId: resolvedParams.id,
        forceRepublish: body.forceRepublish,
        deliver: body.deliver,
      }),
    });

    const response = await postAutomationPublish(automationRequest);
    const envelope = await response.json();

    return NextResponse.json({
      ...envelope,
      meta: {
        ...(envelope.meta ?? {}),
        humanCaller: {
          userId: user.id,
          username: user.username,
        },
      },
    }, { status: response.status });
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

    const message = error instanceof Error ? error.message : '发布周刊失败';
    const status = message.includes('认证') || message.includes('令牌') ? 401 : 500;
    return NextResponse.json({
      success: false,
      error: {
        code: status === 401 ? 'AUTHENTICATION_REQUIRED' : 'PUBLISH_WEEKLY_WORKBENCH_ERROR',
        message,
      },
    }, { status });
  }
}

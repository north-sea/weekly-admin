import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { AiPromptSceneSchema } from '@/lib/validations/ai';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scene: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const { scene: rawScene } = await params;
    const sceneParsed = AiPromptSceneSchema.safeParse(rawScene);
    if (!sceneParsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的 scene', 400);
    }

    const prompt = await AiPromptService.reset(sceneParsed.data);
    return createNextSuccessResponse(prompt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '重置 Prompt 失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


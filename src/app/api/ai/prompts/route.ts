import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const prompts = await AiPromptService.listMerged();
    return createNextSuccessResponse(prompts);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取 Prompt 失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


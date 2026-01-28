import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { AiPromptSceneSchema, AiPromptUpdateSchema } from '@/lib/validations/ai';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

export async function GET(
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

    const prompt = await AiPromptService.getByScene(sceneParsed.data);
    return createNextSuccessResponse(prompt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取 Prompt 失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function PUT(
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

    const bodyParsed = AiPromptUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!bodyParsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }

    const prompt = await AiPromptService.upsert(sceneParsed.data, bodyParsed.data.prompt);
    return createNextSuccessResponse(prompt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新 Prompt 失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


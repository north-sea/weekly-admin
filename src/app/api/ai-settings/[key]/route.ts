import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiSettingsService } from '@/lib/services/ai-settings';
import { AiSettingKeySchema, AiSettingUpdateSchema } from '@/lib/validations/ai-settings';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const { key: rawKey } = await params;
    const keyParsed = AiSettingKeySchema.safeParse(rawKey);
    if (!keyParsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的设置 key', 400);
    }

    const setting = await AiSettingsService.get(keyParsed.data);
    if (!setting) {
      return createNextErrorResponse('NOT_FOUND', '设置不存在', 404);
    }

    return createNextSuccessResponse(setting);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取 AI 设置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const { key: rawKey } = await params;
    const keyParsed = AiSettingKeySchema.safeParse(rawKey);
    if (!keyParsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的设置 key', 400);
    }

    const bodyParsed = AiSettingUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!bodyParsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }

    const setting = await AiSettingsService.upsert(keyParsed.data, bodyParsed.data.value);
    return createNextSuccessResponse(setting);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新 AI 设置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

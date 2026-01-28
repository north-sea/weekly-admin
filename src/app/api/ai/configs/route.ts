import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiConfigService } from '@/lib/services/ai-config';
import { AiConfigCreateSchema } from '@/lib/validations/ai';
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

    const configs = await AiConfigService.list();
    return createNextSuccessResponse(configs);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const parsed = AiConfigCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }

    const created = await AiConfigService.create(parsed.data);
    return createNextSuccessResponse(created, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


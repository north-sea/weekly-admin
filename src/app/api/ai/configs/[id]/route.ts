import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiConfigService } from '@/lib/services/ai-config';
import { AiConfigUpdateSchema } from '@/lib/validations/ai';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const parseId = (raw: string) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (!id) return createNextErrorResponse('VALIDATION_ERROR', '无效的配置 ID', 400);

    const config = await AiConfigService.getById(id);
    if (!config) return createNextErrorResponse('NOT_FOUND', '配置不存在', 404);

    return createNextSuccessResponse(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (!id) return createNextErrorResponse('VALIDATION_ERROR', '无效的配置 ID', 400);

    const parsed = AiConfigUpdateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }

    const updated = await AiConfigService.update(id, parsed.data);
    return createNextSuccessResponse(updated);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === '配置不存在') {
      return createNextErrorResponse('NOT_FOUND', error.message, 404);
    }

    const message = error instanceof Error ? error.message : '更新配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }
    if (!hasRole(authResult.user, 'ADMIN')) {
      return createNextErrorResponse('FORBIDDEN', '权限不足', 403);
    }

    const { id: idParam } = await params;
    const id = parseId(idParam);
    if (!id) return createNextErrorResponse('VALIDATION_ERROR', '无效的配置 ID', 400);

    await AiConfigService.remove(id);
    return createNextSuccessResponse({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


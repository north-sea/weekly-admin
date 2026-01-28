import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiConfigService } from '@/lib/services/ai-config';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const parseId = (raw: string) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
};

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

    const updated = await AiConfigService.setDefault(id);
    return createNextSuccessResponse(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '设置默认配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


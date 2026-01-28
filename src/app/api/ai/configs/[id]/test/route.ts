import { NextRequest } from 'next/server';

import { authenticateRequest, hasRole } from '@/lib/auth';
import { AiConfigService } from '@/lib/services/ai-config';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const parseId = (raw: string) => {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export async function POST(
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

    const config = await AiConfigService.getResolvedById(id);
    if (!config) return createNextErrorResponse('NOT_FOUND', '配置不存在', 404);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const startedAt = Date.now();

    try {
      const baseUrl = normalizeBaseUrl(config.baseUrl);

      if (config.provider === 'anthropic') {
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.textModel,
            max_tokens: 5,
            temperature: 0,
            messages: [{ role: 'user', content: 'Ping' }],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Anthropic request failed');
        }
      } else {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.textModel,
            messages: [{ role: 'user', content: 'Ping' }],
            temperature: 0,
            max_tokens: 5,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'OpenAI request failed');
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    return createNextSuccessResponse({
      ok: true,
      provider: config.provider,
      latency_ms: Date.now() - startedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '测试失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


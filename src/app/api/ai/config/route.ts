import { NextRequest } from 'next/server';

import { authenticateRequest } from '@/lib/auth';
import { AiConfigService } from '@/lib/services/ai-config';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const dbConfig = await AiConfigService.getResolvedDefault().catch(() => null);
    const fallbackProvider = (process.env.AI_PROVIDER ?? '').toLowerCase() || 'openai';

    const provider = dbConfig?.enabled ? dbConfig.provider : fallbackProvider;

    const baseUrl = normalizeBaseUrl(
      (dbConfig?.enabled ? dbConfig.baseUrl : null) ??
        process.env.AI_BASE_URL ??
        process.env.OPENAI_BASE_URL ??
        (provider === 'anthropic' ? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com' : 'https://api.openai.com')
    );

    const textModel =
      (dbConfig?.enabled ? dbConfig.textModel : null) ??
      process.env.AI_TEXT_MODEL ??
      process.env.OPENAI_MODEL ??
      (provider === 'anthropic' ? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest' : 'gpt-4o-mini');

    const weeklyDescPromptRecord = await AiPromptService.getByScene('weekly_desc');

    const weeklyDescPrompt =
      weeklyDescPromptRecord.is_default && process.env.AI_WEEKLY_DESC_PROMPT
        ? process.env.AI_WEEKLY_DESC_PROMPT
        : weeklyDescPromptRecord.prompt;

    return createNextSuccessResponse({
      provider,
      baseUrl,
      textModel,
      hasKey: Boolean(dbConfig?.enabled ? dbConfig.apiKey : process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      weeklyDescPrompt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取 AI 配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

import { NextRequest } from 'next/server';

import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const provider = (process.env.AI_PROVIDER ?? '').toLowerCase() || 'openai';

    const baseUrl = normalizeBaseUrl(
      process.env.AI_BASE_URL ??
        process.env.OPENAI_BASE_URL ??
        (provider === 'anthropic' ? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com' : 'https://api.openai.com')
    );

    const textModel =
      process.env.AI_TEXT_MODEL ??
      process.env.OPENAI_MODEL ??
      (provider === 'anthropic' ? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest' : 'gpt-4o-mini');

    const imageModel = process.env.AI_IMAGE_MODEL ?? process.env.AI_TEXT_MODEL ?? 'gpt-image-1';

    const weeklyDescPrompt =
      process.env.AI_WEEKLY_DESC_PROMPT ??
      '你是一个周刊编辑，请基于本期标题、时间范围和收录的内容，生成 25-40 字的中文简介，语气简洁有吸引力，不要使用 Markdown。标题：{{title}}；时间：{{date_range}}；收录：{{contents_summary}}';

    const weeklyCoverPrompt =
      process.env.AI_WEEKLY_COVER_PROMPT ??
      'Design a sleek, modern cover image for a Chinese tech/design weekly digest. Title: "{{title}}". Topics: {{contents_summary}}. Tone: dark elegant, subtle gradient, clean typography.';

    return createNextSuccessResponse({
      provider,
      baseUrl,
      textModel,
      imageModel,
      hasKey: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      weeklyDescPrompt,
      weeklyCoverPrompt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取 AI 配置失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { AiConfigService } from '@/lib/services/ai-config';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const BodySchema = z.object({
  prompt: z.string().trim().min(1),
  size: z.string().optional(),
  model: z.string().optional(),
});

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const getOpenAiConfig = async () => {
  const defaultConfig = await AiConfigService.getResolvedDefault().catch(() => null);
  if (defaultConfig?.enabled && defaultConfig.provider === 'openai') {
    return {
      apiKey: defaultConfig.apiKey,
      baseUrl: normalizeBaseUrl(defaultConfig.baseUrl),
      imageModel: defaultConfig.imageModel ?? process.env.AI_IMAGE_MODEL ?? process.env.AI_TEXT_MODEL ?? 'gpt-image-1',
    };
  }

  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required env var: AI_API_KEY (or OPENAI_API_KEY)');
  }
  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com');
  const imageModel = process.env.AI_IMAGE_MODEL ?? process.env.AI_TEXT_MODEL ?? 'gpt-image-1';
  return { apiKey, baseUrl, imageModel };
};

const extractImageFromChatContent = (content: string) => {
  const markdownImageMatch = content.match(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+)\)/);
  if (markdownImageMatch) {
    const dataUrl = markdownImageMatch[1];
    const b64Match = dataUrl.match(/base64,(.+)$/);
    const b64 = b64Match ? b64Match[1] : '';
    return { dataUrl, b64 };
  }

  if (content.startsWith('data:image')) {
    const b64Match = content.match(/base64,(.+)$/);
    const b64 = b64Match ? b64Match[1] : '';
    return { dataUrl: content, b64 };
  }

  if (content && (content.startsWith('/9j/') || content.startsWith('iVBOR'))) {
    const mimeType = content.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
    return { dataUrl: `data:${mimeType};base64,${content}`, b64: content };
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return createNextErrorResponse('VALIDATION_ERROR', '参数验证失败', 400);
    }

    const { apiKey, baseUrl, imageModel } = await getOpenAiConfig();
    const model = parsed.data.model ?? imageModel;
    const prompt = parsed.data.prompt;
    const size = parsed.data.size ?? '1024x576';

    const useLegacyImageApi = model.toLowerCase().includes('dall-e') || model.toLowerCase().includes('dalle');

    if (useLegacyImageApi) {
      const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          response_format: 'b64_json',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '图片生成请求失败');
      }

      const result = (await response.json()) as any;
      return createNextSuccessResponse(result);
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '封面生成请求失败');
    }

    const result = (await response.json()) as any;

    const content = result?.choices?.[0]?.message?.content || '';
    if (result?.choices?.[0]?.message?.image_url) {
      return createNextSuccessResponse({
        data: [{ url: result.choices[0].message.image_url }],
        raw: result,
      });
    }

    const extracted = typeof content === 'string' ? extractImageFromChatContent(content) : null;
    if (extracted) {
      return createNextSuccessResponse({
        data: [{ b64_json: extracted.b64, url: extracted.dataUrl }],
        raw: result,
      });
    }

    return createNextSuccessResponse(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '图片生成失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}

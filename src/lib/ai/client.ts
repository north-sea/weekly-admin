'use client';

import { getAiConfig } from '@/stores/aiConfig';
import { AiConfigPayload } from './crypto';

interface TextCompletionParams {
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  configOverride?: AiConfigPayload;
}

interface ImageGenerationParams {
  prompt: string;
  size?: string; // 如 '1024x1024', '1792x1024' 等
  signal?: AbortSignal;
  configOverride?: AiConfigPayload;
}

const ensureConfig = (config?: AiConfigPayload) => {
  const current = config || getAiConfig();
  if (!current) {
    throw new Error('请先在 AI 设置中解锁或保存配置');
  }
  return current;
};

const buildHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

export const callTextModel = async ({
  prompt,
  messages,
  temperature = 0.5,
  maxTokens = 512,
  signal,
  configOverride,
}: TextCompletionParams) => {
  const config = ensureConfig(configOverride);
  const endpoint = `${config.baseUrl}/v1/chat/completions`;
  const body = {
    model: config.textModel,
    messages: messages && messages.length > 0 ? messages : [{ role: 'user', content: prompt || '' }],
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || '文本生成请求失败');
  }

  const result = await response.json();
  return result;
};

/**
 * 调用图片生成模型
 * 支持两种模式：
 * 1. chat/completions 接口（适用于 Gemini 等模型）
 * 2. images/generations 接口（适用于 DALL-E 等模型）
 */
export const callImageModel = async ({
  prompt,
  size = '1024x576',
  signal,
  configOverride,
}: ImageGenerationParams) => {
  const config = ensureConfig(configOverride);

  // 判断是否使用传统的 images/generations 接口
  // 只有明确使用 DALL-E 系列模型时才使用该接口，其他情况默认使用 chat/completions
  const useLegacyImageApi = config.imageModel?.toLowerCase().includes('dall-e') ||
                            config.imageModel?.toLowerCase().includes('dalle');

  if (!useLegacyImageApi) {
    // 使用 chat/completions 接口生成图片
    const endpoint = `${config.baseUrl}/v1/chat/completions`;
    const body = {
      model: config.imageModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '封面生成请求失败');
    }

    const result = await response.json();

    // 从 chat 响应中提取图片
    const content = result?.choices?.[0]?.message?.content || '';

    // 检查是否有 image_url 字段
    if (result?.choices?.[0]?.message?.image_url) {
      return {
        data: [{ url: result.choices[0].message.image_url }],
        raw: result,
      };
    }

    // 尝试从 Markdown 格式中提取 base64 图片
    // 格式如: ![image](data:image/png;base64,xxxxx)
    const markdownImageMatch = content.match(/!\[.*?\]\((data:image\/[^;]+;base64,[^)]+)\)/);
    if (markdownImageMatch) {
      const dataUrl = markdownImageMatch[1];
      // 提取纯 base64 部分
      const b64Match = dataUrl.match(/base64,(.+)$/);
      const b64 = b64Match ? b64Match[1] : '';
      return {
        data: [{ b64_json: b64, url: dataUrl }],
        raw: result,
      };
    }

    // 如果返回的直接是 data:image 格式
    if (content.startsWith('data:image')) {
      const b64Match = content.match(/base64,(.+)$/);
      const b64 = b64Match ? b64Match[1] : '';
      return {
        data: [{ b64_json: b64, url: content }],
        raw: result,
      };
    }

    // 如果返回的是纯 base64 字符串（以常见图片格式开头）
    if (content && (content.startsWith('/9j/') || content.startsWith('iVBOR'))) {
      const mimeType = content.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
      const dataUrl = `data:${mimeType};base64,${content}`;
      return {
        data: [{ b64_json: content, url: dataUrl }],
        raw: result,
      };
    }

    // 返回原始结果，让调用方处理
    return result;
  } else {
    // 使用传统的 images/generations 接口
    const endpoint = `${config.baseUrl}/v1/images/generations`;
    const body = {
      model: config.imageModel,
      prompt,
      size,
      response_format: 'b64_json', // 返回 base64 便于预览
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '封面生成请求失败');
    }

    const result = await response.json();
    return result;
  }
};

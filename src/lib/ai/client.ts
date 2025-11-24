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
  size?: '256x256' | '512x512' | '1024x1024';
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

export const callImageModel = async ({
  prompt,
  size = '1024x1024',
  signal,
  configOverride,
}: ImageGenerationParams) => {
  const config = ensureConfig(configOverride);
  const endpoint = `${config.baseUrl}/v1/images/generations`;
  const body = {
    model: config.imageModel,
    prompt,
    size,
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
};

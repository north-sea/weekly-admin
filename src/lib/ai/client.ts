'use client';

interface TextCompletionParams {
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface ImageGenerationParams {
  prompt: string;
  size?: string; // 如 '1024x1024', '1792x1024' 等
  signal?: AbortSignal;
  model?: string;
}

export const callTextModel = async ({
  prompt,
  messages,
  temperature = 0.5,
  maxTokens = 512,
  signal,
}: TextCompletionParams) => {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      messages,
      temperature,
      maxTokens,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || '文本生成请求失败');
  }

  const result = await response.json();
  return result?.data ?? result;
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
  model,
}: ImageGenerationParams) => {
  const response = await fetch('/api/ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size, model }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || '封面生成请求失败');
  }

  const result = await response.json();
  return result?.data ?? result;
};

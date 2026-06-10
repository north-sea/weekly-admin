'use client';

interface TextCompletionParams {
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
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

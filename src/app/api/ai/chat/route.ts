import { NextRequest } from 'next/server';
import { z } from 'zod';

import { authenticateRequest } from '@/lib/auth';
import { serverGenerateText } from '@/lib/ai/server/client';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const BodySchema = z.object({
  prompt: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
  model: z.string().optional(),
});

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

    const { prompt, messages, temperature, maxTokens, model } = parsed.data;

    const systemParts: string[] = [];
    const filteredMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (messages && messages.length > 0) {
      for (const msg of messages) {
        if (msg.role === 'system') {
          systemParts.push(msg.content);
        } else {
          filteredMessages.push({ role: msg.role, content: msg.content });
        }
      }
    } else {
      filteredMessages.push({ role: 'user', content: prompt ?? '' });
    }

    const text = await serverGenerateText({
      system: systemParts.length > 0 ? systemParts.join('\n') : undefined,
      messages: filteredMessages,
      temperature,
      maxTokens,
      model,
    });

    // OpenAI 兼容 shape（供现有前端代码直接读取 choices[0].message.content）
    return createNextSuccessResponse({
      choices: [{ message: { content: text } }],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI 请求失败';
    return createNextErrorResponse('INTERNAL_ERROR', message, 500);
  }
}


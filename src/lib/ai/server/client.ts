import 'server-only';

import { AiConfigService, type AiProvider } from '@/lib/services/ai-config';

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiGenerateOptions {
  messages: AiMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  configId?: number;
  signal?: AbortSignal;
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const getOpenAiConfig = () => {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required env var: AI_API_KEY (or OPENAI_API_KEY)');
  }
  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com');
  const model = process.env.AI_TEXT_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  return { apiKey, baseUrl, model };
};

const getAnthropicConfig = () => {
  const apiKey = getRequiredEnv('ANTHROPIC_API_KEY');
  const baseUrl = normalizeBaseUrl(process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com');
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest';
  return { apiKey, baseUrl, model };
};

const getProvider = (): AiProvider => {
  const explicit = (process.env.AI_PROVIDER ?? '').toLowerCase();
  if (explicit === 'openai' || explicit === 'anthropic') {
    return explicit;
  }

  if (process.env.AI_API_KEY || process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'openai';
};

type ResolvedTextConfig = {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const resolveTextConfig = async (options: AiGenerateOptions): Promise<ResolvedTextConfig> => {
  if (typeof options.configId === 'number') {
    const config = await AiConfigService.getResolvedById(options.configId).catch(() => null);
    if (!config) {
      throw new Error('AI 配置不存在');
    }
    if (!config.enabled) {
      throw new Error('AI 配置已禁用');
    }
    return {
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: normalizeBaseUrl(config.baseUrl),
      model: config.textModel,
    };
  }

  const defaultConfig = await AiConfigService.getResolvedDefault().catch(() => null);
  if (defaultConfig && defaultConfig.enabled) {
    return {
      provider: defaultConfig.provider,
      apiKey: defaultConfig.apiKey,
      baseUrl: normalizeBaseUrl(defaultConfig.baseUrl),
      model: defaultConfig.textModel,
    };
  }

  const provider = getProvider();
  if (provider === 'anthropic') {
    const { apiKey, baseUrl, model } = getAnthropicConfig();
    return { provider, apiKey, baseUrl, model };
  }

  const { apiKey, baseUrl, model } = getOpenAiConfig();
  return { provider, apiKey, baseUrl, model };
};

async function openaiGenerateText(config: ResolvedTextConfig, options: AiGenerateOptions): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? config.model,
      messages: [
        ...(options.system ? [{ role: 'system', content: options.system }] : []),
        ...(options.messages ?? []),
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 512,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'OpenAI request failed');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const raw = await response.text();
    throw new Error(raw || 'OpenAI request failed (non-JSON response)');
  }

  const result: any = await response.json();

  if (result?.error?.message && typeof result.error.message === 'string') {
    throw new Error(result.error.message);
  }

  const extractText = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (!Array.isArray(value)) return undefined;
    const joined = value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        if ((part as any).type === 'text' && typeof (part as any).text === 'string') return (part as any).text;
        if (typeof (part as any).text === 'string') return (part as any).text;
        if (typeof (part as any).content === 'string') return (part as any).content;
        if (typeof (part as any).value === 'string') return (part as any).value;
        return '';
      })
      .join('');
    return joined || undefined;
  };

  const choice = result?.choices?.[0];
  const text =
    extractText(choice?.message?.content) ??
    (typeof choice?.text === 'string' ? choice.text : undefined) ??
    (typeof result?.output_text === 'string' ? result.output_text : undefined) ??
    (typeof result?.text === 'string' ? result.text : undefined);

  if (!text) {
    const refusal = choice?.message?.refusal;
    if (typeof refusal === 'string' && refusal) {
      throw new Error(refusal);
    }
    throw new Error('OpenAI response missing text content');
  }

  return text;
}

async function anthropicGenerateText(config: ResolvedTextConfig, options: AiGenerateOptions): Promise<string> {
  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model ?? config.model,
      max_tokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.2,
      system: options.system,
      messages: options.messages,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Anthropic request failed');
  }

  type AnthropicResponse = {
    content?: Array<{ type: string; text?: string }>;
  };

  const result: AnthropicResponse = await response.json();
  const text = (result.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text) {
    throw new Error('Anthropic response missing text content');
  }

  return text;
}

export async function serverGenerateText(options: AiGenerateOptions): Promise<string> {
  const config = await resolveTextConfig(options);
  if (config.provider === 'anthropic') return anthropicGenerateText(config, options);
  return openaiGenerateText(config, options);
}

export async function serverGenerateJSON<T>(options: AiGenerateOptions): Promise<T> {
  const text = await serverGenerateText({
    ...options,
    system: options.system
      ? `${options.system}\n\nReturn ONLY valid JSON.`
      : 'Return ONLY valid JSON.',
    temperature: 0,
  });

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Failed to parse JSON: ${message}`);
  }
}

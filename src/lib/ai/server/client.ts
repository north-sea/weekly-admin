import 'server-only';

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

type AiProvider = 'openai' | 'anthropic';

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

async function openaiGenerateText(options: AiGenerateOptions): Promise<string> {
  const { apiKey, baseUrl, model: defaultModel } = getOpenAiConfig();
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? defaultModel,
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

  type OpenAIChatResponse = {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const result: OpenAIChatResponse = await response.json();
  const text = result.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('OpenAI response missing text content');
  }

  return text;
}

async function anthropicGenerateText(options: AiGenerateOptions): Promise<string> {
  const { apiKey, baseUrl, model: defaultModel } = getAnthropicConfig();
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model ?? defaultModel,
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
  const provider = getProvider();
  if (provider === 'anthropic') return anthropicGenerateText(options);
  return openaiGenerateText(options);
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

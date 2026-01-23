import 'server-only';

type AnthropicRole = 'user' | 'assistant';

export interface AnthropicMessage {
  role: AnthropicRole;
  content: string;
}

export interface AnthropicGenerateOptions {
  messages: AnthropicMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
}

const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const getAnthropicConfig = () => {
  const apiKey = getRequiredEnv('ANTHROPIC_API_KEY');
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest';
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, ''), model };
};

export async function anthropicGenerateText(options: AnthropicGenerateOptions): Promise<string> {
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

  const result = (await response.json()) as any;
  const text = (result?.content ?? [])
    .filter((block: any) => block?.type === 'text')
    .map((block: any) => block?.text)
    .join('');

  if (!text) {
    throw new Error('Anthropic response missing text content');
  }

  return text;
}

export async function anthropicGenerateJSON<T>(
  options: AnthropicGenerateOptions
): Promise<T> {
  const text = await anthropicGenerateText({
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


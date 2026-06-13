import 'server-only';

import { AiConfigService, type AiProvider } from '@/lib/services/ai-config';
import {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
  InternalServerError,
} from 'openai';
import OpenAI from 'openai';

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
  /** transient 错误的最大重试次数（含首次外的额外尝试）。默认 2。 */
  maxRetries?: number;
}

/**
 * AI 调用错误的分类，供上层（评分服务、清洗脚本、feedback digest）据此决定
 * 是否计入 retry_count、是否退避、是否熔断。
 *
 * - `transient`: 网关层瞬时故障（Cloudflare 502/524/403 HTML、网络抖动、超时）。
 *   不代表内容有问题，应退避重试、不应累计 retry_count 把 item 拖入 failed。
 * - `invalid_response`: 拿到了模型响应，但无法解析成预期结构（JSON 非法、schema 不符）。
 *   可 reprompt 一次，仍失败则计入 retry_count。
 * - `auth`: 鉴权/配置错误（401/403 JSON、缺 key、配置禁用）。不应重试，需人工处理。
 * - `unknown`: 未归类，保守按不可重试处理。
 */
export type AiCallErrorKind = 'transient' | 'invalid_response' | 'auth' | 'unknown';

export class AiCallError extends Error {
  readonly kind: AiCallErrorKind;
  readonly status?: number;
  /** 原始响应体的截断摘要，避免把整页 HTML 灌进 DB / 日志。 */
  readonly detail?: string;

  constructor(kind: AiCallErrorKind, message: string, opts?: { status?: number; detail?: string }) {
    super(message);
    this.name = 'AiCallError';
    this.kind = kind;
    this.status = opts?.status;
    this.detail = opts?.detail;
  }

  get retriable(): boolean {
    return this.kind === 'transient';
  }
}

const MAX_DETAIL_CHARS = 300;

const summarizeBody = (body: string): string => {
  const trimmed = body.trim();
  if (trimmed.length <= MAX_DETAIL_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_DETAIL_CHARS)}…[truncated ${trimmed.length - MAX_DETAIL_CHARS} chars]`;
};

const looksLikeHtml = (body: string, contentType: string): boolean => {
  if (contentType.toLowerCase().includes('text/html')) return true;
  const head = body.slice(0, 200).toLowerCase();
  if (head.includes('<!doctype html') || head.includes('<html')) return true;

  // WAF/Cloudflare 特征消息
  if (/your request was blocked|access denied|cloudflare/i.test(body)) return true;

  return false;
};

/**
 * 将 OpenAI SDK 抛出的错误映射到 AiCallError 分类体系。
 *
 * 映射规则：
 * - APIConnectionError / APIConnectionTimeoutError → transient（网络层瞬时故障）
 * - AuthenticationError → auth（鉴权错误，不应重试）
 * - RateLimitError / InternalServerError → transient（429/5xx 可退避重试）
 * - SyntaxError → invalid_response（JSON 解析失败）
 * - 其他 → unknown（保守处理）
 */
export const classifyAiError = (error: unknown): AiCallError => {
  // 网络层连接/超时错误 → transient
  if (error instanceof APIConnectionError || error instanceof APIConnectionTimeoutError) {
    return new AiCallError('transient', error.message, {
      status: error.status,
      detail: summarizeBody(error.message),
    });
  }

  // 鉴权错误 → auth
  if (error instanceof AuthenticationError) {
    return new AiCallError('auth', error.message, {
      status: error.status,
      detail: summarizeBody(error.message),
    });
  }

  // 限流和服务端错误 → transient
  if (error instanceof RateLimitError || error instanceof InternalServerError) {
    return new AiCallError('transient', error.message, {
      status: error.status,
      detail: summarizeBody(error.message),
    });
  }

  // 通用 APIError，根据 status 判断
  if (error instanceof APIError) {
    const status = error.status ?? 0;
    const message = error.message || '';

    // 先检查是否是 HTML 错误页（网关层拦截）
    const isHtml = looksLikeHtml(message, '');
    if (isHtml) {
      return new AiCallError('transient', `Upstream gateway error (HTTP ${status})`, {
        status,
        detail: summarizeBody(message),
      });
    }

    if (status === 429 || status >= 500) {
      return new AiCallError('transient', message, {
        status,
        detail: summarizeBody(message),
      });
    }
    if (status === 401 || status === 403) {
      return new AiCallError('auth', message, {
        status,
        detail: summarizeBody(message),
      });
    }
    return new AiCallError('unknown', message, {
      status,
      detail: summarizeBody(message),
    });
  }

  // JSON 解析失败 → invalid_response
  if (error instanceof SyntaxError) {
    return new AiCallError('invalid_response', error.message, {
      detail: summarizeBody(error.message),
    });
  }

  // 其他未归类错误 → unknown
  const message = error instanceof Error ? error.message : String(error);
  return new AiCallError('unknown', message, {
    detail: summarizeBody(message),
  });
};

/**
 * 把一次 HTTP 失败响应分类为 AiCallError。
 *
 * 关键规则：网关返回的 HTML 错误页（Cloudflare 502/524/403、nginx 错误页）一律视为
 * transient，并且只保留截断摘要而非整页 HTML —— 这是本 feature 修复"整页 HTML 被
 * 当成 error 灌进 ai_score_details"和"无限重撞不稳定网关"的核心。
 */
export const classifyHttpError = (status: number, body: string, contentType: string): AiCallError => {
  const isHtml = looksLikeHtml(body, contentType);

  if (isHtml) {
    return new AiCallError('transient', `Upstream gateway error (HTTP ${status})`, {
      status,
      detail: summarizeBody(body),
    });
  }

  if (status === 401) {
    return new AiCallError('auth', `Authentication failed (HTTP ${status})`, {
      status,
      detail: summarizeBody(body),
    });
  }

  if (status === 408 || status === 429 || status >= 500) {
    return new AiCallError('transient', `Upstream transient error (HTTP ${status})`, {
      status,
      detail: summarizeBody(body),
    });
  }

  return new AiCallError('unknown', summarizeBody(body) || `Request failed (HTTP ${status})`, {
    status,
    detail: summarizeBody(body),
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 指数退避 + jitter，base 250ms。第 n 次重试约 250ms*2^n ± 25%。 */
const backoffDelay = (attempt: number): number => {
  const base = 250 * 2 ** attempt;
  const jitter = base * 0.25 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
};

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
      'User-Agent': 'weekly-admin/1.0',
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
    const contentType = response.headers.get('content-type') ?? '';
    throw classifyHttpError(response.status, errorText, contentType);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const raw = await response.text();
    // 200 但非 JSON（常见于网关把错误页以 200 返回）—— 按 transient 处理，保留摘要。
    if (looksLikeHtml(raw, contentType)) {
      throw new AiCallError('transient', 'Upstream returned non-JSON HTML body', {
        status: response.status,
        detail: summarizeBody(raw),
      });
    }
    throw new AiCallError('invalid_response', 'OpenAI request failed (non-JSON response)', {
      status: response.status,
      detail: summarizeBody(raw),
    });
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
      'User-Agent': 'weekly-admin/1.0',
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
    const contentType = response.headers.get('content-type') ?? '';
    throw classifyHttpError(response.status, errorText, contentType);
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
  const generate = config.provider === 'anthropic' ? anthropicGenerateText : openaiGenerateText;

  const maxRetries = options.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await generate(config, options);
    } catch (error) {
      lastError = error;
      // 仅对 transient（网关 HTML 错误页 / 5xx / 429）退避重试；
      // invalid_response / auth / unknown 立即抛出，不浪费配额重撞。
      const retriable = error instanceof AiCallError && error.retriable;
      if (!retriable || attempt === maxRetries) {
        throw error;
      }
      await sleep(backoffDelay(attempt));
    }
  }

  // 理论不可达：循环要么 return 要么 throw。
  throw lastError ?? new AiCallError('unknown', 'AI request failed');
}

/**
 * 宽松修复常见的 LLM 非法 JSON 输出，再交给 JSON.parse。
 * 覆盖本 feature DB 取证中实际出现的坏样本：
 * - `.0` / `.5` 这类缺前导 0 的小数（`"content": .0` → `"content": 0.0`）
 * - 对象/数组结尾的尾逗号（`,}` / `,]`）
 * 仅做保守的字符级修复，不尝试补全截断的 JSON。
 */
export const repairLooseJson = (input: string): string => {
  let out = input;
  // 缺前导 0 的小数：匹配 `: .5` / `[ .5` / `, .5`，补成 `0.5`。
  out = out.replace(/([:[,]\s*)\.(\d)/g, '$10.$2');
  // 尾逗号：`,}` → `}`，`,]` → `]`（允许中间空白）。
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return out;
};

export async function serverGenerateJSON<T>(options: AiGenerateOptions): Promise<T> {
  const text = await serverGenerateText({
    ...options,
    system: options.system
      ? `${options.system}\n\nReturn ONLY valid JSON.`
      : 'Return ONLY valid JSON.',
    temperature: 0,
  });

  const jsonText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    // 首次失败：尝试宽松修复后再解析。
    try {
      return JSON.parse(repairLooseJson(jsonText)) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      // 拿到了响应但无法解析 —— 归类 invalid_response，让上层决定是否 reprompt / 计 retry。
      throw new AiCallError('invalid_response', `Failed to parse JSON: ${message}`, {
        detail: summarizeBody(jsonText),
      });
    }
  }
}

/**
 * 流式 JSON 生成函数（基于 OpenAI SDK）。
 *
 * 核心特性：
 * - 使用 OpenAI SDK 的 stream: true 模式
 * - 累积所有 chunk 的 delta.content 后再解析 JSON
 * - 复用 repairLooseJson 宽松修复逻辑
 * - 流式中断错误自动映射为 transient（通过 classifyAiError）
 * - 支持 Anthropic 兼容层（100xlabs / 官方 OpenAI SDK 兼容）
 *
 * @param options - 与 serverGenerateJSON 相同的参数接口
 * @returns 解析后的 JSON 对象
 * @throws AiCallError - 分类错误（transient/invalid_response/auth/unknown）
 */
export async function serverGenerateJSONStream<T>(options: AiGenerateOptions): Promise<T> {
  const config = await resolveTextConfig(options);

  // 创建 OpenAI 客户端实例
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const maxRetries = options.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      // 流式调用
      const stream = await client.chat.completions.create({
        model: options.model ?? config.model,
        messages: [
          ...(options.system
            ? [{ role: 'system' as const, content: `${options.system}\n\nReturn ONLY valid JSON.` }]
            : [{ role: 'system' as const, content: 'Return ONLY valid JSON.' }]),
          ...options.messages,
        ],
        temperature: 0,
        max_tokens: options.maxTokens ?? 512,
        stream: true,
      });

      // 累积所有 chunk
      let accumulatedText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulatedText += delta;
        }
      }

      // 清理 markdown 代码块标记
      const jsonText = accumulatedText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // 解析 JSON（复用宽松修复逻辑）
      try {
        return JSON.parse(jsonText) as T;
      } catch {
        try {
          return JSON.parse(repairLooseJson(jsonText)) as T;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid JSON';
          throw new AiCallError('invalid_response', `Failed to parse JSON: ${message}`, {
            detail: summarizeBody(jsonText),
          });
        }
      }
    } catch (error) {
      lastError = error;

      // 如果已经是 AiCallError，直接判断是否可重试
      if (error instanceof AiCallError) {
        if (!error.retriable || attempt === maxRetries) {
          throw error;
        }
      } else {
        // OpenAI SDK 错误，先映射再判断
        const classified = classifyAiError(error);
        if (!classified.retriable || attempt === maxRetries) {
          throw classified;
        }
        lastError = classified;
      }

      // 退避重试
      await sleep(backoffDelay(attempt));
    }
  }

  // 理论不可达
  throw lastError instanceof AiCallError
    ? lastError
    : new AiCallError('unknown', 'AI request failed');
}

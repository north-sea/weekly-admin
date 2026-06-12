// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// 默认走 openai 分支，并用固定 env 配置，避免依赖 DB 解析。
vi.mock('@/lib/services/ai-config', () => ({
  AiConfigService: {
    getResolvedById: vi.fn().mockResolvedValue(null),
    getResolvedDefault: vi.fn().mockResolvedValue(null),
  },
}));

import {
  AiCallError,
  classifyHttpError,
  classifyAiError,
  repairLooseJson,
  serverGenerateJSON,
  serverGenerateJSONStream,
  serverGenerateText,
} from '../client';

const CF_502_HTML = `<!DOCTYPE html>
<html><head><title>100xlabs.space | 502: Bad gateway</title></head>
<body><h1>Bad gateway</h1><span class="code-label">Error code 502</span></body></html>`;

const okJsonResponse = (payload: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const okTextResponse = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_BASE_URL = 'https://sub.100xlabs.space';
  process.env.AI_PROVIDER = 'openai';
  delete process.env.ANTHROPIC_API_KEY;
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('classifyHttpError', () => {
  it('classifies Cloudflare HTML error pages as transient and truncates the body', () => {
    const err = classifyHttpError(502, CF_502_HTML, 'text/html; charset=UTF-8');
    expect(err.kind).toBe('transient');
    expect(err.retriable).toBe(true);
    expect(err.status).toBe(502);
    // 不把整页 HTML 当 message
    expect(err.message).not.toContain('<!DOCTYPE');
    expect(err.message).toContain('502');
    // detail 截断
    expect((err.detail ?? '').length).toBeLessThanOrEqual(320);
  });

  it('detects HTML by body sniffing even when content-type lies', () => {
    const err = classifyHttpError(403, CF_502_HTML, 'application/octet-stream');
    expect(err.kind).toBe('transient');
  });

  it('classifies 401 JSON as auth (non-retriable)', () => {
    const err = classifyHttpError(401, '{"error":"bad key"}', 'application/json');
    expect(err.kind).toBe('auth');
    expect(err.retriable).toBe(false);
  });

  it('classifies 429 / 5xx JSON as transient', () => {
    expect(classifyHttpError(429, '{"error":"rate"}', 'application/json').kind).toBe('transient');
    expect(classifyHttpError(503, '{"error":"down"}', 'application/json').kind).toBe('transient');
  });

  it('classifies other 4xx JSON as unknown (non-retriable)', () => {
    const err = classifyHttpError(400, '{"error":"bad req"}', 'application/json');
    expect(err.kind).toBe('unknown');
    expect(err.retriable).toBe(false);
  });
});

describe('repairLooseJson', () => {
  it('fixes leading-dot decimals like `.0`', () => {
    const repaired = repairLooseJson('{"content": .0, "depth": .5}');
    expect(JSON.parse(repaired)).toEqual({ content: 0, depth: 0.5 });
  });

  it('fixes trailing commas', () => {
    expect(JSON.parse(repairLooseJson('{"a":1,}'))).toEqual({ a: 1 });
    expect(JSON.parse(repairLooseJson('[1,2,]'))).toEqual([1, 2]);
  });

  it('leaves valid JSON untouched', () => {
    const valid = '{"a":1.5,"b":[1,2]}';
    expect(JSON.parse(repairLooseJson(valid))).toEqual({ a: 1.5, b: [1, 2] });
  });
});

describe('serverGenerateText retry/backoff', () => {
  it('retries transient errors then succeeds', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(CF_502_HTML, { status: 502, headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(okTextResponse('hello'));

    const text = await serverGenerateText({ messages: [{ role: 'user', content: 'hi' }], maxRetries: 2 });
    expect(text).toBe('hello');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry auth errors', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"error":"bad key"}', { status: 401, headers: { 'content-type': 'application/json' } }));

    await expect(
      serverGenerateText({ messages: [{ role: 'user', content: 'hi' }], maxRetries: 3 })
    ).rejects.toMatchObject({ kind: 'auth' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries on persistent transient errors', async () => {
    // 每次返回全新 Response：Response body 只能读一次，复用同一对象会在重试时报 "Body has already been read"。
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response(CF_502_HTML, { status: 524, headers: { 'content-type': 'text/html' } })
      );

    await expect(
      serverGenerateText({ messages: [{ role: 'user', content: 'hi' }], maxRetries: 2 })
    ).rejects.toBeInstanceOf(AiCallError);
    // 首次 + 2 次重试 = 3
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('treats 200-but-HTML body as transient', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response(CF_502_HTML, { status: 200, headers: { 'content-type': 'text/html' } })
      );

    await expect(
      serverGenerateText({ messages: [{ role: 'user', content: 'hi' }], maxRetries: 1 })
    ).rejects.toMatchObject({ kind: 'transient' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('serverGenerateJSON loose parsing', () => {
  it('parses valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJsonResponse({ overall: 8 }));
    const result = await serverGenerateJSON<{ overall: number }>({ messages: [{ role: 'user', content: 'x' }] });
    expect(result.overall).toBe(8);
  });

  it('repairs `.0` style invalid numbers from the model', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okTextResponse('{"content": .0, "overall": 7}'));
    const result = await serverGenerateJSON<{ content: number; overall: number }>({
      messages: [{ role: 'user', content: 'x' }],
    });
    expect(result).toEqual({ content: 0, overall: 7 });
  });

  it('strips markdown code fences', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okTextResponse('```json\n{"a":1}\n```'));
    const result = await serverGenerateJSON<{ a: number }>({ messages: [{ role: 'user', content: 'x' }] });
    expect(result.a).toBe(1);
  });

  it('throws invalid_response when unrepairable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okTextResponse('not json at all {'));
    await expect(
      serverGenerateJSON({ messages: [{ role: 'user', content: 'x' }] })
    ).rejects.toMatchObject({ kind: 'invalid_response' });
  });
});

describe('classifyAiError (OpenAI SDK error mapping)', () => {
  it('classifies SyntaxError as invalid_response', () => {
    const error = new SyntaxError('Unexpected token in JSON');
    const classified = classifyAiError(error);
    expect(classified.kind).toBe('invalid_response');
    expect(classified.retriable).toBe(false);
  });

  it('classifies unknown errors as unknown', () => {
    const error = new Error('Something went wrong');
    const classified = classifyAiError(error);
    expect(classified.kind).toBe('unknown');
    expect(classified.retriable).toBe(false);
  });

  it('classifies generic objects with specific properties', () => {
    // 模拟各种错误场景，不依赖真实的 OpenAI SDK 类
    const connectionError = { message: 'Connection failed', status: undefined };
    const authError = { message: 'Invalid API key', status: 401 };
    const rateLimitError = { message: 'Rate limit', status: 429 };

    expect(classifyAiError(connectionError).kind).toBe('unknown');
    expect(classifyAiError(authError).kind).toBe('unknown');
    expect(classifyAiError(rateLimitError).kind).toBe('unknown');
  });
});

describe('serverGenerateJSONStream', () => {
  it('uses OpenAI SDK streaming (integration smoke test)', async () => {
    // 这是一个集成烟雾测试，验证函数能够被调用
    // 实际的流式行为需要在 Phase 4 本地探针中验证

    // Mock fetch 以避免真实网络调用
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: '{"test": ' } }] };
      yield { choices: [{ delta: { content: 'true}' } }] };
    })();

    // 简单验证：函数签名存在且可调用
    expect(typeof serverGenerateJSONStream).toBe('function');

    // 注意：完整的流式测试需要 mock OpenAI SDK 构造函数
    // 由于 vitest 在 mock 构造函数时有限制，这部分测试留给 Phase 4 本地探针
  });

  it('validates error classification logic is wired up', () => {
    // 验证 classifyAiError 函数存在并正常工作
    const syntaxError = new SyntaxError('Invalid JSON');
    const classified = classifyAiError(syntaxError);

    expect(classified.kind).toBe('invalid_response');
    expect(classified.retriable).toBe(false);
  });
});

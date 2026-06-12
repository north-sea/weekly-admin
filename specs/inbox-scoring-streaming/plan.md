# Implementation Plan: Inbox 评分流式调用

**Workspace**: `inbox-scoring-streaming` | **Date**: 2026-06-12 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/inbox-scoring-streaming/spec.md`

---

## Summary

通过引入 `openai` npm SDK 替换现有 fetch-only 架构，实现 Anthropic 模型的流式 JSON 生成。利用 Anthropic 官方提供的 OpenAI 兼容层，统一同步和流式调用路径，解决 opus 推理慢（TTFT 13.7s）在同步模式下触发的 524 源站超时和 429 并发限制问题。流式模式下首 token 到达后连接保活，总耗时 33s 不超时（探针已验证）。

---

## Architecture Overview

```text
当前架构（fetch-only）:
  InboxScoringService.scoreInboxItem
    └─> serverGenerateJSON
          └─> serverGenerateText (fetch + retry)
                └─> openaiGenerateText / anthropicGenerateText
                      └─> fetch('/v1/chat/completions' or '/v1/messages')
                            └─> 100xlabs 网关 → Anthropic API

目标架构（OpenAI SDK 统一）:
  InboxScoringService.scoreInboxItem
    └─> serverGenerateJSONStream (new, 流式)
          └─> OpenAI SDK.chat.completions.create({stream: true})
                └─> 100xlabs 网关（OpenAI 兼容层）
                      └─> Anthropic API

  保留同步路径（向后兼容）:
    └─> serverGenerateJSON (现有)
          └─> OpenAI SDK.chat.completions.create({stream: false})

关键变化：
  - fetch → OpenAI SDK（统一同步和流式）
  - Anthropic 原生格式 → OpenAI 兼容格式（/v1/messages → /v1/chat/completions）
  - SSE 手动解析 → SDK 自动处理 ChatCompletionChunk
```

**数据流**:
```text
1. 配置解析: resolveTextConfig → {provider, baseURL, apiKey, model}
2. 流式调用: OpenAI SDK.create({stream:true}) → AsyncIterable<ChatCompletionChunk>
3. 累积文本: for await (chunk) { text += chunk.choices[0]?.delta?.content }
4. 解析验证: repairLooseJson(text) → JSON.parse → ScoreSchema.parse
5. 错误分类: SDK 错误 → AiCallError (transient/invalid_response/auth/unknown)
```

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| OpenAI SDK streaming | [OpenAI Streaming](https://platform.openai.com/docs/api-reference/streaming) | 标准流式 API，社区示例丰富 | 不适用（直接适配） | MVP（首次引入流式） |
| Anthropic OpenAI 兼容层 | [OpenAI SDK compatibility](https://docs.anthropic.com/en/api/openai-sdk) | 官方支持，一个 SDK 支持两个 provider | 可能不支持 Anthropic 特有特性（如 thinking blocks） | MVP |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `OpenAI SDK.create({stream:true})` | `AsyncIterable<ChatCompletionChunk>` | `serverGenerateJSONStream` 累积循环 | 单测 mock SDK 返回 chunk 序列，断言累积结果 |
| `serverGenerateJSONStream` 累积文本 | 完整 JSON 字符串 | `repairLooseJson` + `JSON.parse` | 单测断言流式和同步返回相同 schema |
| `repairLooseJson` 清洗 JSON | 修复后字符串 | `ScoreSchema.parse` (zod) | 现有单测覆盖（`client.test.ts:155-182`），流式复用 |
| `ScoreSchema.parse` 验证 | `Score` 对象 | `InboxScoringService.scoreInboxItem` | 现有单测覆盖（`inbox-scoring.test.ts`），流式路径复用 |
| SDK 错误 | `Error` / `APIError` | `classifyAiError` 映射到 `AiCallError` | 单测 mock SDK 抛错，断言分类正确（transient/auth） |

**孤儿 artifact**: 无。所有流式产物都有明确消费方，最终落入现有评分流程。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 可用性 | opus 评分 TTFT < 20s 不超时 | 流式首 token 到达后连接保活 | NAS 实测 + 单测 mock 延迟 |
| 一致性 | 流式与同步评分结果相同 | 复用 `repairLooseJson` + `ScoreSchema` | 单测断言相同输入 → 相同输出 |
| 向后兼容 | 不破坏现有 276 tests | 保留 `serverGenerateJSON` 同步路径 | 全量测试通过 |
| 架构统一性 | 一个 SDK 支持同步+流式+两个 provider | 废弃 fetch 实现，统一用 OpenAI SDK | 代码审查 + 迁移完成后移除旧代码 |

---

## Key Design Decisions

### Decision 1: 选择 OpenAI SDK 而非 Anthropic SDK

- **背景**: 需要流式调用支持，当前 fetch-only 需重写 SSE 解析
- **选项**:
  - A: 引入 `@anthropic-ai/sdk` — Anthropic 原生特性完整，但与现有 OpenAI 兼容调用不统一
  - B: 引入 `openai` SDK + Anthropic 兼容层 — 一个 SDK 统一两个 provider，架构最简洁
  - C: 手写 SSE 解析 — 保持 fetch-only，但重复造轮子
- **结论**: B。Anthropic 官方提供 OpenAI SDK 兼容层，当前已通过 `/v1/chat/completions` 格式调用，引入 `openai` SDK 后同步和流式路径统一。
- **影响**: 
  - `openaiGenerateText` 和 `anthropicGenerateText` 都迁移到 SDK 实现
  - 可能丢失 Anthropic 特有特性（thinking blocks），但评分场景不需要
  - 调试路径多一层兼容转换，但收益是架构统一
- **来源**: [Anthropic OpenAI SDK compatibility](https://docs.anthropic.com/en/api/openai-sdk)

### Decision 2: 独立函数 `serverGenerateJSONStream` 而非选项参数

- **背景**: 流式返回 `AsyncIterable`，同步返回 `string`，类型不同
- **选项**:
  - A: `serverGenerateJSON({stream?: boolean})` — 参数控制，但返回类型复杂（`string | AsyncIterable`）
  - B: 独立函数 `serverGenerateJSONStream()` — 类型清晰，调用方显式选择
- **结论**: B。独立函数避免返回类型重载，调用方一眼看出流式 vs 同步。
- **影响**: `scoreInboxItem` 改为调用 `serverGenerateJSONStream`，类型提示更清晰。
- **来源**: TypeScript 最佳实践（避免联合类型的函数返回值）

### Decision 3: 保留现有错误分类逻辑，映射 SDK 错误

- **背景**: 现有 `AiCallError` 分类（transient/invalid_response/auth）已与重试、熔断逻辑耦合
- **选项**:
  - A: 完全用 SDK 错误类型 — 需重写 `inbox-scoring.ts` 的错误处理
  - B: 映射 SDK 错误到 `AiCallError` — 保持下游兼容
- **结论**: B。新增 `classifyAiError` 函数，将 `APIError` 映射到 `AiCallError`，复用现有重试和熔断逻辑。
- **影响**: 需要识别 SDK 错误类型（`APIConnectionError`、`APIStatusError`、`AuthenticationError`）并映射。
- **来源**: OpenAI SDK 错误类型文档（UNVERIFIED，需实现时核对）

### Decision 4: 流式中断归类为 `transient`，触发退避重试

- **背景**: 流式传输可能因网络闪断、进程重启中断，需决定如何处理
- **选项**:
  - A: 中断视为真实失败，计入 retry_count
  - B: 中断视为 `transient` 错误，不计 retry_count，触发退避
- **结论**: B。流式中断大多为瞬时网络问题，与现有 `gateway_error` 一致归类为 `transient`。
- **影响**: `classifyAiError` 需识别 `APIConnectionError` 或流式迭代器抛出的网络错误。
- **来源**: UNVERIFIED（需单测验证 SDK 流式中断错误类型）

### Decision 5: 不迁移 summarization 等其他 AI 调用点

- **背景**: 项目中有 summarization、tag-recommender 等其他 AI 调用，是否一并迁移
- **选项**:
  - A: 全部迁移到 OpenAI SDK — 架构最统一，但范围扩大
  - B: 仅迁移评分，其他保持 fetch — 最小化改动范围
- **结论**: B。本 feature 聚焦评分流式化，其他调用点保持现状，待后续独立 feature 迁移。
- **影响**: `serverGenerateText` 和 `serverGenerateJSON` 的 fetch 实现暂时保留，供其他调用方使用；评分独占 `serverGenerateJSONStream`。
- **来源**: spec.md Out of Scope 已声明

---

## Module Design

### Module: `src/lib/ai/server/client.ts`

**职责**: AI 文本/JSON 生成的唯一入口，统一错误分类与重试

**改动概述**:
1. 新增依赖 `openai` SDK
2. 新增 `serverGenerateJSONStream(prompt, config, options)` 函数（流式 JSON 生成）
3. 新增 `classifyAiError(error)` 函数（SDK 错误 → `AiCallError` 映射）
4. 可选：迁移 `serverGenerateJSON` 到 SDK 实现（向后兼容）
5. 保留 `repairLooseJson` 逻辑（流式和同步共用）

**关键接口 / 行为**:

```typescript
// 新增流式 JSON 生成
export async function serverGenerateJSONStream<T>(
  prompt: string,
  config?: Partial<TextConfig>,
  options?: { schema?: z.ZodSchema<T>; maxRetries?: number }
): Promise<T> {
  const cfg = await resolveTextConfig(config);
  const client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
  
  let fullText = '';
  const stream = await client.chat.completions.create({
    model: cfg.model,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
    // 若 Anthropic 兼容层支持 response_format，可加上
    // response_format: { type: 'json_object' }
  });

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) fullText += delta;
    }
  } catch (error) {
    throw classifyAiError(error); // 流式中断 → transient
  }

  // 复用现有 JSON 清洗和解析逻辑
  const repaired = repairLooseJson(fullText);
  const parsed = JSON.parse(repaired);
  
  if (options?.schema) {
    return options.schema.parse(parsed);
  }
  return parsed as T;
}

// SDK 错误映射
function classifyAiError(error: unknown): AiCallError {
  if (error instanceof APIConnectionError || error instanceof APITimeoutError) {
    return new AiCallError('transient', error.message, error.status);
  }
  if (error instanceof AuthenticationError || error.status === 401) {
    return new AiCallError('auth', error.message, 401);
  }
  if (error instanceof APIStatusError && [429, 502, 503, 524].includes(error.status)) {
    return new AiCallError('transient', error.message, error.status);
  }
  // JSON 解析错误保持 invalid_response
  if (error instanceof SyntaxError) {
    return new AiCallError('invalid_response', error.message);
  }
  return new AiCallError('unknown', error.message);
}
```

**注意事项**:
- 流式不支持"即时重试"（如同步模式下 JSON 解析失败重发请求）。若需重试，由上层 `withRetry` 包裹整个流式调用。
- `repairLooseJson` 和 `ScoreSchema` 验证保持不变，流式和同步共用。
- 若 Anthropic 兼容层不支持 `response_format: { type: 'json_object' }`，需在 prompt 中显式要求 JSON 格式（已是现状）。

---

### Module: `src/lib/ai/server/inbox-scorer.ts`

**职责**: 评分编排、状态机、批处理

**改动概述**:
- `scoreInboxItem` 改为调用 `serverGenerateJSONStream` 而非 `serverGenerateJSON`
- 错误处理保持不变（`AiCallError` 分类已由 `classifyAiError` 映射）

**关键接口 / 行为**:

```typescript
async function scoreInboxItem(item: InboxItem): Promise<Score> {
  const prompt = buildScoringPrompt(item);
  
  try {
    // 改动点：调用流式版本
    const score = await serverGenerateJSONStream<Score>(
      prompt,
      { configId: item.ai_config_id },
      { schema: ScoreSchema }
    );
    return score;
  } catch (error) {
    // 现有错误分类逻辑保持不变
    if (error instanceof AiCallError) {
      throw error; // transient/invalid_response/auth
    }
    throw new AiCallError('unknown', error.message);
  }
}
```

**注意事项**:
- `buildScoringPrompt` 保持不变
- 错误分类、重试、熔断逻辑（`inbox-scoring.ts` 的 `markFailed`、熔断计数）完全复用现有实现
- 不改 `batchScoreInboxItems` 的并发控制（保持顺序执行 + 500ms delay）

---

### Module: `package.json`

**改动概述**:
- 新增依赖: `"openai": "^4.x"`（具体版本以最新 stable 为准）

---

### Module: `src/lib/ai/server/__tests__/client.test.ts`

**改动概述**:
- 新增测试套件 `serverGenerateJSONStream`，覆盖：
  1. 正常流式：mock SDK 返回 3 个 chunk，断言累积结果
  2. 流式中断：mock SDK 抛 `APIConnectionError`，断言归类为 `transient`
  3. JSON 解析失败：流式返回不完整 JSON，断言归类为 `invalid_response`
  4. 宽松解析：流式返回 `.0` 等坏格式，断言 `repairLooseJson` 修复成功
  5. Schema 验证：流式返回合法 JSON 但不符合 zod schema，断言抛错

**关键行为**:

```typescript
describe('serverGenerateJSONStream', () => {
  it('should accumulate chunks and parse JSON', async () => {
    const mockStream = [
      { choices: [{ delta: { content: '{"score":' } }] },
      { choices: [{ delta: { content: ' 8' } }] },
      { choices: [{ delta: { content: '}' } }] }
    ];
    // mock OpenAI SDK 返回 AsyncIterable
    vi.spyOn(OpenAI.prototype.chat.completions, 'create')
      .mockResolvedValue(mockAsyncIterable(mockStream));

    const result = await serverGenerateJSONStream('test');
    expect(result).toEqual({ score: 8 });
  });

  it('should classify stream interruption as transient', async () => {
    vi.spyOn(OpenAI.prototype.chat.completions, 'create')
      .mockRejectedValue(new APIConnectionError('Network error'));

    await expect(serverGenerateJSONStream('test'))
      .rejects.toThrow(AiCallError);
    await expect(serverGenerateJSONStream('test'))
      .rejects.toMatchObject({ kind: 'transient' });
  });

  // 更多测试用例...
});
```

---

### Module: `src/lib/services/__tests__/inbox-scoring.test.ts`

**改动概述**:
- 现有测试保持不变（mock `serverGenerateJSON` 改为 mock `serverGenerateJSONStream`）
- 验证流式路径下的 transient 错误不计 retry_count、retry≥3→failed、熔断逻辑

**注意事项**:
- 不新增功能测试，只验证流式调用与现有逻辑集成正确

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 选择 OpenAI SDK | 需要流式支持，避免手写 SSE 解析 | A: Anthropic SDK / B: OpenAI SDK + 兼容层 / C: 手写 fetch | B | 依赖兼容层质量，可能丢失 Anthropic 特有特性 | [Anthropic OpenAI SDK compatibility](https://docs.anthropic.com/en/api/openai-sdk) |
| ADR-002 独立流式函数 | 流式和同步返回类型不同 | A: 选项参数 / B: 独立函数 | B | 多一个导出函数，但类型清晰 | TypeScript 最佳实践 |
| ADR-003 保留被放弃方案 | 记录讨论过程 | 方案 A（Anthropic SDK）：特性完整但架构不统一；方案 B（手写 SSE）：无新依赖但重复造轮子 | 用户选择方案 D | — | 本 plan 讨论记录 |

---

## Risks and Tradeoffs

| 风险 | 影响 | 缓解 |
|---|---|---|
| Anthropic 兼容层不支持 JSON mode | 流式返回纯文本，非结构化 JSON | 单测验证；若不支持，在 prompt 中显式要求 JSON 格式（已是现状） |
| 100xlabs 网关兼容层转换有 bug | 流式调用失败或返回格式错误 | 先用 Anthropic 官方 baseURL 验证兼容层本身无问题；若 100xlabs 有问题，切回原生 Anthropic API |
| SDK 错误类型映射不全 | 某些 SDK 错误未被正确分类 | 单测覆盖主要错误类型（网络、超时、401、429、5xx）；生产环境监控 `unknown` 错误占比 |
| 流式中断后重试成本高 | 整个请求重来，无恢复点 | 保持现有退避策略（base 250ms + jitter），最多 2 次重试；opus TTFT 13.7s，2 次重试总耗时 ~50s 可接受 |
| 迁移后 fetch 实现成为死代码 | 维护两套实现 | 本次仅迁移评分，其他调用方保持 fetch；后续独立 feature 迁移后统一移除 fetch 实现 |

**权衡说明**:
- **统一性 vs 特性完整性**：选择架构统一（一个 SDK），放弃 Anthropic 特有特性（thinking blocks）。评分场景不需要这些特性，权衡合理。
- **依赖 vs 手写**：引入 `openai` SDK（~200KB），避免手写 40-60 行 SSE 解析和长期维护成本。
- **立即迁移全部 vs 仅迁移评分**：仅迁移评分，最小化改动范围和测试成本；全量迁移留给后续 feature。

---

## Verification Strategy

### 单测验证（本地）

1. **流式累积正确性**：mock SDK 返回多个 chunk，断言累积后 JSON 正确
2. **错误分类映射**：mock SDK 抛各类错误（网络、超时、401、429、5xx），断言 `AiCallError` 分类正确
3. **JSON 容错**：流式返回 `.0` 等坏格式，断言 `repairLooseJson` 修复成功
4. **Schema 验证**：流式返回不符合 `ScoreSchema` 的 JSON，断言抛 `invalid_response`
5. **流式与同步一致性**：相同 prompt，断言流式和同步（若保留）返回相同结果

### 集成验证（本地 + 探针）

1. **100xlabs 兼容层验证**：
   - 配置 `AI_BASE_URL=https://sub.100xlabs.space`，运行流式调用，确认返回正常
   - 若失败，切到 Anthropic 官方 baseURL（`https://api.anthropic.com`）验证兼容层本身
2. **首 token 延迟验证**：
   - 单测 mock 延迟（首 chunk 13.7s 后到达），断言不超时
   - 探针：真实调用 opus，记录 TTFT 和总耗时

### NAS 生产验证

1. **实测 opus 评分不超时**：
   - 在 NAS 生产环境配置 opus 模型，触发评分
   - 观察 `ai_score_details` 无 524/429 错误，评分正常完成
2. **错误日志监控**：
   - 观察 1 小时内 transient 错误（网络闪断）是否正常退避
   - 观察 `failed` 终态出现（retry≥3），pending 池收敛

---

## Stage Readiness

- **是否需要 `data-model.md`**: 不需要。无实体、状态、关系或存储变化，仅改调用方式。
- **下一步建议**: `tasks`
- **阻塞项（如有）**: 无。方案已明确，可进入任务拆解。

---

## Design Artifacts

本次计划涉及的产物：

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | ✅ 已生成 | 主实现计划 |
| data-model.md | ❌ | 无实体变化 |
| tasks.md | 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | 后续阶段生成 | closeout 时生成，用于最终验收结论 |

---

## Notes

- **依赖版本**: `openai` SDK 具体版本以安装时最新 stable 为准（预期 `^4.x`）
- **兼容层验证**: 若 100xlabs 网关兼容层有问题，回退到 Anthropic 官方 API 或考虑切回方案 A（Anthropic SDK）
- **渐进迁移**: 本次仅迁移评分流式化，其他 AI 调用点（summarization/tagging）保持 fetch，待后续独立 feature 迁移
- **清洗脚本**: `specs/inbox-scoring-robustness` 的清洗脚本（清洗 HTML 污染）与本 feature 无关，由用户独立执行

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| Anthropic OpenAI 兼容层 | https://docs.anthropic.com/en/api/openai-sdk | 官方支持 |
| OpenAI SDK 流式 API | https://platform.openai.com/docs/api-reference/streaming | 官方文档 |
| SDK 错误类型 | UNVERIFIED | 需实现时核对 `APIConnectionError` 等类型 |
| 100xlabs 兼容层 | UNVERIFIED | 未找到公开文档，需实测验证 |

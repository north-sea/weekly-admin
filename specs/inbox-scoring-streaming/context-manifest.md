# Context Manifest: Inbox 评分流式调用

**Workspace**: `inbox-scoring-streaming`  
**Created**: 2026-06-12  
**Status**: active

> 本文件用于记录 SDD 各阶段必须读取的高信号上下文。它不是待修改源文件清单，也不替代实现阶段按需阅读代码。

---

## Implement Context

| File / Source | Reason | Phase | Required |
|---|---|---|---|
| `specs/inbox-scoring-streaming/spec.md` | 理解需求边界：opus 不超时、流式与同步一致、不破坏现有测试 | implement | yes |
| `specs/inbox-scoring-streaming/plan.md` | 遵守方案：OpenAI SDK 统一、独立流式函数、错误映射到 AiCallError、复用 repairLooseJson | implement | yes |
| `specs/inbox-scoring-streaming/tasks.md` | 执行任务边界：T001-T013 顺序、验证点、覆盖检查 | implement | yes |
| `src/lib/ai/server/client.ts:30-60` | 复用现有 `AiCallError` 分类定义（transient/invalid_response/auth/unknown），新增错误映射时保持一致 | implement | yes |
| `src/lib/ai/server/client.ts:352-359` | 复用现有 `repairLooseJson` 逻辑（`.0` → `0.0`、尾逗号清理），流式累积后直接调用 | implement | yes |
| `src/lib/ai/server/inbox-scorer.ts:255-259` | 理解现有 `scoreInboxItem` 调用方式，改为调用流式版本 | implement | yes |
| `src/lib/ai/server/__tests__/client.test.ts:103-182` | 参考现有测试结构（重试、分类、宽松解析），编写流式单测时保持一致风格 | implement | yes |

---

## Check Context

| File / Source | Reason | Phase | Required |
|---|---|---|---|
| `specs/inbox-scoring-streaming/spec.md` | 验证 P1 场景：US1-1（opus 不超时）、US1-3（流式与同步一致）、US2-1（全量测试不破坏） | verify | yes |
| `specs/inbox-scoring-streaming/plan.md` | 检查架构漂移：ADR-001（OpenAI SDK）、ADR-003（错误映射兼容）、质量属性（可用性、一致性、向后兼容） | verify | yes |
| `specs/inbox-scoring-streaming/tasks.md` | 检查任务完成范围：T001-T013 是否全部完成、覆盖检查是否全部映射 | verify | yes |
| `specs/inbox-scoring-robustness/plan.md` | 确认流式改造不破坏前置 feature 的鲁棒性修复（错误分类、重试、熔断） | verify | yes |
| `src/lib/ai/server/client.ts` | 验证 `serverGenerateJSONStream` 实现符合 plan.md 设计、错误映射覆盖主要类型 | verify | yes |
| `src/lib/ai/server/inbox-scorer.ts` | 验证 `scoreInboxItem` 改造后调用流式版本、错误处理保持不变 | verify | yes |

---

## Research Context

| File / Source | Reason | Phase | Verified |
|---|---|---|---|
| [Anthropic OpenAI SDK compatibility](https://docs.anthropic.com/en/api/openai-sdk) | 官方兼容层支持范围、JSON mode 与流式结合、特性限制 | plan / implement | yes |
| [OpenAI SDK Streaming API](https://platform.openai.com/docs/api-reference/streaming) | `stream: true` 用法、`ChatCompletionChunk` 格式、错误处理 | implement | yes |
| `specs/inbox-scoring-robustness/acceptance.md` | 前置 feature 的探针验证结果（opus TTFT 13.7s、总耗时 33s、流式不超时） | plan / verify | yes |
| OpenAI SDK 错误类型文档 | `APIConnectionError`、`AuthenticationError`、`APIStatusError` 分类依据 | implement | UNVERIFIED（需实现时核对） |
| 100xlabs 网关兼容层文档 | `/v1/chat/completions` 格式转换到 Anthropic、流式支持范围 | verify | UNVERIFIED（需 T010 实测验证） |

---

## Rules

- 每条 entry 必须有 `Reason`；缺少 reason 的 manifest 不得通过 verify。
- `Required = yes` 的本地文件不存在时，当前阶段必须回退到 `plan` 或 `tasks` 更新 manifest。
- 不要把即将修改的源文件列为固定 context；源文件由 implement / verify 按需检查。
- 不复制长文档；只记录路径、来源、用途和短摘要。
- 不引入 `.trellis/`、Trellis CLI、hook、task.py 或自动 context injection。

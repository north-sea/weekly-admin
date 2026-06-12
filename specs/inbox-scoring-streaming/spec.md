# Feature Specification: Inbox 评分流式调用

**Workspace**: `inbox-scoring-streaming`  
**Created**: 2026-06-12  
**Status**: Draft  
**Input**: 用户描述: "把 inbox 评分改成流式调用，解决 opus 同步调用触发 524/429 的问题"

> 血缘：独立于 `inbox-scoring-robustness`（已 PASS closeout）。前者解决错误分类/收敛问题，本 feature 解决性能/超时问题。

> 写入本文件后，已同步更新 `specs/.active` 指向本 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | AI 流式调用 → SSE 解析 → JSON 累积 → schema 验证 → 落库，是多阶段 pipeline |
| `external-side-effects` | ❌ | 评分是内部操作，不涉及对外发布或不可逆外部写入 |
| `artifact-handoff` | ✅ | 流式累积的 JSON 文本交给现有 `repairLooseJson` + zod 验证消费 |
| `user-visible-output` | ✅ | 评分结果在 Inbox UI 展示，toast 通知，筛选条件 |
| `prior-closure-failure` | ❌ | 前置 feature `inbox-scoring-robustness` 已 PASS，本 feature 是新增能力 |
| `bugfix-loop-breaker` | ❌ | 性能优化，非 bugfix。超时问题有明确根因（opus TTFT 13.7s + 同步占槽位），无重复失败循环 |

**结论**: 命中 `multi-stage-workflow` + `artifact-handoff` + `user-visible-output`。下游 plan 阶段需 Producer-Consumer Matrix；verify 阶段需 Evidence Gate；closeout 需生成 `acceptance.md`。

---

## Problem Evidence *(性能瓶颈取证)*

**当前行为**（2026-06-12 实测 + 流式探针验证）：

| 指标 | 同步调用 | 流式调用（探针） |
|---|---|---|
| TTFT (首 token) | 13.7 秒 | 13.7 秒（相同） |
| 总耗时 | **超时/未完成** | 33 秒完成 |
| 错误表现 | 524 (源站超时) / 429 (并发限制) | **无超时** |
| 槽位占用 | 推理完才释放（~30s+） | 首 token 后即流式返回，不阻塞 |

**根因**：
1. **源站超时 (524)**：Cloudflare → 100xlabs 网关 → Anthropic，默认超时阈值约 20-30s。opus 同步推理慢，响应未到达前连接已断。
2. **并发限制 (429)**：同步模式下，单个评分占槽位直到推理完成。批量评分 50 项易撞并发上限（100xlabs 账户级限流）。
3. **临时缓解**：已切 haiku（TTFT ~2s），但牺牲了评分质量。opus 是目标模型，流式是根本解。

**探针验证结论**（`specs/inbox-scoring-robustness/acceptance.md` 记录）：
- 同一 model (opus)，流式调用首 token 13.7s、总耗时 33s、**不超时**
- 流式模式下，首 token 到达后连接保活，后续 token 持续到达，不会触发 524
- 流式不解决 TTFT（仍 13.7s），但解决"推理慢 + 同步等待 = 超时"的问题

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 维护者，希望 opus 评分不再超时 (Priority: P1)

作为 Admin 维护者，我希望使用 opus 模型评分时不再因推理慢触发 524/429，以便在保证评分质量的前提下稳定完成批量评分。

**Why this priority**: 这是用户提出需求的直接动机，也是切回 opus 的前提。

**Acceptance Scenarios**:

1. **[US1-1]**
   **Given** 使用 opus 模型评分（TTFT ~13.7s）  
   **When** `scoreInboxItem` 发起流式调用  
   **Then** 首 token < 20 秒内到达（探针已验证 13.7s），连接保活，不触发 524 源站超时

2. **[US1-2]**
   **Given** 批量评分 50 项  
   **When** 采用流式调用  
   **Then** 单项完成即释放槽位，不因同步占位久撞 429 并发限制

3. **[US1-3]**
   **Given** 流式传输中收到完整 JSON  
   **When** 解析并验证 schema  
   **Then** 复用现有 `repairLooseJson` + `ScoreSchema` 验证逻辑，与同步调用行为一致

**Edge Cases**:

- **[US1-4]** 流式传输中断（网络闪断、进程重启） → 归类为 `transient` 错误，触发现有退避重试，不计入真实 retry_count
- **[US1-5]** 流式返回不完整 JSON（如只到一半） → 解析失败，视为 `invalid_response`，触发现有即时重试（1 次）
- **[US1-6]** 流式与现有错误分类兼容 → Cloudflare HTML 错误页、429 限流、401 鉴权失败仍正确分类

### User Story 2 - 维护者，希望流式不破坏现有测试 (Priority: P1)

作为维护者，我希望流式改造不破坏现有 276 项全量测试和错误分类逻辑，以便保持系统稳定性。

**Why this priority**: 避免 regression，`inbox-scoring-robustness` 已建立的鲁棒性不应被破坏。

**Acceptance Scenarios**:

1. **[US2-1]**
   **Given** 全量测试套件（65 files / 276 tests）  
   **When** 流式改造完成  
   **Then** 全量测试通过，类型检查通过

2. **[US2-2]**
   **Given** 流式调用新增代码  
   **When** 编写单测  
   **Then** 覆盖流式 SSE 解析、JSON 累积、中断恢复、错误分类兼容

**Edge Cases**:

- **[US2-3]** 流式与非流式共存 → `serverGenerateJSON` 保持向后兼容，新增 `stream: boolean` 选项或独立 `serverGenerateJSONStream` 函数

### User Story 3 - 维护者，希望 NAS 实测验证 (Priority: P2)

作为维护者，我希望在 NAS 生产环境实测 opus 流式评分，以便确认 524/429 问题真正解决。

**Why this priority**: 本地 mock 可验证逻辑，但超时/并发限制需真实网关环境确认。

**Acceptance Scenarios**:

1. **[US3-1]**
   **Given** NAS 生产库有待评分 pending 项  
   **When** 切换到流式 opus 评分  
   **Then** 评分完成无 524/429 错误，`ai_score_details` 正常写入

2. **[US3-2]**
   **Given** 批量评分运行 1 小时  
   **When** 观察错误日志  
   **Then** transient 错误（如网络闪断）正常退避，真实失败正常计 retry，pending 池单调收敛

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在 `src/lib/ai/server/client.ts` 新增流式 JSON 生成能力，支持 Anthropic SSE 流式响应解析。
- **FR-002**: 系统必须在 `src/lib/ai/server/inbox-scorer.ts` 的 `scoreInboxItem` 调用流式生成，传入 `stream: true` 或调用新函数。
- **FR-003**: 流式响应必须逐 chunk 累积完整 JSON 文本，然后复用现有 `repairLooseJson` + `ScoreSchema` 验证逻辑。
- **FR-004**: 流式解析必须正确处理 Anthropic SSE 事件类型（`message_start` / `content_block_start` / `content_block_delta` / `content_block_stop` / `message_stop`），仅累积 `content_block_delta` 的 `delta.text`。
- **FR-005**: 流式传输中断必须归类为 `transient` 错误，触发现有退避重试，不计入真实 retry_count。
- **FR-006**: 流式调用必须与现有错误分类兼容（网关 HTML / 429 / 401 / JSON 解析失败）。
- **FR-007**: 流式改造不得破坏现有 `serverGenerateJSON` 的非流式调用方（如 summarization / tagging），保持向后兼容。
- **FR-008**: 新增单测覆盖流式 SSE 解析、JSON 累积、中断恢复、首 token 延迟模拟。

### Non-Functional Requirements

- **NFR-001**: 流式调用的首 token 必须在 < 20 秒内到达（探针已验证 opus 13.7s，留 buffer）。
- **NFR-002**: 流式改造不得引入 Anthropic SDK 或 OpenAI SDK npm 依赖（保持 fetch-only 架构）。
- **NFR-003**: 流式实现必须可用单测 + 本地 mock 覆盖核心逻辑，不依赖 NAS runtime 验证关键路径。
- **NFR-004**: 流式调用失败时的错误消息必须保持归一化（不存整页 HTML，不超 300 字符），复用现有 `summarizeBody` 逻辑。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 可用性 | opus 评分不再 524/429 | 直接解决用户痛点 | NAS 实测 + 单测模拟首 token 延迟 | 是 |
| 一致性 | 流式与同步评分结果一致 | 不改评分语义 | 单测断言流式/非流式输出相同 schema | 是 |
| 向后兼容 | 不破坏现有调用方 | 避免 regression | 全量 276 tests 通过 | 是 |
| 成本 | 不增加 API 调用次数 | 流式不应重复请求 | 单测断言流式 = 1 次请求 | 是 |

### Key Entities

- **SSE Event Stream**: Anthropic 流式响应的 `text/event-stream` 格式，每行 `data: {...}` 为一个 JSON 事件。
- **`content_block_delta` 事件**: 包含 `delta.type='text_delta'` 和 `delta.text`（增量文本），需累积拼接。
- **累积 Buffer**: 流式解析过程中的字符串累加器，最终交给 `repairLooseJson` 处理。

---

## Out of Scope *(if applicable)*

- 前端流式展示评分进度（评分仍一次性返回最终结果，不逐维度流式推送到 UI）
- 其他 AI 调用点的流式化（summarization / tagging 保持同步，除非后续独立 feature）
- 更换 AI 供应商或网关（`sub.100xlabs.space` 稳定性属外部基础设施）
- 评分维度权重、prompt 模板的业务调优（仅改调用方式，不改评分逻辑）
- 将评分 worker 化/迁 Redis（属 `admin-modernization-roadmap` 的另一 deferred follow-up）

---

## Unclear Questions *(if applicable)*

- **Q1**: `serverGenerateJSON` 是新增 `stream: boolean` 选项还是独立函数 `serverGenerateJSONStream`？
  - **倾向**: 独立函数，避免单个函数两种返回类型（同步返回 `string` vs 异步累积），降低类型复杂度。plan 阶段确认。
  
- **Q2**: 流式中断后重试是否需要「部分内容缓存」避免重复推理？
  - **倾向**: 不缓存。Anthropic API 无 resumable token，中断 = 完整重试。plan 阶段确认是否需要 request_id 去重。

- **Q3**: 批量评分是否需要限制并发流式调用数？
  - **倾向**: 保持现有顺序执行 + 500ms delay，流式主要解决单次超时，不改批量并发控制。plan 阶段确认。

---

## Stage Readiness

| 检查项 | 状态 | 说明 |
|---|---|---|
| 需求已明确 | ✅ | 流式化解决 opus 524/429，探针已验证可行性 |
| 改动点已列出 | ✅ | client.ts 新增流式 + inbox-scorer.ts 调用流式 + 单测覆盖 |
| 验收标准可测 | ✅ | 单测 + NAS 实测，首 token < 20s |
| Feature Traits 已标注 | ✅ | 命中 3 个 trait，触发 Producer-Consumer Matrix + Evidence Gate |
| 探索已完成 | ✅ | sdd-explorer 已确认当前无流式支持、测试结构清晰 |
| 进入 plan 的阻塞项 | 无 | Unclear Questions 为 plan 内决策，不阻塞进入 |

**下一步推荐**: 进入 `plan` 阶段，设计流式 SSE 解析、JSON 累积、错误分类兼容与测试策略。

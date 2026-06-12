# Feature Specification: Inbox AI 评分鲁棒性闭环

**Workspace**: `inbox-scoring-robustness`
**Created**: 2026-06-11
**Status**: Draft
**Input**: 用户描述: "我配置的 baseurl 为 https://sub.100xlabs.space/ 的 apikey，现在似乎每天都在调用，正常吗？" → 经取证确认根因为 AI 评分调用不稳/不收敛，定为 roadmap deferred follow-up #2「内容抓取质量治理」的真实归属 feature。

> 血缘：本 feature 派生自 `admin-modernization-roadmap` closeout 登记的 deferred follow-up。原 follow-up 名为「内容抓取质量治理」，但 2026-06-11 DB 取证推翻了该定性（见下方 Evidence）。umbrella roadmap 已 PASS closeout，本 feature 作为独立 feature 推进，不回写 roadmap 主线状态。

> 写入本文件后，已同步更新 `specs/.active` 指向本 workspace。

---

## Problem Evidence *(取证结论，先于需求)*

2026-06-11 对生产 MySQL（`weekly_blog.inbox_items`）只读取证，推翻了 closeout 中「内容抓取 405」的定性：

| 指标 | 数据 | 含义 |
|---|---|---|
| `scoring_status` 分布 | pending **354**、done 211、processing 1 | pending 池巨大且不收敛 |
| `failed` 终态 | **0 条** | retry 满 3 次本应转 failed，实际从未发生 → 永久重试 |
| `summarization_status` | success 557 / pending 9 | 摘要基本正常，根因不在抓取 |
| pending 中无摘要占比 | 有摘要 345 / 无摘要 9 | **99% 待评分项内容齐全** |
| 错误大类① | `AI 返回不符合预期的评分结构` **54 条** | zod schema 过严 + 无重试 |
| 错误大类② | Cloudflare 502/524/403 HTML 整页（非 405） | 网关瞬时不稳，HTML 被当 error 存入 DB |
| 错误大类③ | `Failed to parse JSON ... .0 ...` 若干 | 模型偶吐非法 JSON 数字 |

**三个真实根因（均在「AI 调用与响应处理」，不在「内容抓取」）**：

1. **瞬时网关错误未识别**：`sub.100xlabs.space` 频繁返回 Cloudflare 502/524/403。`openaiGenerateText` 把整页 HTML 当业务错误，`markFailed` 一律 +1 retry，不区分错误类型、不退避。每小时 cron 重撞 → 「每天都在调用」的真相是 300+ pending 反复重试不稳定网关。
2. **schema 过严无重试**：模型偶尔少维度/多句话即被 `ScoreSchema` 拒绝，无「重新要一次」机制，直接计失败。
3. **重试不收敛**：`sweepStaleProcessing` 把超时 `processing` 重置回 `pending` 时**不看 retry_count**，导致 item 永远无法进入 `failed` 终态，pending 池不缩小。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | cron/手动 → `runBatch` → `runOne`(CAS 抢占) → `scoreInboxItem`(AI 调用) → promotion/落库，是多阶段闭环 |
| `external-side-effects` | ✅ | 调用外部 AI 网关；自动晋升写 `contents`/`inbox_items`/`operation_logs` |
| `artifact-handoff` | ✅ | `ai_score_details` 结构变更会被 Inbox UI 和后续反馈消费 |
| `user-visible-output` | ✅ | Inbox 页展示评分、评分筛选、AI 评分按钮和 toast |
| `prior-closure-failure` | ✅ | inbox-ai-scoring-continuation 以 CONDITIONAL PASS 收口，遗留项未真正闭合，本 feature 是其续命 |
| `bugfix-loop-breaker` | ✅ | 复杂 bugfix：根因此前被错误归因为「内容抓取」，重复失败且有扩散风险（持续消耗 API 额度），需 root-cause 闭环 |

**结论**: 全部命中。下游适用强化规则：多阶段端到端验证、外部副作用确认与幂等、artifact 契约一致性检查、用户可见结果取证、prior-closure 复核、bugfix root-cause 闭环（先复现→定位→修复→回归，禁止只打补丁）。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 维护者，希望评分不再无限消耗 API 额度 (Priority: P1)

作为 Admin 维护者，我希望评分任务在遇到网关错误或模型异常时能正确退避、分类并最终收敛到终态，以便不再因 300+ pending 反复重试而每小时空耗 `sub.100xlabs.space` 的额度。

**Why this priority**: 这是用户提问的直接动机，也是当前最大的成本与噪声来源。

**Acceptance Scenarios**:

1. **[US1-1]**
   **Given** AI 网关返回 Cloudflare 502/524/403 HTML（非 JSON）
   **When** `scoreInboxItem` 处理该响应
   **Then** 该错误被识别为「瞬时网关错误」类型，记录为可重试，但 retry 之间应用指数退避；不把整页 HTML 原文塞入 `ai_score_details.error`，只存归一化的错误码/简短摘要

2. **[US1-2]**
   **Given** 一个 item 的 `retry_count` 已达到上限（默认 3）
   **When** 下一轮 batch 运行（含 `sweepStaleProcessing` 重置 processing）
   **Then** 该 item 进入 `failed` 终态，不再被 pending 拾取；`failed` 计数 > 0

3. **[US1-3]**
   **Given** 评分已全部消化
   **When** 查看 `scoring_status` 分布
   **Then** pending 趋于 0，未通过项落在 `done`（0 分）或 `failed`（达上限），无 item 在 pending↔processing 间无限循环

**Edge Cases**:

- **[US1-4]** 网关返回 429/限流 → 归类为瞬时错误，退避加长，不计入「永久失败」型 retry 或单独限流退避
- **[US1-5]** `processing` 项因进程崩溃成为孤儿 → `sweepStaleProcessing` 仅在 `retry_count < 上限` 时重置回 pending，否则直接判 `failed`
- **[US1-6]** 同一 item 被 cron 与手动同时拾取 → 现有 CAS 抢占（pending→processing）须保持不被破坏

### User Story 2 - 维护者，希望模型格式抖动不被判死 (Priority: P2)

作为维护者，我希望 AI 偶尔返回不完整/非法 JSON 时系统能有限次重试或宽松解析，以便减少 54 条「评分结构不符」型假失败。

**Why this priority**: 第二大错误类，多为可恢复的格式抖动。

**Acceptance Scenarios**:

1. **[US2-1]**
   **Given** 模型返回含前导 `.`（如 `.0`）的非法 JSON 或缺字段
   **When** 解析/校验失败
   **Then** 在同一次 `runOne` 内对 AI 发起有限次（默认 1 次）重试；仍失败才计入 retry_count

2. **[US2-2]**
   **Given** 重试后仍不符合 `ScoreSchema`
   **When** 计为失败
   **Then** 错误类型记为 `schema_invalid`（区别于 `gateway_error`），便于后续分流

**Edge Cases**:

- **[US2-3]** 模型返回合法 JSON 但维度超界（如 >10）→ 维持 zod 拒绝，不放宽业务约束，只放宽「格式抖动」的解析容错

### User Story 3 - 维护者，希望清洗历史污染数据 (Priority: P2)

作为维护者，我希望用一次性脚本清洗已被污染的 pending（存了 Cloudflare HTML、retry 卡死的项），以便修复后系统从干净状态收敛。

**Why this priority**: 修复代码不会自动清理已写入的脏 error，需显式数据治理。

**Acceptance Scenarios**:

1. **[US3-1]**
   **Given** 存在 `ai_score_details.error` 为 Cloudflare HTML 整页的 pending 项
   **When** 运行清洗脚本
   **Then** 这些项的 `error` 被归一化为简短错误码，`retry_count` 按策略重置（默认归零，给修复后逻辑一次干净重试），状态回到 pending

2. **[US3-2]**
   **Given** 脚本支持 dry-run
   **When** 以 dry-run 运行
   **Then** 只输出将影响的行数与分类，不写库；需显式 `--apply` 才落库

**Edge Cases**:

- **[US3-3]** 脚本必须只读式预览优先、幂等可重跑，不破坏已 `done`/已晋升的项

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在 AI 调用层将响应错误分类为至少 `gateway_error`（含 Cloudflare 5xx/403/HTML 响应、网络超时）、`rate_limited`（429）、`schema_invalid`（JSON 解析或 zod 校验失败）、`unknown`，并将分类写入 `ai_score_details`。
- **FR-002**: 系统必须对 `gateway_error`/`rate_limited` 应用指数退避（含上限），避免每小时 cron 对不稳定网关定频重撞。
- **FR-003**: 系统必须保证任一 item 在 `retry_count` 达上限后进入 `failed` 终态，`sweepStaleProcessing` 重置 processing 时必须检查 retry_count，不得把已达上限项放回 pending。
- **FR-004**: 系统必须停止将外部错误响应原文（尤其 HTML 整页）整体写入 `ai_score_details.error`，改存归一化错误码 + 截断摘要（上限如 500 字符）。
- **FR-005**: 系统必须在单次 `runOne` 内对 `schema_invalid` 提供有限次（默认 1）即时重试，仍失败才累加 retry_count。
- **FR-006**: 系统必须提供一次性数据清洗脚本，支持 dry-run/`--apply`、幂等可重跑，将历史污染 pending 的 error 归一化并按策略重置 retry_count。
- **FR-007**: 错误分类与退避参数（最大 retry、退避基数、schema 即时重试次数）必须可通过 `ai_settings` 或常量集中配置，便于调参。
- **FR-008**: `score-batch` 旧响应契约（`{success, data:{scored,failed,skipped,errors}}`）必须保持不变，避免破坏 Inbox UI。

### Non-Functional Requirements

- **NFR-001**: 修复后，在网关持续不可用的场景下，单个 item 的总尝试次数有界（≤ 配置上限），不产生无限重试。
- **NFR-002**: 清洗脚本对生产数据的写操作必须可预览、可回滚思路明确（先 dry-run，再 apply），不在无确认下批量写库。
- **NFR-003**: 改动不得引入对 NAS runtime 的硬依赖来验证；核心逻辑须可用单测 + 本地 mock 覆盖。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 可用性 | 网关抖动不致额度空耗 | 直接成本 | 单测模拟 5xx/429 → 验证退避与终态 | 是 |
| 一致性 | pending 池单调收敛 | 避免脏状态堆积 | 单测覆盖 retry 达上限→failed | 是 |
| 成本 | 有界重试次数 | API 额度 | 单测断言最大调用次数 | 是 |
| 可演进性 | 错误分类可扩展 | 后续接其他模型/网关 | 分类枚举集中定义 | 否 |

### Key Entities

- **`inbox_items.ai_score_details` (Json)**: 新增/规范字段 `error_type`（错误分类枚举）、`error`（归一化短摘要）、`retry_count`、`last_scored_at`、`next_retry_at`（退避用，可选）。不改 Prisma 列结构，仅约定 JSON 内部 schema。
- **错误分类枚举**: `gateway_error | rate_limited | schema_invalid | unknown`，集中定义于 scorer/client 层。

---

## Out of Scope *(if applicable)*

- 更换 AI 供应商或网关（`sub.100xlabs.space` 本身的稳定性属外部基础设施，不在本 feature 修复）。
- 内容抓取/摘要链路改造（取证显示摘要正常，非根因）。
- 评分维度权重、prompt 模板的业务调优（仅做格式容错，不改业务评分逻辑）。
- 将评分 worker 化/迁 Redis（属 roadmap 另一条 deferred follow-up「执行控制后续」）。
- Inbox UI 的新增可视化（保持现有契约即可，不新增组件）。

---

## Unclear Questions *(if applicable)*

- 退避具体参数（基数、最大间隔、是否需要 `next_retry_at` 持久化以跨 cron 周期生效）留待 plan 阶段定，取决于是否要在 batch 拾取 SQL 里过滤未到重试时间的项。
- 清洗脚本对 `retry_count` 是「归零」还是「按错误类型分别处理」，plan 阶段结合 FR-006 细化。

---

## Stage Readiness

| 检查项 | 状态 | 说明 |
|---|---|---|
| 根因已取证 | ✅ | 2026-06-11 DB 只读取证，三根因明确 |
| 范围已与用户确认 | ✅ | 评分鲁棒性闭环 + 一次性清洗脚本 + 单测/mock 验证 |
| 验收语义可测 | ✅ | US1-3 均可由单测 + mock 覆盖，清洗脚本有 dry-run |
| 进入 plan 的阻塞项 | 无 | Unclear Questions 为 plan 内决策，不阻塞进入 |

**下一步推荐**: 进入 `plan` 阶段，设计错误分类层、退避策略、sweep 收敛修复点与清洗脚本结构。

# Feature Specification: Inbox AI Scoring Continuation

**Workspace**: `inbox-ai-scoring-continuation`
**Created**: 2026-06-04
**Status**: Draft
**Input**: 用户确认: "`inbox-ai-scoring-continuation` 按窄范围推进,基于 roadmap 文档分析,作为 F1 验收收口和小迭代修复 feature,不是重新设计评分系统。"

> 本 feature 续接已实现的 `specs/inbox-ai-scoring/`,目标是把 F1 从"已有实现但 closeout evidence 不完整"推进到"可稳定验收关闭"。
> 本 feature 不重写评分系统,不新增旧 SQL 工作流。`migration-tooling-baseline` 已完成后,如需 schema change 必须使用 Prisma Migrate。

---

## Feature Traits

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 涉及 scheduler/API -> scoring service -> DB 状态机 -> UI/acceptance evidence |
| `external-side-effects` | ✅ | 可能修复真实 MySQL 中 `inbox_items.scoring_status` 状态和评分设置 |
| `artifact-handoff` | ✅ | DB evidence、runtime evidence、UI evidence 会写入 acceptance,供后续 roadmap 和 workbench/Hermes 消费 |
| `user-visible-output` | ✅ | Inbox UI 的评分按钮、评分列、筛选排序需要验收 |
| `prior-closure-failure` | ✅ | 旧 `inbox-ai-scoring` closeout fresh evidence 为 FAIL,存在 R3/T105/runtime replay 缺口 |

**结论**: 启用 Evidence Gate、Workflow Replay、三维 Verdict 和 closeout checklist。plan 必须包含 Producer-Consumer Matrix。

---

## User Scenarios & Testing

### User Story 1 - 评分运行配置可兜底 (Priority: P1)

作为运维和开发者,我希望 inbox 评分相关设置即使 DB seed 缺失也有代码级默认值,以便评分服务、scheduler 和 API 在迁移/部署漂移时仍能按 F1 默认策略运行。

**Why this priority**: 旧 closeout 发现 DB 中有 F1 settings,但 `AiSettingsService.DEFAULT_AI_SETTINGS` 未包含四个 scoring keys。没有代码级兜底会让部署/seed 漂移直接破坏评分闭环。

**Acceptance Scenarios**:

1. **[US1-1] 默认 scoring keys 可从 service 读取**
   **Given** `ai_settings` 中缺少 F1 scoring key
   **When** 代码调用 `AiSettingsService.get('inbox_scoring_enabled')`
   **Then** 返回 `{ value: true }` 语义,而不是 `null`

2. **[US1-2] list 包含默认 scoring keys**
   **Given** DB 返回空 settings
   **When** 调用 `AiSettingsService.list()`
   **Then** 返回 `inbox_promotion_threshold`, `inbox_scoring_enabled`, `inbox_scoring_batch_size`, `inbox_scoring_processing_timeout_minutes`

**Edge Cases**:

- **[US1-3]** `auto_score_on_sync` 继续使用 `{ enabled: boolean }` 旧 shape,不得被 `{ value }` 规则破坏。
- **[US1-4]** 已存在 DB 值优先于代码默认值。

### User Story 2 - processing 卡死项可被回收 (Priority: P1)

作为系统,我希望长期处于 `processing` 的 inbox 评分任务能被可靠回收,即使 `last_scored_at` 缺失或格式非法,以便任务不会永久卡死。

**Why this priority**: 旧 closeout DB evidence 显示当前库有 87 条 `processing`;原 sweep 只处理可解析且超时的 ISO 时间,不能覆盖缺失/非法时间。

**Acceptance Scenarios**:

1. **[US2-1] 超时 processing 被回收**
   **Given** `scoring_status='processing'` 且 `last_scored_at` 超过 timeout
   **When** 执行 sweep
   **Then** 状态变为 `pending`

2. **[US2-2] 缺失时间的 processing 被回收**
   **Given** `scoring_status='processing'` 且 `ai_score_details.last_scored_at` 缺失
   **When** 执行 sweep
   **Then** 状态变为 `pending`

3. **[US2-3] 非法时间的 processing 被回收**
   **Given** `last_scored_at` 无法被 MySQL 解析
   **When** 执行 sweep
   **Then** 状态变为 `pending`

**Edge Cases**:

- **[US2-4]** 新近 `processing` 且时间合法的项不得被提前回收。
- **[US2-5]** sweep 仅回收状态,不得清空已有 `ai_score_details.error/retry_count`。

### User Story 3 - 历史评分状态口径可诊断和修复 (Priority: P1)

作为维护者,我希望有一个幂等 doctor/backfill 能输出并修正历史评分状态口径,以便 T105 DB evidence 能从 FAIL 变成 PASS 或有明确例外。

**Why this priority**: 旧 closeout 发现 `ai_score IS NOT NULL=211`,但 `ai_score IS NOT NULL AND scoring_status='done'=111`。这直接阻塞 F1 closeout。

**Acceptance Scenarios**:

1. **[US3-1] doctor 输出状态分布**
   **Given** 当前生产/开发 DB
   **When** 运行 dry-run doctor
   **Then** 输出 `scoring_status` 分布、`ai_score IS NOT NULL` 总数、`scored_done` 总数、processing 缺失/非法/超时分类

2. **[US3-2] backfill 幂等修复 scored 状态**
   **Given** 记录已有 `ai_score IS NOT NULL` 但 `scoring_status != 'done'`
   **When** 运行 apply 模式
   **Then** 将其修正为 `done`,并且重复运行不再产生额外变更

3. **[US3-3] processing 回收可由 doctor 执行**
   **Given** 存在可回收的 `processing` 项
   **When** 运行 apply 模式
   **Then** 将可回收项置为 `pending`,并输出 affected count

**Edge Cases**:

- **[US3-4]** doctor 默认 dry-run,不应误改 DB。
- **[US3-5]** apply 模式必须显式传参,避免误操作。

### User Story 4 - Runtime/UI evidence 可完成 closeout (Priority: P2)

作为 roadmap 维护者,我希望本 feature 最终能补齐 runtime/UI/DB evidence 并更新 acceptance,以便后续 `agent-and-automation-contracts`、workbench、Hermes 可以消费稳定 scoring 输出。

**Why this priority**: roadmap Post-F7 明确要求 `inbox-ai-scoring-continuation` 在后续主线之前完成。

**Acceptance Scenarios**:

1. **[US4-1] runtime API smoke**
   **Given** dev server 运行且管理员 token 有效
   **When** 调用 `GET /api/v1/ai/feedback/digest` 和 `POST /api/inbox/score-batch`
   **Then** digest 返回 F1 骨架; score-batch 保持旧响应契约

2. **[US4-2] UI evidence**
   **Given** `/inbox` 页面可访问
   **When** 查看页面
   **Then** 可见 AI 评分按钮、评分列、评分筛选/排序;如浏览器工具不可用,必须记录代码级 evidence 和工具失败原因

3. **[US4-3] acceptance closeout**
   **Given** 修复和验证完成
   **When** 更新 `acceptance.md`
   **Then** 三维 Verdict 可解释地为 PASS 或 CONDITIONAL PASS;若仍 FAIL,不得宣布完成

---

## Requirements

### Functional Requirements

- **FR-001**: `AiSettingsService` 必须包含 F1 四个 scoring settings 的代码级默认值。
- **FR-002**: `AiSettingsService` 必须兼容 `{ value: number|boolean }` 与旧 `auto_score_on_sync` 的 `{ enabled: boolean }` shape。
- **FR-003**: `InboxScoringService.sweepStaleProcessing` 必须回收超时、缺失 `last_scored_at`、非法 `last_scored_at` 的 `processing` 项。
- **FR-004**: 必须提供幂等 doctor/backfill 入口,默认 dry-run,apply 模式显式开启。
- **FR-005**: doctor/backfill 必须输出 DB evidence: status 分布、scored/done 口径、processing 分类、affected counts。
- **FR-006**: backfill 必须能把 `ai_score IS NOT NULL` 且状态不一致的记录修正为 `scoring_status='done'`。
- **FR-007**: `/api/inbox/score-batch` 响应契约必须保持 `{ scored, failed, skipped, errors }`。
- **FR-008**: acceptance 必须记录 runtime/UI/DB evidence 和 closeout verdict。

### Non-Functional Requirements

- **NFR-001 (向后兼容)**: 不改变 F1 API contract,不重写 scoring prompt/model。
- **NFR-002 (迁移治理)**: 如需 schema change 必须使用 Prisma Migrate;本 feature 当前预期不需要 schema change。
- **NFR-003 (安全)**: doctor 默认 dry-run,apply 需要显式参数。
- **NFR-004 (可观测性)**: repair/backfill 输出必须足够用于 acceptance 直接引用。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 一致性 | 已评分记录状态口径一致 | 后续 workbench/Hermes 依赖评分结果 | T105 DB evidence | 是 |
| 可恢复性 | processing 不永久卡死 | cron/重启后任务可继续 | sweep 单测 + doctor 输出 | 是 |
| 可演进性 | 不新增旧 SQL 工作流 | migration baseline 已完成 | 无 `database/*.sql` 新 schema 变更 | 是 |
| 用户可见性 | UI 评分入口可验收 | roadmap 要求 R3 收口 | browser 或代码 evidence | 否 |

### Key Entities

- **ai_settings**: F1 scoring keys 的 KV 存储;本 feature 补代码级默认值。
- **inbox_items.scoring_status**: 评分状态机字段;本 feature 修复 `processing` 回收和历史状态口径。
- **doctor/backfill report**: 命令输出 JSON,作为 DB evidence。

---

## Out of Scope

- 重写 `inbox-ai-scoring` F1 评分系统。
- 新增 BullMQ/Redis/n8n/Hermes 执行层。
- 设计 F2 preference-learning。
- 改变 `/api/inbox/score-batch` 或 `/api/v1/ai/score` API contract。
- 新增旧 `database/*.sql` schema 变更入口。

---

## Stage Readiness

- 下一步建议: `plan`
- 阻塞项: 无。需求已由 roadmap 和旧 closeout evidence 收口。

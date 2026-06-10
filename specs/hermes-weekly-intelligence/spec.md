# Feature Specification: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence`
**Created**: 2026-06-08
**Status**: Draft
**Input**: 用户确认继续 admin modernization roadmap 下一项；roadmap 推荐 `specify hermes-weekly-intelligence`

> 写入本文件后，应同步更新 `specs/.active` 指向当前 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | Hermes 需要消费 feedback digest、候选池、任务状态，生成偏好记忆、周刊建议和复盘报告，再由 Admin UI 人工确认写回。 |
| `external-side-effects` | ✅ | Hermes 会调用 Admin `/api/v1`、可能写入 hermes-db/PG/pgvector 读模型和记忆；apply/publish 仍会写 MySQL 或触发 Quail，但必须经 Admin API。 |
| `artifact-handoff` | ✅ | feedback digest、weekly candidates、Redis job status、Hermes suggestion artifact、preference memory 和 ops report 都会被不同系统消费。 |
| `user-visible-output` | ✅ | Admin 工作台需要展示 Hermes 建议、理由、置信度、来源证据和复盘摘要。 |
| `prior-closure-failure` | ✅ | Roadmap 多次强调 Hermes 不能绕过 Admin API 成为事实源；此前 automation/Redis feature 已专门补闭环证据，本 feature 必须继续避免隐式写库或只做离线建议。 |
| `bugfix-loop-breaker` | ❌ | 本 feature 是新能力规格，不是修复已定位 bug；若后续实现发现重复失败再单独启用。 |

**结论**: 下游 `plan` 必须包含 Producer-Consumer Matrix、Hermes/Admin/PG 边界 ADR、data-model；`verify` 必须覆盖 workflow replay；`closeout` 必须给出 Component / Workflow / User-Visible Outcome 三维 Verdict。

---

## Context Summary

前置 feature 已完成：

- `agent-and-automation-contracts`: 已提供 automation token、scope、OpenAPI、`automation_runs`、feedback digest、weekly candidates/suggestions/apply/publish contract。
- `admin-shell-and-weekly-workbench`: 已提供候选池、建议预览、人工 apply、发布检查和 runs timeline 的用户可见工作台。
- `redis-job-orchestration`: 已把 `/api/v1/jobs/sync` 与 `/api/v1/jobs/score` 迁入 Redis/BullMQ worker，并提供 status/retry/worker health。
- `database-and-search-strategy`: 已固定 MySQL/Prisma 是业务事实源，PG/pgvector/hermes-db 只能作为智能读模型和记忆层。

当前 Admin 侧可消费契约：

- `GET /api/v1/ai/feedback/digest`
- `GET /api/v1/weekly/candidates`
- `POST /api/v1/weekly/suggestions`
- `POST /api/v1/weekly/suggestions/{id}/apply`
- `POST /api/v1/weekly/publish`
- `GET /api/v1/jobs/{id}` / `/api/health` jobQueue

本 feature 的目标不是重写 Admin 评分，也不是让 Hermes 自动发布周刊，而是把 Hermes 接成“有记忆的判断层”：学习用户偏好、生成可审查周刊建议、解释排序理由、输出运营复盘，并保持所有业务写入经 Admin API 和人工确认。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hermes 从 Admin 反馈中学习偏好 (Priority: P1)

作为周刊运营者，我希望 Hermes 能从我对候选内容的人工操作中提炼偏好，以便后续建议更贴近我的选择标准，而不是只按静态评分排序。

**Why this priority**: 这是 Hermes 相对现有 Admin AI 评分的核心增量；如果没有偏好学习，Hermes 只是另一个一次性建议接口。

**Acceptance Scenarios**:

1. **[US1-1] 读取反馈摘要**
   **Given** Admin 已有 `operation_logs` 和 `/api/v1/ai/feedback/digest`
   **When** Hermes 使用具备 `ops:read` scope 的 automation token 拉取指定时间窗口
   **Then** Hermes 必须获得结构化 actions、counts、range 和 run evidence，不直接读 MySQL

2. **[US1-2] 生成偏好记忆**
   **Given** digest 中包含人工晋升、跳过、精选、删除或调整类动作
   **When** Hermes 执行 `weekly_preference_learning`
   **Then** 它必须输出可审计的 preference memory，包含偏好描述、证据样本、适用范围、置信度和更新时间

3. **[US1-3] 空反馈可安全跳过**
   **Given** 指定周期没有足够人工反馈
   **When** Hermes 学习任务运行
   **Then** 任务应返回 `empty` 或 `skipped`，不得生成虚假偏好，也不得覆盖已有可靠记忆

**Edge Cases**:

- **[US1-4] feedback digest 不可用**: Hermes 应记录 dependency unavailable，并在 Admin 可见的复盘或任务状态中提示，不得改写偏好记忆。
- **[US1-5] 样本冲突**: 同一主题出现相反操作时，偏好应降置信度或标为需人工确认。
- **[US1-6] 隐私与 secret**: Hermes 记忆和日志不得保存 automation token、数据库密码、完整私密正文或未脱敏外部密钥。

### User Story 2 - Hermes 生成可人工确认的周刊建议 (Priority: P1)

作为周刊编辑者，我希望 Hermes 根据候选内容、历史偏好和当前任务状态生成周刊建议，以便我在工作台中快速审查、调整并确认，而不是让系统直接写入周刊。

**Why this priority**: Roadmap 明确要求 Hermes 不直接写 MySQL、不直接发布；价值必须落在“更好的建议 + 人工确认”上。

**Acceptance Scenarios**:

1. **[US2-1] 读取候选池**
   **Given** Admin 提供 `/api/v1/weekly/candidates`
   **When** Hermes 规划某一期周刊
   **Then** 它必须通过 Admin API 读取候选内容、评分、摘要、来源和时间范围，不绕过 Admin 服务层

2. **[US2-2] 输出 preview artifact**
   **Given** Hermes 已读取候选池和偏好记忆
   **When** 它生成 `weekly_issue_planner` 建议
   **Then** 输出必须是 preview artifact，至少包含 item list、section、featured、reason、evidence refs、confidence 和可传给 Admin apply contract 的 payload

3. **[US2-3] 人工确认后写回**
   **Given** Admin 工作台展示 Hermes 建议
   **When** 用户点击应用或调整后应用
   **Then** 只有 Admin `/api/v1/weekly/suggestions/{id}/apply` 或 workbench wrapper 能写入 `weekly_content_items`

**Edge Cases**:

- **[US2-4] 候选为空**: Hermes 应返回 empty suggestion 和缺口说明，建议下一步执行 sync/score job，而不是生成空洞周刊。
- **[US2-5] content id 失效**: Admin apply 必须拒绝无效或已关联到其他周刊的 content id；Hermes 建议应保留被拒原因供复盘。
- **[US2-6] 建议过多或过少**: Hermes 必须遵守 Admin contract 的 `maxItems` 和 schema，不得让 UI 或 apply endpoint 接收无限列表。

### User Story 3 - Hermes 提供可解释复盘和下一步建议 (Priority: P2)

作为维护者，我希望 Hermes 能解释本期周刊为什么这样推荐、哪些自动化任务失败、下一步该补什么，以便复盘不依赖翻日志。

**Why this priority**: Redis job 已提供任务状态，workbench 已提供 runs timeline；Hermes 应把这些状态转成可操作解释，而不是只生成内容排序。

**Acceptance Scenarios**:

1. **[US3-1] 读取任务状态**
   **Given** Redis job/status 和 `automation_runs` 已记录 sync/score 状态
   **When** Hermes 生成 `weekly_ops_report`
   **Then** 它必须引用 Admin job/status 或 health 信息，区分数据不足、评分失败、worker 不在线和建议生成失败

2. **[US3-2] 展示复盘摘要**
   **Given** 工作台打开某一期周刊
   **When** Hermes ops report 可用
   **Then** Admin 应能展示复盘摘要、关键风险、建议下一步和相关 run/job ids

3. **[US3-3] 失败不阻塞人工流程**
   **Given** Hermes 服务或 PG/pgvector 读模型不可用
   **When** 用户打开工作台或发布周刊
   **Then** Admin 应降级为现有候选/建议/人工编排流程，不得阻塞手动组刊或发布检查

**Edge Cases**:

- **[US3-4] 状态过期**: Redis status 过期时，Hermes 应基于 durable `automation_runs` 说明 history-only，而不是当作无状态。
- **[US3-5] 报告引用不存在的 run/job**: UI 必须显示不可定位状态，并保留原始 id 供排查。

### User Story 4 - Hermes 智能读模型不成为事实源 (Priority: P1)

作为系统维护者，我希望 PG/pgvector/hermes-db 只保存可重建的记忆、向量和建议记录，以便 MySQL 仍是业务写入事实源。

**Why this priority**: 这是 `database-and-search-strategy` 和 roadmap 的核心边界；一旦 Hermes 直写事实表，后续一致性和审计会失控。

**Acceptance Scenarios**:

1. **[US4-1] 明确读模型实体**
   **Given** 下游 plan 需要设计 Hermes 数据模型
   **When** 定义 preference memory、embedding、suggestion record、agent run log
   **Then** 必须标注哪些字段可从 MySQL/Admin API 重建，哪些是 Hermes 派生事实

2. **[US4-2] 写回只走 Admin API**
   **Given** Hermes 需要应用建议、发布或修改周刊
   **When** 产生写入意图
   **Then** 它必须调用 Admin API，并受 scope、idempotency、automation_runs 和人工确认约束

3. **[US4-3] 可重建与删除**
   **Given** PG/pgvector/hermes-db 数据损坏、清空或需要重建
   **When** 重新从 Admin API 拉取候选、反馈和历史 run
   **Then** 系统应能重建智能读模型，不影响 MySQL 业务事实

**Edge Cases**:

- **[US4-4] 读模型与 MySQL 不一致**: Admin UI 必须优先相信 MySQL/API 当前状态，并把 Hermes artifact 标为 stale。
- **[US4-5] 多 agent 并发写记忆**: plan 必须定义 run id、source id 或 version，避免偏好记忆互相覆盖。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须定义 Hermes skills 的范围，至少包含 `weekly_preference_learning`、`weekly_issue_planner`、`weekly_ops_report`。
- **FR-002**: Hermes 必须通过 Admin `/api/v1` contract 读取 feedback digest、weekly candidates、job/status 和 publish/apply 结果；不得直接读写 MySQL 业务表。
- **FR-003**: Hermes automation token 必须按最小权限配置；偏好学习需要 `ops:read`，候选读取需要 `weekly:read`，建议预览需要 `weekly:suggest`，发布权限不得默认授予。
- **FR-004**: Hermes 生成的周刊建议必须是 preview artifact；未人工确认前不得写入 `weekly_content_items`、不得改变 `weekly_issues.status`、不得发布。
- **FR-005**: 建议 artifact 必须包含可校验 schema：`weeklyIssueId`、items、section、featured、reason、confidence、evidence refs、source run id 或 agent run id。
- **FR-006**: Admin UI 必须能展示 Hermes 建议的理由、置信度、证据来源和 apply 结果；无法展示时必须降级为现有 workbench 建议/人工编排流程。
- **FR-007**: 偏好记忆必须可审计，包含来源 digest 时间窗、样本数、提炼规则、置信度、更新时间和适用范围。
- **FR-008**: PG/pgvector/hermes-db 只能保存智能读模型、向量、偏好记忆、agent run log 和 suggestion record，不得替代 MySQL/Prisma 事实源。
- **FR-009**: 如果实现需要新增 Admin 持久字段或表，必须通过 Prisma Migrate；不得新增 `database/*.sql` 作为 schema 变更入口。
- **FR-010**: Hermes ops report 必须区分 empty、skipped、failed、dependency unavailable、history-only 和 stale data。
- **FR-011**: Hermes 不能直接触发 Quail 发布；发布必须保留 Admin publish contract、`weekly:publish` scope、`Idempotency-Key` 和显式用户/调用方确认。
- **FR-012**: 所有 Hermes run 必须有可追踪 id，并能关联 Admin `automation_runs`、job id 或 API run id。
- **FR-013**: 响应、日志、记忆和报告不得泄漏完整 automation token、token hash、数据库 URL、Redis password、LLM provider key 或未脱敏敏感正文。
- **FR-014**: Plan 必须定义 Hermes 与 Admin/NAS 的部署边界，包括触发方、调度位置、token 存放、网络访问和失败告警。
- **FR-015**: Plan 必须定义如何从现有 Admin AI organizer 过渡；Hermes 不应重复实现已由 Admin scoring/job layer 负责的批量评分。

### Non-Functional Requirements

- **NFR-001 (一致性)**: MySQL/Prisma 和 Admin API 是业务事实源；Hermes/PG 读模型不参与强一致业务写入。
- **NFR-002 (可用性)**: Hermes 或 PG/pgvector 不可用时，Admin 工作台核心人工组刊和发布流程仍可用。
- **NFR-003 (可观测性)**: 每次 Hermes 学习、建议和复盘 run 必须能通过 run id、时间窗、输入摘要、输出摘要和错误分类定位。
- **NFR-004 (安全)**: Hermes token 权限最小化；`weekly:publish` 权限必须单独授予并默认不包含在 planner token 中。
- **NFR-005 (可测试性)**: 下游实现必须覆盖 digest empty/succeeded、candidate empty/succeeded、suggestion schema invalid、apply rejected、Hermes unavailable、read-model stale 等路径。
- **NFR-006 (可演进性)**: Hermes artifact 格式应允许后续增加 embedding evidence、historical preference refs 和 A/B scoring，不破坏现有 apply contract。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 一致性 | 写回只经 Admin API | 防止 Hermes 成为第二事实源 | ADR + Producer-Consumer Matrix + tests | 是 |
| 可解释性 | 每条建议可看到理由和证据 | 人工确认需要判断依据 | UI/API fixture 和 replay evidence | 是 |
| 安全 | token/scope 最小化且脱敏 | Hermes 长期运行在外部环境 | token scope table + log redaction checks | 是 |
| 可用性 | Hermes down 不阻塞人工组刊 | 周刊生产不能依赖智能层单点 | degraded workflow replay | 是 |
| 可演进性 | 读模型可重建 | PG/pgvector 是派生层 | data-model 标注 rebuild source | 是 |

### Key Entities

- **Hermes Skill**
  - 运行在 Hermes 侧的能力单元。
  - 本 feature 至少定义 preference learning、issue planner、ops report 三类 skill 的输入输出。

- **Preference Memory**
  - 从 Admin feedback digest 中提炼的偏好记录。
  - 关键字段包括 title/summary、evidence sample、confidence、scope、source range、updated_at。

- **Suggestion Artifact**
  - Hermes 生成的周刊建议预览。
  - 不直接写 MySQL；被 Admin UI 展示并由 apply contract 确认写回。

- **Hermes Read Model**
  - PG/pgvector/hermes-db 中的派生数据。
  - 包括 embeddings、preference memory、suggestion records、agent run logs；可从 Admin API 重建。

- **Agent Run Log**
  - Hermes run 的执行记录。
  - 需要能关联 Admin automation run、job id、输入摘要、输出摘要、错误分类和耗时。

---

## Business Metrics *(optional — 上线后度量)*

- **BM-001**: Hermes 建议被人工直接应用或少量修改后应用的比例。
- **BM-002**: Hermes 建议中因 invalid content id、重复关联、过期状态被拒绝的比例。
- **BM-003**: 每周复盘中能明确定位的失败类型占比，而不是只显示未知失败。

---

## Out of Scope

- 不迁移 Admin 主库到 Postgres。
- 不让 Hermes 直接写 MySQL、直接修改周刊或直接发布 Quail。
- 不重做 Admin 批量评分；评分仍由 Admin scoring/job layer 负责。
- 不实现完整新任务中心页面；复用现有 workbench/runs/job health surface，除非 plan 证明必须新增。
- 不在本 spec 阶段决定具体 Hermes CLI、MCP 调用或 NAS systemd/docker 部署命令。
- 不处理 secret rotation/token UI 审计面板；仍属于 deferred `security-and-runtime-hardening`。

---

## Clarifications

- **C1 - Hermes runtime / repo boundary**: Admin repo 不实现 Hermes skill 本体，也不决定具体 Hermes CLI、MCP、NAS systemd 或 Docker 命令。Plan 只定义 Admin 侧 contract、artifact schema、UI consumer、失败降级和对 Hermes 三个 skill 的输入输出期望；具体 Hermes 运行目录和部署方式作为外部运行时前提记录。
- **C2 - hermes-db / PG / pgvector ownership**: Admin repo 不创建 hermes-db/PG/pgvector 表，不把外部读模型纳入 Prisma Migrate。PG/pgvector schema、连接方式、迁移归属应属于 Hermes/MCPS/NAS 侧独立交付；本 feature 只描述 read-model entities、rebuild source 和 stale detection contract。
- **C3 - suggestion artifact main path**: 主路径采用 Hermes 生成 preview artifact，Admin 保存/展示并经人工确认后调用现有 apply contract 写回。Hermes 可以调用 Admin `/api/v1/weekly/suggestions` 生成或登记 preview，但不得绕过 Admin UI/Workbench 的人工确认直接 apply/publish。
- **C4 - ops report UI entry**: MVP 复用现有 workbench surface：建议面板旁展示 Hermes reasoning / confidence / evidence，在 runs / job health 区域展示 ops report 和 run/job ids。单独复盘区不进入本 feature，除非 plan 证明现有 surface 无法承载。

---

## Stage Readiness

- 下一步建议：`closeout admin-modernization-roadmap`
- 阻塞项：无；当前 feature 已 PASS closeout。Admin-side contract、workbench consumer、ops report surface 和 workflow replay 已实现并通过 focused tests/type-check/lint。

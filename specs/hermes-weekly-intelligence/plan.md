# Implementation Plan: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/hermes-weekly-intelligence/spec.md`

---

## Summary

Hermes 接入采用“外部智能层生成 artifact，Admin 工作台展示并人工确认写回”的方案。Admin 继续作为业务事实源和写入边界，Hermes/PG/pgvector 只保存可重建的偏好、建议、向量和 run 记录。

方案讨论已在 clarify 中收敛：Hermes 不在本仓库实现 skill 本体、不直接写 MySQL、不直接发布 Quail；当前只剩一个符合 spec 的合理方向，因此直接生成计划。

---

## Architecture Overview

```text
Admin MySQL / Prisma
  -> /api/v1/ai/feedback/digest      -> Hermes weekly_preference_learning
  -> /api/v1/weekly/candidates       -> Hermes weekly_issue_planner
  -> /api/v1/jobs/{id}, /api/health  -> Hermes weekly_ops_report

Hermes runtime / hermes-db / PG / pgvector
  -> preference memory
  -> suggestion artifact
  -> ops report

Hermes suggestion artifact
  -> Admin /api/v1/weekly/suggestions register or preview response
  -> automation_runs.result_summary as durable Admin-side record
  -> Workbench SuggestionPanel / runs surface
  -> user confirms
  -> /api/v1/weekly/suggestions/{weeklyIssueId}/apply
  -> MySQL weekly_content_items
```

Admin repo 的职责是契约、展示、写回保护和降级；Hermes repo/NAS runtime 的职责是 skill 执行、长期记忆、向量与 agent run log。PG/pgvector 数据可以推荐或召回，但不能替代 Admin API 当前状态。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 | 适配点 | 不适配点 | 当前阶段 |
|-----------------|------|--------|----------|----------|
| CQRS / read model | Local: `specs/database-and-search-strategy/data-model.md` | MySQL 保持写模型，PG/pgvector 做可重建智能读模型 | 不引入完整事件溯源，不迁主库 | MVP |
| Human-in-the-loop workflow | Local: `docs/automation-contracts.md` + existing workbench | Hermes 生成建议，Admin UI 人工确认后写回 | 不做全自动发布，不把 agent 设为最终决策者 | MVP |
| Artifact handoff pipeline | Local: SDD feature traits | digest/candidates/status -> Hermes artifact -> Admin consumer | 不新增独立任务中心，不做复杂编排平台 | MVP |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| Admin `GET /api/v1/ai/feedback/digest` | feedback digest: range, actions, counts, run meta | Hermes `weekly_preference_learning` | Hermes run 记录 source range、action count、empty/skipped/succeeded；Admin `automation_runs` 有 `feedback_digest` run |
| Hermes `weekly_preference_learning` | preference memory | Hermes `weekly_issue_planner` / ops report | suggestion artifact 引用 preference refs、confidence、source range；低样本时返回 skipped |
| Admin `GET /api/v1/weekly/candidates` | weekly candidates | Hermes `weekly_issue_planner` | Hermes artifact 中每个 item 引用 content id、score/evidence refs；candidate empty 时 artifact status 为 empty |
| Admin job/status + `/api/health` | job queue health, worker status, durable `automation_runs` | Hermes `weekly_ops_report` | ops report 区分 worker down、history-only、stale data、dependency unavailable |
| Hermes `weekly_issue_planner` | suggestion artifact | Admin `/api/v1/weekly/suggestions` / workbench | Admin 保存 preview 到 `automation_runs.result_summary` 或返回 workbench preview；UI 能展示 item/reason/confidence/evidence |
| Admin workbench | human apply intent | Admin apply service | `src/lib/automation/weekly-suggestions.ts` 校验 content id、重复关联、max 30，并写 `weekly_content_items` |
| Admin apply endpoint | apply result | Hermes ops report / Workbench UI | apply result 记录 linked/skipped/rejected counts；失败原因保留给复盘 |
| Hermes `weekly_ops_report` | ops report artifact | Workbench runs / job health surface | UI 展示摘要、风险、下一步建议、run/job ids；Hermes 不可用时该区域降级为空或提示不可用 |

**孤儿 artifact 处理**: 没有孤儿 artifact。PG/pgvector embeddings 不在 MVP UI 直接展示，但必须被 preference memory 或 suggestion evidence 引用；否则只能作为 deferred read-model 能力记录，不能作为完成证据。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 一致性 | 写回只经 Admin API | apply/publish 继续由 Admin scope、idempotency、Prisma transaction 控制 | apply rejected / duplicate / invalid id tests |
| 可解释性 | 每条建议可见 reason、confidence、evidence | artifact schema 扩展现有 suggestion item | UI fixture + workbench preview replay |
| 安全 | token 最小权限、日志脱敏 | Hermes planner token 默认不含 `weekly:publish`；artifact 不保存 secret | scope tests + redaction checks |
| 可用性 | Hermes/PG down 不阻塞人工组刊 | Workbench 保留现有候选、Admin organizer 和手动 apply/publish | degraded workflow replay |
| 可演进性 | 读模型可重建 | `data-model.md` 标注 rebuild source，不在 Admin repo 建外部表 | rebuild source review + stale artifact tests |
| 可观测性 | 每次 Hermes run 可定位 | artifact 必须带 `agentRunId` / `sourceRunId` / input summary | runs timeline 和 job status evidence |

---

## Capacity / Scale Notes

- **规模假设**: MVP 按每周一期、候选内容几十到数百条、建议最多 30 条设计；不做高并发实时推荐。
- **读写特征**: digest/candidates/job status 为读多写少；apply/publish 是少量人工确认写入；Hermes memory 是批处理派生写入。
- **失败代价**: 错建议会浪费编辑时间但不应直接污染 MySQL；错写回或自动发布是高代价路径，必须由 Admin apply/publish contract 拦住。
- **一致性等级**: Admin/MySQL 当前状态优先；Hermes artifact 可 stale，stale 时只能提示或重新生成，不能强行 apply。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 Admin API 是唯一写回边界 | Roadmap 多次要求 Hermes 不成为事实源 | A 直写 MySQL / B Admin API / C 只离线报告 | 选 B | 外部 agent 需要遵守 token、scope、idempotency；实现多一步注册/展示 | `docs/automation-contracts.md` |
| ADR-002 Hermes read model 归外部运行时 | Admin repo 当前 MySQL/Prisma 是事实源 | A Admin Prisma 管 PG 表 / B Hermes/MCPS 管读模型 / C 不存记忆 | 选 B | Admin 只能验证契约，不能在本仓库完成外部 DB migration | `specs/database-and-search-strategy/data-model.md` |
| ADR-003 suggestion artifact 先展示后 apply | 直接 apply 会绕过人工确认 | A Hermes 直接 apply / B Admin 展示后人工 apply / C 只输出文件 | 选 B | UI 需要支持 artifact 展示和 apply 结果复盘 | `spec.md` Clarifications C3 |
| ADR-004 复用 workbench surface | 现有工作台已有 suggestion panel 和 runs timeline | A 新建任务中心 / B 放建议面板和 runs 区域 / C 不显示 ops report | 选 B | 初期信息密度受现有布局约束 | `spec.md` Clarifications C4 |
| ADR-005 Admin organizer 过渡为 fallback | 现有 `organizeWeekly` 已能生成基础建议 | A 立即替换 / B Hermes artifact 优先，Admin organizer fallback / C 保留两套无关系入口 | 选 B | 需要标识 provider/source，避免用户分不清建议来源 | `src/lib/ai/server/weekly-organizer.ts` |

---

## Key Design Decisions

### Decision 1: Suggestion endpoint supports registration as well as generation

- **背景**: 现有 `POST /api/v1/weekly/suggestions` 会调用 Admin 内置 organizer 生成 preview；Hermes 需要提交已生成的 preview artifact。
- **选项**:
  - A: 新增 Hermes 专用 endpoint。清晰但会复制 auth/idempotency/run 逻辑。
  - B: 扩展现有 endpoint，默认保持 Admin generate，新增 `mode: "register"` 接收 Hermes artifact。
  - C: Hermes 只写外部文件，由 Admin 手工导入。实现简单但闭环弱。
- **结论**: 选 B。复用 `weekly:suggest` scope、idempotency 和 `automation_runs`，同时保持现有调用兼容。
- **影响**: Body schema 需要成为 discriminated union；`result_summary` 保存脱敏后的 artifact；response 继续返回 `status: "preview"`。
- **来源**: `src/app/api/v1/weekly/suggestions/route.ts`, `src/lib/automation/run.ts`

### Decision 2: Apply route keeps weekly issue id semantics

- **背景**: 现有 `POST /api/v1/weekly/suggestions/{id}/apply` 的 `{id}` 实际作为 `weeklyIssueId` 使用。
- **选项**:
  - A: 立即改为真实 suggestion id。会破坏已有 workbench wrapper 和 contract。
  - B: 保留 `{weeklyIssueId}` 语义，artifact id/run id 放在 body/meta 中追踪。
- **结论**: 选 B。计划中把路径参数明确命名为 weekly issue id，后续文档和 OpenAPI 应消除歧义。
- **影响**: apply schema 可增加可选 `sourceRunId` / `agentRunId` 供复盘，但写回仍只使用 items。
- **来源**: `src/app/api/v1/weekly/suggestions/[id]/apply/route.ts`

### Decision 3: Ops report is derived, not blocking

- **背景**: Redis/job health 和 automation runs 已提供状态；Hermes report 是解释层。
- **选项**:
  - A: report 缺失阻塞发布。风险过高。
  - B: report 可用时展示，不可用时降级到现有 runs/job health。
- **结论**: 选 B。
- **影响**: UI 必须处理 report unavailable、history-only、stale data；发布检查不依赖 Hermes。
- **来源**: `src/components/weekly/AutomationRunTimeline.tsx`, `src/app/api/weekly/workbench/jobs/route.ts`

---

## Module Design

### Module: Admin Automation Contract

**职责**: 为 Hermes 提供稳定读写边界。

**改动概述**:

- 扩展 `/api/v1/weekly/suggestions`，支持 Admin generate 和 Hermes register 两种 preview artifact 来源。
- 明确 `/api/v1/weekly/suggestions/{weeklyIssueId}/apply` 的路径语义，并可选记录 source run id。
- 保留 `/api/v1/weekly/publish` 的 `weekly:publish` 独立 scope，planner token 默认不能发布。

**关键接口 / 行为**:

```text
GET /api/v1/ai/feedback/digest?from&to
GET /api/v1/weekly/candidates?date|weekOffset&limit&status
POST /api/v1/weekly/suggestions
  mode=generate -> existing Admin organizer
  mode=register -> Hermes preview artifact
POST /api/v1/weekly/suggestions/{weeklyIssueId}/apply
GET /api/v1/jobs/{runId}
GET /api/health
```

**注意事项**:

- `mode` 缺省为 existing generate，保证当前 workbench 不破。
- Hermes register payload 必须通过 zod schema 校验 max 30、content id 正数、reason/confidence/evidence 长度。
- endpoint 不接受 token、DB URL、provider key、完整私密正文。

### Module: Hermes Skill Contracts

**职责**: 定义 Hermes 三个 skill 的输入输出，不在 Admin repo 实现 skill 本体。

**改动概述**:

- `weekly_preference_learning`: 消费 feedback digest，生成 preference memory。
- `weekly_issue_planner`: 消费 candidates + preference memory，生成 suggestion artifact。
- `weekly_ops_report`: 消费 job/status、apply result、health，生成 ops report。

**关键接口 / 行为**:

```text
weekly_preference_learning(input: feedbackDigest) -> preferenceMemory | skipped | empty
weekly_issue_planner(input: candidates, preferenceMemory, issueContext) -> suggestionArtifact
weekly_ops_report(input: runs, jobStatus, applyResult?) -> opsReport
```

**注意事项**:

- Hermes runtime/repo/NAS 部署命令不是本 feature 的产物。
- Hermes 侧 run id 必须能映射到 Admin `automation_runs.id` 或 artifact `sourceRunId`。

### Module: Suggestion Artifact Adapter

**职责**: 把 Hermes 输出规范化为 Admin UI 和 apply contract 可消费的 preview。

**改动概述**:

- 新增共享 schema 类型，覆盖 `provider`, `agentRunId`, `weeklyIssueId`, `items`, `confidence`, `evidenceRefs`, `preferenceRefs`, `status`。
- 在 register 时验证 content ids 当前仍是候选或可 apply 的内容。
- 将脱敏 artifact 存入 `automation_runs.result_summary`，作为 Admin 侧 durable preview record。

**关键接口 / 行为**:

```text
Hermes artifact
  -> validate schema
  -> validate current issue/content state
  -> save sanitized preview in automation_runs.result_summary
  -> return preview to caller / workbench
```

**注意事项**:

- content id 失效时 register 可以标记 stale/rejected，也可以在 apply 时拒绝；apply 拒绝必须保留原因。
- Artifact 的 evidence refs 应是摘要引用或 source ids，不保存完整敏感正文。

### Module: Workbench UI Consumer

**职责**: 在现有工作台里展示 Hermes 建议、理由、置信度、证据和 apply 结果。

**改动概述**:

- 扩展 `SuggestionPanel` 支持 provider badge、confidence、evidence refs、preference refs、stale/unavailable 状态。
- 从 workbench route 读取最新 Hermes suggestion preview，或让用户手动生成 Admin fallback suggestion。
- apply 仍调用现有 workbench apply wrapper，写回后刷新 issue/candidates/runs。

**关键接口 / 行为**:

```text
Workbench loads:
  issue
  candidates
  recent weekly runs
  latest Hermes suggestion artifact, if available

User actions:
  review artifact
  optionally refresh/generate fallback suggestion
  apply selected items
```

**注意事项**:

- 不新增完整任务中心。
- Hermes 不可用时，现有候选列表、手动编排、Admin organizer 和发布检查仍可用。

### Module: Ops Report Surface

**职责**: 把 job/runs/health 状态解释成可操作复盘。

**改动概述**:

- 在 runs/job health 区域展示 Hermes ops report 摘要、风险和下一步建议。
- 将 report 的 run/job ids 和 Admin durable run 关联。
- 对 Redis status expired 显示 history-only，不误报为无状态。

**关键接口 / 行为**:

```text
job status unavailable -> dependency unavailable
redis snapshot missing + durable run exists -> history-only
worker heartbeat stale -> worker degraded
candidates empty -> collect/sync next action
apply rejected -> invalid/stale suggestion
```

**注意事项**:

- Ops report 不参与发布 gate。
- Report 引用不存在的 run/job 时 UI 显示原始 id 和不可定位状态。

---

## Data Model

详细读模型和 artifact schema 见 [data-model.md](data-model.md)。

本 feature 不新增 Admin Prisma model 或 migration。Admin MVP 可复用 `automation_runs.result_summary` 保存脱敏 preview / report 摘要；Hermes 长期记忆和 pgvector schema 由外部 Hermes/MCPS/NAS 侧管理。

---

## Project Structure

```text
specs/hermes-weekly-intelligence/
  spec.md
  plan.md
  data-model.md

Existing Admin surfaces to extend later:
  docs/automation-contracts.md
  src/app/api/v1/weekly/suggestions/route.ts
  src/app/api/v1/weekly/suggestions/[id]/apply/route.ts
  src/lib/automation/weekly-suggestions.ts
  src/lib/services/weekly-workbench.ts
  src/components/weekly/SuggestionPanel.tsx
  src/components/weekly/AutomationRunTimeline.tsx
```

---

## Risks and Tradeoffs

- **Endpoint naming ambiguity**: `/suggestions/{id}/apply` 当前 id 是 weekly issue id，不是真 suggestion id。Plan 要求在 OpenAPI/docs 中显式修正语义，避免 Hermes 误用。
- **No Admin-owned PG schema**: Admin 无法单独验证 Hermes memory DB migration；只能验证 artifact contract 和降级路径。
- **Artifact staleness**: 候选池会变化，Hermes artifact 必须在 apply 前重新校验 current content state。
- **Provider confusion**: UI 必须区分 Hermes 建议和 Admin fallback 建议，否则复盘指标没有意义。
- **Secret leakage**: Hermes 长期运行且会保存记忆，schema 和日志必须只保留摘要/引用，不保存 secret 或完整私密正文。

---

## Evolution Path

- **MVP**: Hermes 通过 Admin API 拉 digest/candidates/status，提交 preview artifact；Admin workbench 展示并人工 apply；读模型归外部。
- **成长期**: Hermes memory 引入 embedding evidence、历史偏好 refs、建议接受率指标；Admin 可按 provider/filter 展示建议历史。
- **成熟期**: 若建议量和复盘量明显增长，再考虑独立 suggestion table、复盘页、A/B scoring 和更强的 agent run observability。

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。PG/pgvector 和 Hermes DB 只作为外部读模型契约，不在 Admin repo 建复杂智能平台。
- 是否引用了外部模式但没有适配检查：否。只引用本 roadmap 已确认的 CQRS/read-model 和 human-in-loop 边界。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。新增 artifact、preference memory、ops report 都在矩阵和 data-model 中记录。

---

## Verification Strategy

- **Contract tests**:
  - `/api/v1/weekly/suggestions` register mode validates schema, maxItems, confidence/evidence shape, and idempotency.
  - `/api/v1/weekly/suggestions/{weeklyIssueId}/apply` rejects invalid content id, duplicate content id, linked elsewhere, stale artifact payload.
  - Token scopes: planner token has `weekly:read`, `weekly:suggest`, `ops:read`; no `weekly:publish` by default.

- **UI tests**:
  - `SuggestionPanel` renders Hermes provider, confidence, evidence, stale/unavailable states.
  - Apply success refreshes selected count and shows linked/skipped result.
  - Hermes unavailable still leaves Admin fallback suggestion/manual workflow usable.

- **Workflow replay**:
  - digest empty -> preference learning skipped -> planner still works without fake memory.
  - candidates empty -> empty suggestion + next action to sync/score.
  - Hermes artifact generated -> Admin preview visible -> human apply -> `weekly_content_items` updated.
  - Redis status expired -> ops report shows history-only using durable `automation_runs`.

- **Security checks**:
  - Artifact/result/log snapshots do not include automation token, token hash, Redis password, DB URL, provider key, or full private body.

---

## Stage Readiness

- 是否需要 `data-model.md`：需要。该 feature 涉及 preference memory、suggestion artifact、ops report、agent run log 和 external read model。
- 下一步建议：`tasks`
- 阻塞项：无；具体 Hermes runtime repo/deploy command 仍是外部前提，不阻塞 Admin-side task decomposition。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 本文件 |
| data-model.md | 需要 | 定义 Admin artifact 与外部 Hermes read model 契约 |
| tasks.md | 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | 后续阶段生成 | 用于最终验收结论 |

---

## Sources

| 决策 | 来源 | 备注 |
|------|------|------|
| Admin automation contract | `docs/automation-contracts.md` | Scope、idempotency、endpoint envelope |
| Workbench suggestion/apply | `src/lib/services/weekly-workbench.ts`, `src/components/weekly/SuggestionPanel.tsx` | 当前 UI consumer 和 human apply path |
| Apply validation | `src/lib/automation/weekly-suggestions.ts` | content id / duplicate / linked elsewhere checks |
| Redis/job status | `src/lib/jobs/status.ts`, `src/app/api/health/route.ts` | history-only、worker health、degraded semantics |
| Read model boundary | `specs/database-and-search-strategy/data-model.md` | PG/pgvector 不成为事实源 |

# Tasks: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence` | **Date**: 2026-06-08
**Input**: `specs/hermes-weekly-intelligence/spec.md` + `plan.md`
**Prerequisites**: spec.md, plan.md, data-model.md

---

## 执行原则

- 先完成 Admin-side contract，再做 workbench consumer，最后补 workflow replay 和 closeout evidence。
- Hermes skill 本体、NAS 部署命令、hermes-db/PG/pgvector DDL 不在本仓库实现。
- 任何业务写回必须继续走 Admin apply/publish contract；不得让 Hermes 直接写 MySQL 或触发 Quail。
- 不新增 Admin Prisma model / migration，除非实现证明 `automation_runs.result_summary` 无法满足 MVP，且先回到 plan 更新 ADR。

---

## Phase 1: Artifact Schema 与写回边界

**目标**: 先把 Hermes preview artifact、ops report 和 apply 投影变成可校验契约。

- [x] T001 [US2, US4] 定义 Hermes artifact schema 与脱敏边界
  - scope: `src/lib/automation/` 新增或扩展 artifact schema/types；覆盖 `weekly-suggestion.v1`、`weekly-ops-report.v1`、provider、agentRunId、sourceRunId、confidence、evidenceRefs、preferenceRefs、stale/unavailable 状态
  - maps_to: FR-005 / FR-010 / FR-012 / FR-013 / ADR-003 / 安全
  - verify: schema 单测覆盖 valid Hermes artifact、invalid confidence、items > 30、secret-like fields rejected or stripped

- [x] T002 [US2] 扩展 `/api/v1/weekly/suggestions` 支持 Hermes register mode
  - scope: `src/app/api/v1/weekly/suggestions/route.ts`, `src/lib/automation/openapi.ts`
  - maps_to: US2-2 / FR-004 / FR-005 / ADR-001 / ADR-003
  - verify: API 测试覆盖默认 generate mode 兼容、`mode: "register"` 保存/返回 preview artifact、idempotency replay、schema invalid 返回 400

- [x] T003 [US2, US4] 在 register/apply 前校验当前 Admin 状态
  - scope: `src/lib/automation/weekly-suggestions.ts` 或新增 adapter helper
  - maps_to: US2-5 / US4-4 / 一致性
  - verify: 测试覆盖 invalid content id、linked elsewhere、duplicate content id、stale artifact 被拒或标记 stale，最终写入仍只发生在 apply

- [x] T004 [US2, US3] 扩展 apply payload 的来源追踪
  - scope: `SuggestionApplySchema`, `/api/v1/weekly/suggestions/[id]/apply`, workbench apply wrapper
  - maps_to: FR-012 / NFR-003 / ADR-002
  - verify: sourceRunId/agentRunId 可选传入并进入 automation run request/result summary；不改变 `weekly_content_items` 写入字段

- [x] T005 [US4] 固定不新增 Admin DB DDL 的 guard
  - scope: `prisma/`, `database/`, `specs/hermes-weekly-intelligence/data-model.md`
  - maps_to: FR-008 / FR-009 / ADR-002 / 可演进性
  - verify: diff 中没有 Hermes PG/pgvector Prisma model、migration 或 `database/*.sql`；如出现必须回到 plan 复审

---

## Phase 2: Workbench Suggestion Consumer

**目标**: 让 Admin 工作台能消费 Hermes artifact，同时保留现有 Admin organizer fallback。

- [x] T006 [US2] 为 workbench service 提供 latest Hermes suggestion preview
  - scope: `src/lib/services/weekly-workbench.ts`
  - maps_to: US2-2 / US2-3 / ADR-004 / 可解释性
  - verify: service 测试覆盖读取最新 `automation_runs.result_summary` 中的 Hermes preview、无 artifact 时返回 null、stale artifact 标识

- [x] T007 [US2] 更新 workbench suggest route 的 provider 语义
  - scope: `src/app/api/weekly/workbench/[id]/suggest/route.ts`
  - maps_to: ADR-005 / NFR-002
  - verify: 现有“生成建议”仍走 Admin fallback；响应包含 provider/source metadata，旧 UI 不因缺字段失败

- [x] T008 [US2, US3] 扩展 `SuggestionPanel` 展示 Hermes 解释信息
  - scope: `src/components/weekly/SuggestionPanel.tsx`
  - maps_to: US2-2 / US3-2 / FR-006 / 可解释性
  - verify: UI 测试覆盖 provider badge、confidence、evidence refs、preference refs、stale/unavailable 状态、apply success/skipped/rejected 展示

- [x] T009 [US2] 保持人工 apply 为唯一写回入口
  - scope: `src/components/weekly/SuggestionPanel.tsx`, `src/app/api/weekly/workbench/[id]/apply/route.ts`
  - maps_to: US2-3 / FR-004 / NFR-001
  - verify: 测试证明 preview 渲染不写 `weekly_content_items`；只有点击 apply 后调用 apply wrapper

---

## Phase 3: Ops Report Surface

**目标**: 把 Hermes ops report 放进现有 runs/job health surface，不新增完整任务中心。

- [x] T010 [US3] 提供 ops report preview 读取与状态分类
  - scope: `src/lib/services/weekly-workbench.ts`, `src/lib/jobs/status.ts` 只读适配
  - maps_to: US3-1 / FR-010 / NFR-003
  - verify: service 测试覆盖 dependency unavailable、history-only、stale data、worker degraded、candidate empty 的分类

- [x] T011 [US3] 在 runs/job health 区域展示 ops report
  - scope: `src/components/weekly/AutomationRunTimeline.tsx` 或相邻 workbench component
  - maps_to: US3-2 / ADR-004 / 用户可见输出
  - verify: UI 测试覆盖摘要、风险、下一步建议、run/job id、引用不存在时的不可定位状态

- [x] T012 [US3] 确认 Hermes/PG down 不阻塞手动流程
  - scope: Workbench loading/error handling
  - maps_to: US3-3 / NFR-002 / 可用性
  - verify: 测试覆盖 Hermes artifact/report 加载失败时，候选池、Admin fallback suggestion、手动 apply/publish surface 仍可用

---

## Phase 4: Contract Docs 与 OpenAPI

**目标**: 让外部 Hermes runtime 能按机器可读和人类文档调用 Admin API。

- [x] T013 [US1, US2, US3] 更新 automation contract 文档
  - scope: `docs/automation-contracts.md`
  - maps_to: FR-001 / FR-002 / FR-003 / FR-011 / FR-014
  - verify: 文档明确 Hermes token scopes、register mode、apply 人工确认、publish scope 默认不授予、ops report 状态 taxonomy

- [x] T014 [US2] 更新 OpenAPI contract
  - scope: `src/lib/automation/openapi.ts`, `/api/v1/openapi.json` tests
  - maps_to: FR-005 / ADR-001
  - verify: OpenAPI 测试覆盖 `mode: register`、Hermes artifact schema、apply path 参数语义为 weeklyIssueId

- [x] T015 [US4] 保留 Hermes runtime/repo 作为外部前提
  - scope: `specs/hermes-weekly-intelligence/plan.md`, `data-model.md`, docs
  - maps_to: FR-014 / ADR-002
  - verify: docs 不承诺 Admin repo 内创建 Hermes skill、NAS service、PG migration；只记录外部前提和 contract

---

## Phase 5: Workflow Replay 与质量门

**目标**: 用可复现测试证明 artifact handoff、人工写回和降级路径闭环。

- [x] T016 [US1] 覆盖 feedback digest 学习输入路径
  - scope: `src/app/api/v1/ai/feedback/digest/route.test.ts` 或相关 contract tests
  - maps_to: US1-1 / US1-3 / NFR-005
  - verify: digest succeeded/empty、date range invalid、ops:read scope、markdown/json 输出不泄密

- [x] T017 [US2] 覆盖 suggestion artifact end-to-end replay
  - scope: API route tests + workbench service tests
  - maps_to: US2-1 / US2-2 / US2-3 / Producer-Consumer Matrix
  - verify: candidates -> Hermes register -> workbench preview -> human apply -> `weekly_content_items` 更新；invalid/stale path 有拒绝原因

- [x] T018 [US3] 覆盖 ops report replay
  - scope: service/UI tests for job status and runs
  - maps_to: US3-1 / US3-2 / US3-4 / US3-5
  - verify: Redis status expired 时显示 history-only；worker heartbeat stale 和 job unavailable 不阻塞 workbench

- [x] T019 [US4] 执行安全与事实源扩散检查
  - scope: tests + diff review
  - maps_to: FR-008 / FR-009 / FR-013 / NFR-004
  - verify: 无 secret 泄漏、无 PG/Prisma 误建表、无 direct MySQL write outside Admin services、无 publish scope 混入 planner path

- [x] T020 [Quality] 运行静态与 focused 测试
  - scope: touched tests, `./node_modules/.bin/eslint .`, `pnpm type-check`
  - maps_to: NFR-005 / closeout evidence
  - verify: focused API/UI/service tests PASS；type-check PASS；eslint 无新增 error

---

## Phase 6: SDD 收尾准备

**目标**: 让 verify/closeout 有足够证据，不把文档状态停在实现完成前。

- [x] T021 [Closeout] 更新 Hermes feature artifacts
  - scope: `specs/hermes-weekly-intelligence/spec.md`, `plan.md`, `tasks.md`, `data-model.md`
  - maps_to: SDD readiness / architecture drift
  - verify: artifact 与最终实现一致；Stage Readiness 指向 verify/closeout；无过期 `[NEEDS CLARIFICATION]`

- [x] T022 [Closeout] 生成 acceptance evidence
  - scope: `specs/hermes-weekly-intelligence/acceptance.md`
  - maps_to: trait Evidence Gate / Workflow Replay / 三维 Verdict
  - verify: Component / Workflow / User-Visible Outcome 均有 PASS/FAIL 证据；残余风险和 deferred 外部 Hermes runtime 明确记录

- [x] T023 [Roadmap] 回写 admin modernization roadmap
  - scope: `specs/admin-modernization-roadmap/tasks.md`, `plan.md` 如需
  - maps_to: T015 / roadmap current feature
  - verify: roadmap 标记 Hermes feature 结果，推荐下一项或 roadmap closeout；不自动提交

---

## 依赖与顺序

- T001 必须先于 T002/T003/T008/T014。
- T002-T004 是 contract 关键路径，先于 workbench consumer 和 replay tests。
- T006-T009 可以在 T002/T003 后并行推进。
- T010-T012 可以与 suggestion UI 并行，但 verify 必须等 T017/T018 完成。
- T013/T014 应随 API schema 同步更新，不能留到 closeout 才补。
- T019-T020 是进入 verify 前的质量门。
- T021-T023 只在实现和验证收口后执行。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 偏好学习输入与空反馈 | T001, T013, T016 |
| US2 可人工确认的周刊建议 | T001-T009, T014, T017 |
| US3 可解释复盘与降级 | T010-T012, T018 |
| US4 读模型不成为事实源 | T005, T015, T019, T022 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 Admin API 写回边界 | T002, T004, T009 | T017, T019 |
| ADR-002 外部 read model ownership | T005, T015 | T019, T022 |
| ADR-003 preview 后人工 apply | T002, T008, T009 | T017 |
| ADR-004 复用 workbench surface | T006, T008, T011 | T012, T018 |
| ADR-005 Admin organizer fallback | T007, T012 | T020 |
| 安全 / 脱敏 | T001, T013 | T019 |
| 可用性 / 降级 | T010-T012 | T018 |

---

## Context Manifest

- 已生成 [context-manifest.md](context-manifest.md)。
- 进入 implement 前必须读取 Implement Context；进入 verify 前必须读取 Check Context。

---

## Stage Readiness

- 推荐下一步：`closeout admin-modernization-roadmap`
- 阻塞项：无；当前 feature 已 PASS closeout，commit plan 已生成但未提交，下一步做 roadmap closeout。

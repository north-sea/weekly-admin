# Tasks: Admin Modernization Roadmap

**Workspace**: `admin-modernization-roadmap` | **Date**: 2026-06-02  
**Input**: `specs/admin-modernization-roadmap/spec.md` + `plan.md`  
**Prerequisites**: spec.md, plan.md

---

## 执行原则

- 本文件是 roadmap 级任务清单，负责推进 feature 拆分和顺序治理。
- 具体代码实现必须进入对应独立 feature 工作区，不在本 umbrella workspace 里直接展开。
- 关键路径是 `next16-upgrade-baseline`，它必须先于 UI/API/自动化大改造。
- 每个执行 feature 完成后，都要回到本 roadmap 更新状态和依赖影响。

---

## Phase 1: Roadmap 工作区收口

**目标**: 确保本 umbrella workspace 足以指导后续 feature 拆分。

- [x] T001 [US1] 创建 `admin-modernization-roadmap` spec
  - scope: `specs/admin-modernization-roadmap/spec.md`, `specs/.active`
  - maps_to: US1 / FR-001
  - verify: `spec.md` 存在且 `.active` 指向 `admin-modernization-roadmap`

- [x] T002 [US1] 创建 roadmap plan
  - scope: `specs/admin-modernization-roadmap/plan.md`
  - maps_to: FR-001 / ADR-001..ADR-006 / Producer-Consumer Matrix
  - verify: `plan.md` 包含执行顺序、ADR、Producer-Consumer Matrix、验证策略

- [x] T003 [US1] 固化已澄清决策
  - scope: `specs/admin-modernization-roadmap/spec.md`
  - maps_to: Next.js 16 build 策略 / UI 风格 / n8n-Hermes 范围 / 图片字段 drop / Meilisearch optional
  - verify: `spec.md` 的 Clarified Decisions 覆盖上述决策

---

## Phase 2: 创建第一优先级 feature 工作区

**目标**: 将 Next.js 16 升级从 roadmap 拆成可执行 feature。

- [x] T004 [US2] 创建 `next16-upgrade-baseline` spec
  - scope: `specs/next16-upgrade-baseline/spec.md`, `specs/.active`
  - maps_to: US2 / FR-002 / ADR-001
  - verify: spec 明确 Next 15 -> 16 升级范围、非目标和验收命令

- [x] T005 [US2] 为 `next16-upgrade-baseline` 生成 plan
  - scope: `specs/next16-upgrade-baseline/plan.md`
  - maps_to: ADR-001 / Next.js 16 官方迁移点
  - verify: plan 覆盖 dependency upgrade、`middleware` -> `proxy`、`next lint` 替换、`next typegen`、Turbopack build 和 webpack 回退

- [x] T006 [US2] 为 `next16-upgrade-baseline` 生成 tasks
  - scope: `specs/next16-upgrade-baseline/tasks.md`
  - maps_to: US2 acceptance / NFR-001
  - verify: tasks 可直接进入 execute-plan/implement

---

## Phase 3: 创建产品表层 feature 工作区

**目标**: 拆出 UI 壳层、周刊工作台和图片退役。

- [x] T007 [US3] 创建并完成 `admin-shell-and-weekly-workbench`
  - scope: `specs/admin-shell-and-weekly-workbench/spec.md`
  - maps_to: US3 / FR-008 / ADR-002
  - verify: spec/plan/tasks/acceptance 已存在；dashboard/workbench UI wrapper、automation runs、publish checklist、legacy 降噪、无图片回归和 responsive evidence 已完成；`pnpm lint`, `pnpm type-check`, targeted API/UI tests 通过

- [x] T008 [US5] 创建并完成 `image-feature-retirement`
  - scope: `specs/image-feature-retirement/spec.md`
  - maps_to: US5 / FR-009 / ADR-006
  - verify: spec/plan/tasks/acceptance 已存在；Admin 图片上传/裁剪/AI 图片/主图/封面/Quail 图片输出和图片专用依赖已退役；`pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` 通过；字段 drop 后置条件已记录

- [x] T009 [US3, US5] 评估 UI 与图片退役并行边界
  - scope: `admin-shell-and-weekly-workbench` 与 `image-feature-retirement`
  - maps_to: 质量属性：用户体验 / 可演进性
  - verify: `image-feature-retirement` 已先完成；`admin-shell-and-weekly-workbench` 应基于无图片模型重新 specify，不再承载 legacy image surface

---

## Phase 4: 创建自动化契约与搜索策略工作区

**目标**: 在不开发 NAS workflow 的前提下，先固定 Admin 侧契约。

- [x] T010 [US4] 创建并完成 `agent-and-automation-contracts` spec
  - scope: `specs/agent-and-automation-contracts/spec.md`
  - maps_to: US4 / FR-006 / FR-007 / FR-010 / FR-011 / ADR-004
  - verify: spec/plan/tasks/acceptance 已存在；automation token、scope、OpenAPI、idempotency、automation_runs、operation log mirror、`/api/v1` endpoint、live smoke 均通过；commit `1f38443`

- [x] T011 [US4] 创建并完成 `database-and-search-strategy` 工作区
  - scope: `specs/database-and-search-strategy/spec.md`
  - maps_to: FR-003 / FR-004 / FR-005 / FR-013 / FR-014 / ADR-003 / ADR-005
  - verify: spec/plan/tasks/acceptance/assessment 已存在；Meilisearch optional、health degraded、MySQL fallback、Admin index isolation 和 NAS runtime smoke 均通过

- [x] T012 [US4] 记录 NAS Meilisearch 复用约束
  - scope: `specs/database-and-search-strategy/spec.md`
  - maps_to: ADR-005
  - verify: database/search plan 和 acceptance 已记录独立 index、optional backend、NAS 网络接入不在本 feature 内；部署后 smoke 证明未接入 Meili 时 Admin 可降级运行

---

## Phase 5: 创建执行控制与 Hermes 智能工作区

**目标**: 在 API 契约稳定后，为 Redis job 和 Hermes 建议创建后续 feature。

- [x] T013 [US4] 创建并完成 `redis-job-orchestration`
  - scope: `specs/redis-job-orchestration/spec.md`
  - maps_to: FR-005 / 可观测性 / Producer-Consumer Matrix
  - verify: spec/plan/tasks/data-model/acceptance 已存在；sync/score 第一批 job 化、BullMQ worker、job status/retry、Redis lock/rate limit、worker health、OpenAPI/docs 和真实 Redis/app/worker smoke 均已通过；acceptance 为 PASS

- [x] T014 [US4] 创建 `hermes-weekly-intelligence` spec
  - scope: `specs/hermes-weekly-intelligence/spec.md`
  - maps_to: FR-004 / FR-007 / ADR-004
  - verify: spec 已存在并明确 Hermes skills、hermes-db/pgvector 读模型、建议展示、人工确认写回、MySQL 事实源边界；clarify 已确认 Hermes runtime/repo/DB 归属边界、suggestion artifact 主路径和 ops report UI 入口

- [x] T015 [US4] 定义 Hermes 产物消费闭环
  - scope: `hermes-weekly-intelligence` plan
  - maps_to: artifact-handoff / Producer-Consumer Matrix
  - verify: `specs/hermes-weekly-intelligence/plan.md` 已定义 Producer-Consumer Matrix、Hermes/Admin/PG 边界 ADR、artifact register 主路径、workbench UI consumer、人工 apply 写回和 degraded workflow replay；`data-model.md` 与 `tasks.md` 已补齐

---

## Phase 6: 既有 feature 对齐

**目标**: 将已有 SDD 工作区纳入现代化路线，而不是重复创建。

> Deferred follow-up: `security-and-runtime-hardening` 暂不进入主线排序。生产 secrets/API keys 轮换和 Meili timeout/circuit breaker 保留为单独风险事项，不阻塞下面的主线 feature。

- [x] T016 [F8] 完成 `inbox-ai-scoring-continuation` 收口
  - scope: `specs/inbox-ai-scoring/spec.md`, `plan.md`, `tasks.md`
  - maps_to: FR-012 / Producer: AI scoring
  - verify: `specs/inbox-ai-scoring-continuation/acceptance.md` 为 CONDITIONAL PASS；R3 UI evidence 已由 agent-browser `/inbox` snapshot 补齐；T105 DB 口径已由 doctor/backfill 修复为 `scored_total=211` / `scored_done=211` / `processing=0`；runtime health/digest/score-batch contract 已记录。代表性 `score-batch` 样本仍因上游 `405 Not Allowed` 失败，归为后续内容抓取质量跟进，不阻塞本 continuation。

- [x] T017 [F7] 复核 `migration-tooling-baseline` 当前状态
  - scope: `specs/migration-tooling-baseline/spec.md`
  - maps_to: FR-012 / 可演进性
  - verify: `migration-tooling-baseline` 已 PASS；GitHub Actions run `26896308413` / deploy job `79336833413` 证明 deploy 前 migration 工作流通过；roadmap plan 已新增 Post-F7 Reassessment，明确后续 schema change 必须走 Prisma Migrate

---

## Phase 7: Roadmap 收尾与切换

**目标**: 准备进入第一个执行 feature。

- [x] T018 切换 active feature 到 `next16-upgrade-baseline`
  - scope: `specs/.active`
  - maps_to: Recommended Execution Order
  - verify: `.active` 指向 `next16-upgrade-baseline`

- [x] T019 启动并完成 `next16-upgrade-baseline` execute-plan
  - scope: `specs/next16-upgrade-baseline/tasks.md`, `acceptance.md`
  - maps_to: Stage Readiness / closeout
  - verify: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` 通过；proxy smoke 通过；无未完成任务

- [x] T020 Roadmap 状态回写
  - scope: `specs/admin-modernization-roadmap/tasks.md`
  - maps_to: 可演进性 / closeout
  - verify: 2026-06-02 已根据 F0 结果回写推荐顺序和残余风险

- [x] T021 Post-F0 feature 顺序复评
  - scope: `specs/admin-modernization-roadmap/plan.md`
  - maps_to: 可演进性 / Recommended Execution Order
  - verify: plan 已新增 Post-F0 Reassessment，并把后续顺序调整为 F6 -> F7 -> F8 -> F2 -> F1 -> F5 -> F3 -> F4

- [x] T022 完成 `database-and-search-strategy` 并回写 Post-F6 复评
  - scope: `specs/database-and-search-strategy/*`, `specs/admin-modernization-roadmap/plan.md`, `tasks.md`
  - maps_to: ADR-003 / ADR-005 / 可用性 / 安全
  - verify: database/search acceptance 为 PASS；roadmap 已新增 Post-F6 Reassessment 和新推荐顺序

- [x] T023 完成 `migration-tooling-baseline` 并回写 Post-F7 复评
  - scope: `specs/migration-tooling-baseline/*`, `specs/admin-modernization-roadmap/plan.md`, `tasks.md`
  - maps_to: 可演进性 / Recommended Execution Order / deploy evidence
  - verify: migration baseline acceptance 为 PASS；roadmap 已新增 Post-F7 Reassessment；后续主线顺序移除已完成的 `migration-tooling-baseline`

- [x] T024 完成 `agent-and-automation-contracts` 并回写 Post-F2 复评
  - scope: `specs/agent-and-automation-contracts/*`, `specs/admin-modernization-roadmap/plan.md`, `tasks.md`, `docs/automation-plan-admin.md`
  - maps_to: ADR-004 / Recommended Execution Order / automation contract evidence
  - verify: automation contract acceptance 为 PASS；commit `1f38443`；roadmap 已新增 Post-F2 Reassessment；后续主线顺序移除已完成的 `agent-and-automation-contracts`

- [x] T025 完成 `redis-job-orchestration` 并回写 Post-F3 复评
  - scope: `specs/redis-job-orchestration/*`, `specs/admin-modernization-roadmap/plan.md`, `tasks.md`, `docs/automation-plan-admin.md`, `docs/nas-deployment.md`
  - maps_to: ADR-004 / 可观测性 / Recommended Execution Order
  - verify: Redis job acceptance 为 PASS；runtime smoke run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` 证明 submit -> worker -> retry -> terminal `automation_runs` -> status/health 闭环；roadmap plan 已新增 Post-F3 Reassessment；下一推荐为 `hermes-weekly-intelligence`

- [x] T026 完成 `admin-modernization-roadmap` closeout
  - scope: `specs/admin-modernization-roadmap/acceptance.md`, `commit-plan.md`, `plan.md`, `tasks.md`, `specs/.active`
  - maps_to: roadmap closeout / Completion Record / Commit Planning Rules
  - verify: 主线 feature 均已有 acceptance；roadmap acceptance 为 PASS；`.active` 指回 `admin-modernization-roadmap`；commit plan 已生成但未提交

---

## 依赖与顺序

- F0、F6、F7、F8、F2、F5、F1、F3、T015 和 `hermes-weekly-intelligence` implementation 已完成，新的关键路径：无主线 feature，roadmap 已进入 closeout。
- `security-and-runtime-hardening` 暂不进入主线排序；secret rotation 和 Meili timeout/circuit breaker 保留为 deferred follow-up。
- T016 已完成；UI 工作台、Agent 契约和 Hermes 可以消费其稳定输出，但应注意 representative scoring replay 中仍存在上游 `405 Not Allowed` 内容抓取质量问题。
- T008/T009 已完成：图片入口、写入、副作用 API、发布图片输出和依赖已退役；字段 drop 作为后续 migration slice。
- T007 已完成：新版工作台已消费 `/api/v1/weekly/candidates`、`/api/v1/weekly/suggestions`、`/api/v1/weekly/suggestions/{id}/apply`、`/api/v1/weekly/publish` 和 automation run 状态，不再围绕 legacy auto-link/图片入口设计。
- T013 已完成 closeout：`/api/v1/jobs/sync` 与 `/api/v1/jobs/score` 已迁入 Redis/BullMQ submit + independent worker，状态、重试、health 和 `automation_runs` durable evidence 已通过 runtime replay。
- T014/T015 与 `hermes-weekly-intelligence` implementation 已完成：Hermes 可登记 preview artifact，Admin workbench 可展示 Hermes 建议/证据/置信度和 ops report，人工 apply 仍是唯一写回路径；验收为 PASS。
- T026 已完成：roadmap closeout 记录、Knowledge Capture、延后项和 commit plan 已写入本 workspace。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 roadmap 拆分 | T001, T002, T003 |
| US2 Next.js 16 升级 | T004, T005, T006, T018, T019 |
| US3 周刊驾驶舱 | T007, T009 |
| US4 n8n/Hermes/Redis/PG 接入边界 | T010, T011, T012, T013, T014, T015 |
| US5 图片退役与 drop | T008, T009 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 Next.js 16 | T004, T005, T006 | T019 |
| ADR-002 UI 基线 | T007 | T009 |
| ADR-003 数据库职责 | T011 | T012 |
| ADR-004 自动化边界 | T010, T013, T014 | T015 |
| ADR-005 Meilisearch optional | T011, T012 | T012 |
| ADR-006 图片字段 drop | T008 | T009 |
| 可演进性 | T001-T020 | T020 |
| 可观测性 | T013 | T015 |
| 安全 | T010 | T015 |

---

## Notes

- 本 tasks.md 的任务重点是“创建和治理子 feature”。不要在本 roadmap workspace 中直接进行 Next.js 升级或 UI 改造。
- `next16-upgrade-baseline`、`database-and-search-strategy`、`migration-tooling-baseline`、`inbox-ai-scoring-continuation`、`agent-and-automation-contracts`、`image-feature-retirement`、`admin-shell-and-weekly-workbench`、`redis-job-orchestration` 与 `hermes-weekly-intelligence` 已完成，后续不再作为 active implementation 目标。
- 新推荐顺序：无主线 feature。后续只能选择 deferred follow-up 重新 `specify` 或提出新需求。
- Deferred follow-up：`security-and-runtime-hardening`。

---

## Stage Readiness

- 推荐下一步：无新的主线 feature；如需继续，请从 deferred follow-up 中选择一个独立 feature
- 阻塞项：无
- 执行建议：roadmap closeout 已完成；提交前必须先处理 `commit-plan.md` 中的用户决策项，且不得自动 push。

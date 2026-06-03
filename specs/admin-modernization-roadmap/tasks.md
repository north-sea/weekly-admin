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

- [ ] T007 [US3] 创建 `admin-shell-and-weekly-workbench` spec
  - scope: `specs/admin-shell-and-weekly-workbench/spec.md`
  - maps_to: US3 / FR-008 / ADR-002
  - verify: spec 明确以 `nextjs-tpl` 为主的 UI 风格、导航重组、首页驾驶舱、周刊工作台验收场景

- [ ] T008 [US5] 创建 `image-feature-retirement` spec
  - scope: `specs/image-feature-retirement/spec.md`
  - maps_to: US5 / FR-009 / ADR-006
  - verify: spec 明确隐藏入口、停止新写入、清读取点、依赖删除、字段 drop 的阶段顺序

- [ ] T009 [US3, US5] 评估 UI 与图片退役并行边界
  - scope: `admin-shell-and-weekly-workbench` 与 `image-feature-retirement`
  - maps_to: 质量属性：用户体验 / 可演进性
  - verify: 两个 feature 的 plan 不争用同一批文件，或明确先后顺序

---

## Phase 4: 创建自动化契约与搜索策略工作区

**目标**: 在不开发 NAS workflow 的前提下，先固定 Admin 侧契约。

- [ ] T010 [US4] 创建 `agent-and-automation-contracts` spec
  - scope: `specs/agent-and-automation-contracts/spec.md`
  - maps_to: US4 / FR-006 / FR-007 / FR-010 / FR-011 / ADR-004
  - verify: spec 明确 API token、scope、OpenAPI、dry-run、idempotency、operation log

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

- [ ] T013 [US4] 创建 `redis-job-orchestration` spec
  - scope: `specs/redis-job-orchestration/spec.md`
  - maps_to: FR-005 / 可观测性 / Producer-Consumer Matrix
  - verify: spec 明确 job 类型、状态、锁、rate limit、任务中心和现有 cron 过渡策略

- [ ] T014 [US4] 创建 `hermes-weekly-intelligence` spec
  - scope: `specs/hermes-weekly-intelligence/spec.md`
  - maps_to: FR-004 / FR-007 / ADR-004
  - verify: spec 明确 Hermes skills、hermes-db/pgvector 读模型、建议展示和人工确认写回

- [ ] T015 [US4] 定义 Hermes 产物消费闭环
  - scope: `hermes-weekly-intelligence` plan
  - maps_to: artifact-handoff / Producer-Consumer Matrix
  - verify: Hermes suggestion 必须有 Admin UI consumer 和人工确认路径

---

## Phase 6: 既有 feature 对齐

**目标**: 将已有 SDD 工作区纳入现代化路线，而不是重复创建。

> Deferred follow-up: `security-and-runtime-hardening` 暂不进入主线排序。生产 secrets/API keys 轮换和 Meili timeout/circuit breaker 保留为单独风险事项，不阻塞下面的主线 feature。

- [ ] T016 [F8] 复核 `inbox-ai-scoring` 当前任务状态
  - scope: `specs/inbox-ai-scoring/spec.md`, `plan.md`, `tasks.md`
  - maps_to: FR-012 / Producer: AI scoring
  - verify: 标记 R3 Admin UI、T105 DB 回填查询、逐条耗时/P95、NAS runtime smoke 是否补齐；明确是否需要因 Redis/Hermes/API 契约调整

- [ ] T017 [F7] 复核 `migration-tooling-baseline` 当前状态
  - scope: `specs/migration-tooling-baseline/spec.md`
  - maps_to: FR-012 / 可演进性
  - verify: 明确应在 Agent API、image field drop、Redis job 前推进 Prisma migrate baseline；把 schema drift/Prisma relation mismatch 作为 Post-F6 新证据写入 plan

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

---

## 依赖与顺序

- F0 与 F6 已完成，新的关键路径：T017 -> T016 -> T010 -> T008 -> T007 -> T013/T014。
- `security-and-runtime-hardening` 暂不进入主线排序；secret rotation 和 Meili timeout/circuit breaker 保留为 deferred follow-up。
- T017 需要提前，因为 Post-F6 authenticated search smoke 暴露了 Prisma relation name 假设错误，后续 feature 会继续改 schema，必须先建立迁移基线和 drift 检查。
- T016 需要提前，因为 `inbox-ai-scoring` 已基本实现，但 acceptance 仍有 UI/runtime/DB 查询证据缺口；UI 工作台和 Agent 契约应消费其稳定输出。
- T010 应在 UI 和 Hermes 前完成，因为 n8n/Hermes/MCP 需要稳定 token scope、OpenAPI、idempotency 和 audit。
- T008 现在早于 T007，因为周刊去图片后应先退役 legacy 图片入口和写入路径，再设计新的周刊工作台。
- T013/T014 仍后置：Redis/Hermes 应消费稳定契约、评分输出和人工确认 UI，不抢先成为事实源。

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
- `next16-upgrade-baseline` 与 `database-and-search-strategy` 已完成，后续不再作为 active implementation 目标。
- 新推荐顺序：`migration-tooling-baseline` -> `inbox-ai-scoring-continuation` -> `agent-and-automation-contracts` -> `image-feature-retirement` -> `admin-shell-and-weekly-workbench` -> `redis-job-orchestration` -> `hermes-weekly-intelligence`。
- Deferred follow-up：`security-and-runtime-hardening`。

---

## Stage Readiness

- 推荐下一步：`specify`
- 阻塞项：无
- 执行建议：优先推进 `migration-tooling-baseline`，把 Prisma migrate baseline 和 schema drift 检查落地。

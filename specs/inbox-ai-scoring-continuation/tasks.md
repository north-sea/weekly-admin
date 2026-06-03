# Tasks: Inbox AI Scoring Continuation

**Workspace**: `inbox-ai-scoring-continuation` | **Date**: 2026-06-04
**Input**: `specs/inbox-ai-scoring-continuation/spec.md` + `plan.md`
**Prerequisites**: spec.md, plan.md

---

## 执行原则

- 不重写 F1 评分系统。
- 不新增旧 `database/*.sql` schema 变更。
- 先修代码和 dry-run doctor,真实 DB apply 需显式执行。
- 每个修复都要有 evidence。

---

## Phase 1: SDD 工作区

**目标**: 建立独立 continuation feature 工作区。

- [x] T001 创建 `spec.md`
  - scope: `specs/inbox-ai-scoring-continuation/spec.md`
  - maps_to: roadmap Post-F7
  - verify: spec 明确不是重写 F1

- [x] T002 创建 `plan.md`
  - scope: `specs/inbox-ai-scoring-continuation/plan.md`
  - maps_to: FR-001..FR-008
  - verify: plan 覆盖 settings、sweep、doctor/backfill、evidence

- [x] T003 创建 `tasks.md`
  - scope: `specs/inbox-ai-scoring-continuation/tasks.md`
  - maps_to: Stage readiness
  - verify: tasks 可直接执行

## Phase 2: 代码修复

**目标**: 修复 closeout blockers 的代码层缺口。

- [x] T101 补 F1 scoring settings 默认值
  - scope: `src/lib/services/ai-settings.ts`
  - maps_to: US1 / FR-001 / FR-002
  - verify: `ai-settings` unit tests

- [x] T102 增强 `sweepStaleProcessing`
  - scope: `src/lib/services/inbox-scoring.ts`
  - maps_to: US2 / FR-003
  - verify: `inbox-scoring` unit tests assert SQL covers missing/invalid/timeout timestamps

- [x] T103 新增 doctor/backfill 脚本
  - scope: `scripts/doctor-inbox-scoring.js`
  - maps_to: US3 / FR-004 / FR-005 / FR-006
  - verify: dry-run command outputs JSON report

## Phase 3: 测试与验证

**目标**: 用自动化和 runtime evidence 证明修复有效。

- [x] T201 补 settings 单元测试
  - scope: `src/lib/services/__tests__/ai-settings.test.ts`
  - maps_to: US1
  - verify: `pnpm -s test src/lib/services/__tests__/ai-settings.test.ts --run`

- [x] T202 补 sweep/doctor 相关测试
  - scope: `src/lib/services/__tests__/inbox-scoring.test.ts`
  - maps_to: US2
  - verify: `pnpm -s test src/lib/services/__tests__/inbox-scoring.test.ts --run`

- [x] T203 运行静态验证
  - scope: whole repo
  - maps_to: NFR-001
  - verify: `pnpm -s type-check`

- [x] T204 采集 DB dry-run evidence
  - scope: `scripts/doctor-inbox-scoring.js`
  - maps_to: US3
  - verify: dry-run report captured in acceptance

- [x] T205 可选执行 DB apply evidence
  - scope: true DB state
  - maps_to: US3
  - verify: apply 后 before/after report captured;需显式许可

- [x] T206 采集 runtime/API/UI evidence
  - scope: local dev server + `/inbox`
  - maps_to: US4
  - verify: curl/API payload and browser/code UI evidence captured

## Phase 4: Closeout

**目标**: 完成 acceptance 和 roadmap 回写。

- [ ] T301 创建 `acceptance.md`
  - scope: `specs/inbox-ai-scoring-continuation/acceptance.md`
  - maps_to: US4 / closeout
  - verify: Evidence Table + 三维 Verdict + Workflow Replay

- [ ] T302 更新 roadmap T016
  - scope: `specs/admin-modernization-roadmap/tasks.md`
  - maps_to: roadmap governance
  - verify: T016 状态与 acceptance 一致

---

## 依赖与顺序

- T101/T102 可并行。
- T103 依赖 T102 的回收条件语义。
- T201/T202 依赖对应代码修复。
- T205 依赖用户确认或显式授权。
- T301 依赖 T203/T204/T206,若 T205 未执行则 acceptance 必须说明。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|---|---|
| US1 settings 默认兜底 | T101, T201 |
| US2 processing 回收 | T102, T202 |
| US3 DB doctor/backfill | T103, T204, T205 |
| US4 evidence closeout | T206, T301, T302 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|---|---|---|
| 不重写 F1 | T001, T002 | T301 |
| 不改 schema | T002, T103 | T203 |
| dry-run 默认 | T103 | T204 |

---

## Stage Readiness

- 推荐下一步: `implement`
- 阻塞项: DB apply 需要显式许可;不阻塞 dry-run 和代码修复。

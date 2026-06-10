# Commit Plan: Admin Modernization Roadmap

**Workspace**: `admin-modernization-roadmap`
**Date**: 2026-06-08
**Status**: Awaiting User Confirmation

> Commit plan 是提交前的用户确认 gate。未获得用户明确确认前，不得执行 `git add` 或 `git commit`。

---

## Summary

本计划只覆盖 roadmap closeout 文档和 active feature 切换。当前工作树包含大量子 feature 代码、文档、删除和未跟踪文件；这些不自动纳入本 roadmap closeout commit。

用户已选择先处理子 feature。子 feature 的提交队列和冲突见 [child-feature-commit-queue.md](child-feature-commit-queue.md)。

由于用户已选择先处理子 feature，本计划保持 blocked until child batches submitted。roadmap closeout 不应早于 product-surface、runtime-config、redis-jobs、hermes-contract 批次。

---

## Included Files

| File | Reason | Evidence |
|---|---|---|
| `specs/.active` | closeout 时将 active feature 指回 umbrella roadmap，避免继续默认续接已完成的 Hermes feature。 | SDD continuation / closeout 规则；[tasks.md](tasks.md) T026。 |
| `specs/admin-modernization-roadmap/spec.md` | 更新 Stage Readiness 为最终 closeout 状态，避免后续续接误读为还需进入 plan。 | [acceptance.md](acceptance.md) Completion Record。 |
| `specs/admin-modernization-roadmap/plan.md` | 新增 Final Roadmap Closeout，汇总主线最终状态、无下一主线 feature 和 deferred follow-up。 | [acceptance.md](acceptance.md) Evidence Table。 |
| `specs/admin-modernization-roadmap/tasks.md` | 新增 T026 并更新 Stage Readiness，记录 roadmap closeout 已完成。 | [acceptance.md](acceptance.md) Completion Record。 |
| `specs/admin-modernization-roadmap/acceptance.md` | Roadmap 最终 completion record。 | 本 closeout 产物。 |
| `specs/admin-modernization-roadmap/commit-plan.md` | 提交前确认 gate。 | SDD closeout commit planning rule。 |
| `specs/admin-modernization-roadmap/child-feature-commit-queue.md` | 记录用户选择“先处理子 feature”后的子 feature 提交队列和归属冲突。 | 本轮子 feature commit planning。 |
| `specs/admin-modernization-roadmap/product-surface-commit-plan.md` | 记录用户确认 Option B 后的 product-surface 综合批次。 | 本轮子 feature commit planning。 |
| `specs/admin-modernization-roadmap/runtime-dependency-config-commit-plan.md` | 记录 product-surface 后的 runtime dependency/config 批次。 | 本轮子 feature commit planning。 |
| `specs/redis-job-orchestration/commit-plan.md` | 记录 Redis backend/runtime 批次的刷新后提交边界。 | 子 feature commit planning。 |
| `specs/hermes-weekly-intelligence/commit-plan.md` | 记录 Hermes automation contract 批次的刷新后提交边界。 | 子 feature commit planning。 |

---

## Excluded Files

| File | Reason |
|---|---|
| `src/**` | 当前 roadmap closeout 不修改业务代码；工作树中的代码改动属于子 feature 或既有 dirty work。 |
| `docs/**` | 本次 closeout 不新增自动化/NAS 文档内容；相关 docs 已由子 feature 维护。 |
| `specs/hermes-weekly-intelligence/**` | Hermes 子 feature 已有独立 acceptance/commit plan；不混入 roadmap closeout commit。 |
| `specs/admin-shell-and-weekly-workbench/**` | Workbench 子 feature 已有独立 acceptance/commit plan；不混入 roadmap closeout commit。 |
| `specs/redis-job-orchestration/**` | Redis 子 feature 已有独立 acceptance/commit plan；不混入 roadmap closeout commit。 |
| `specs/image-feature-retirement/**` | Image retirement 子 feature 独立归属；不混入 roadmap closeout commit。 |
| `specs/inbox-ai-scoring/**` and `specs/inbox-ai-scoring-continuation/**` | Scoring 相关产物为前置 feature；不混入 roadmap closeout commit。 |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `docker/**`, `scripts/**`, `prisma/**`, `database/**` | 工作树中这些路径可能来自子 feature 或历史改动；roadmap closeout 不自动提交。 |

---

## Needs User Decision

| File | Why Uncertain | Question |
|---|---|---|
| Child feature batches | Roadmap acceptance 引用子 feature evidence；用户已选择先处理子 feature。 | 等待 `product-surface`、`runtime-config`、`redis-jobs`、`hermes-contract` 批次提交或明确跳过后，再提交 roadmap closeout。 |

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| Dirty worktree | 宽泛 add 会把大量子 feature 代码、删除和未跟踪文件混入 roadmap commit。 | 只允许 add Included Files；禁止 `git add -A` / `git add .`。 |
| Cross-feature evidence references | Roadmap acceptance 引用的子 feature文件若未提交，单独提交 roadmap 会形成仓库历史上的证据引用断层。 | 由用户决定先处理子 feature commit plan，或接受 roadmap docs 先提交。 |
| `.active` switch | 切到 roadmap 后，下一次 `继续` 会默认续接已完成的 umbrella，而不是 Hermes feature。 | 这是 closeout 期间的预期状态；新需求需显式 specify。 |
| Existing deletions | 工作树已有多个删除项，可能不是 roadmap closeout 所有。 | 本计划不提交删除项。 |
| No push | 本计划只考虑本地 commit。 | push 必须另行明确要求。 |

---

## Commit Batches

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | `specs/.active`, `specs/admin-modernization-roadmap/spec.md`, `specs/admin-modernization-roadmap/plan.md`, `specs/admin-modernization-roadmap/tasks.md`, `specs/admin-modernization-roadmap/acceptance.md`, `specs/admin-modernization-roadmap/commit-plan.md`, `specs/admin-modernization-roadmap/child-feature-commit-queue.md`, `specs/admin-modernization-roadmap/product-surface-commit-plan.md`, `specs/admin-modernization-roadmap/runtime-dependency-config-commit-plan.md`, `specs/redis-job-orchestration/commit-plan.md`, `specs/hermes-weekly-intelligence/commit-plan.md` | `docs(sdd): close out admin modernization roadmap` | 单一 docs-only closeout batch，包含最终子 feature commit planning 文档。 |

---

## Execution Rules

- 未获得用户明确确认前，不得执行 `git add` 或 `git commit`。
- 只允许 add `Included Files` 中属于已确认 batch 的文件。
- 不得使用 `git add -A`、`git add .` 或等价宽泛命令。
- 每个 batch 单独提交；任一 batch 失败时停止后续 batch。
- 不自动执行 `git push`。push 必须由用户另行明确要求。
- 因 `Needs User Decision` 非空，当前状态不得提交。

---

## User Confirmation

等待用户确认：

- `确认提交 roadmap only`: 只提交 Included Files。
- `先处理子 feature`: 暂不提交 roadmap closeout，先处理各子 feature commit plan。
- `修改计划`: 根据用户要求调整 included/excluded/batches。
- `暂不提交`: closeout 记录保持 not submitted。

# Child Feature Commit Queue

**Workspace**: `admin-modernization-roadmap`
**Date**: 2026-06-09
**Status**: Option B Selected; Awaiting Submit Confirmation

---

## Context

用户选择先处理子 feature，而不是提交 roadmap closeout。本文件只整理提交队列和归属冲突，不执行 `git add` / `git commit`。

当前工作树不是一个干净的单 feature diff，至少混有：

- `inbox-ai-scoring` / `inbox-ai-scoring-continuation`
- `image-feature-retirement`
- `admin-shell-and-weekly-workbench`
- `redis-job-orchestration`
- `hermes-weekly-intelligence`
- `admin-modernization-roadmap` closeout

---

## Recommended Queue

| Order | Feature | Current Plan | Status | Blocking Decision |
|---|---|---|---|---|
| 0 | `inbox-ai-scoring` acceptance residue | No dedicated commit plan | blocked | `specs/inbox-ai-scoring/acceptance.md` contains an older FAIL continuation block that conflicts with later `specs/inbox-ai-scoring-continuation/acceptance.md` CONDITIONAL PASS evidence. Decide whether to keep as failed-attempt ledger, supersede it, or exclude from commits. |
| 1 | Product surface combined batch | `specs/admin-modernization-roadmap/product-surface-commit-plan.md` | ready-after-confirmation | User accepted Option B. This batch combines `image-feature-retirement`, `admin-shell-and-weekly-workbench`, and shared UI/service surfaces. |
| 2 | Runtime dependency/config batch | `specs/admin-modernization-roadmap/runtime-dependency-config-commit-plan.md` | ready-after-confirmation | Handles mixed `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `src/lib/config-validation.ts`, startup health. |
| 3 | `redis-job-orchestration` | `specs/redis-job-orchestration/commit-plan.md` | ready-after-confirmation | Redis plan now focuses on queue/worker/status/retry/docs/runtime; shared UI and mixed dependency/config files are excluded. |
| 4 | `hermes-weekly-intelligence` | `specs/hermes-weekly-intelligence/commit-plan.md` | ready-after-confirmation | Hermes plan now focuses on `/api/v1` register/apply/OpenAPI/docs contract and SDD artifacts; workbench UI/service/parser files are handled by product-surface. |
| 5 | `admin-modernization-roadmap` closeout | `specs/admin-modernization-roadmap/commit-plan.md` | blocked | Submit after child feature plans are resolved or committed. |

---

## Practical Options

### Option A: Strict Feature Commits

Use exact patch/hunk staging to split mixed files.

Pros:

- Cleaner history.
- Each commit maps to one SDD feature.

Cons:

- More fragile because `package.json`/lockfile/config/weekly UI hunks are interleaved.
- Requires careful staged diff review before each commit.

### Option B: Product-Surface Combined Batch

Commit `image-feature-retirement` and `admin-shell-and-weekly-workbench` shared UI files together, then commit Redis, Hermes, roadmap.

Pros:

- Matches current worktree shape.
- Avoids artificial hunk split across weekly UI files.

Cons:

- One commit spans two SDD features.
- Commit message and acceptance references must say it is a combined product-surface batch.

### Option C: No Commit Yet

Keep all feature commit plans as documentation and wait for a cleaner branch or user decision.

Pros:

- No risk of mixing unintended files.

Cons:

- Dirty worktree remains unresolved.

---

## Recommended Next Decision

用户已选择 **Option B**。当前下一步不再是选择策略，而是确认是否提交 [product-surface-commit-plan.md](product-surface-commit-plan.md) 中的 combined batch。

当前可确认口令：

- `确认提交 product-surface`
- `确认提交 runtime-config`
- `确认提交 redis-jobs`
- `确认提交 hermes-contract`

如果用户要求严格提交历史，再走 Option A，并在每次 commit 前用 `git diff --cached --name-only` 和 `git diff --cached --check` 做 staged 验证。

---

## Non-Negotiable Rules

- 不使用 `git add -A`、`git add .` 或等价宽泛命令。
- 不提交 `.claude/settings.local.json`。
- 不自动 push。
- 每个 batch 提交前必须有用户明确确认。
- 若 staging 中出现未批准文件，停止并重新调整。

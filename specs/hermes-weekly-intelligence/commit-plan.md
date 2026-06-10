# Commit Plan: Hermes Weekly Intelligence

**Workspace**: `hermes-weekly-intelligence`
**Date**: 2026-06-08
**Status**: Awaiting User Confirmation

> 未获得用户明确确认前，不得执行 `git add` 或 `git commit`。

---

## Summary

本 feature 有明确相关 diff，但工作树同时包含大量历史 feature 的 dirty/untracked 文件。用户已确认先按 product-surface combined batch 处理 workbench UI/service/parser 文件；Hermes 提交计划现在聚焦 Admin `/api/v1` register contract、OpenAPI/docs/tests 和 SDD artifacts。

Workbench UI/service、Hermes preview parser、suggestion apply helper 已由 product-surface batch 接管。`src/lib/automation/openapi.ts` 是 Redis + Hermes 共享 contract 文件，因此本批次应在 `redis-job-orchestration` backend/runtime batch 之后提交。

---

## Included Files

| File | Reason | Evidence |
|---|---|---|
| `specs/hermes-weekly-intelligence/spec.md` | 当前 feature spec/readiness | `specs/.active`, `acceptance.md` |
| `specs/hermes-weekly-intelligence/plan.md` | Hermes/Admin/PG 边界和 Producer-Consumer Matrix | `plan.md` |
| `specs/hermes-weekly-intelligence/data-model.md` | Artifact/read-model contract | `data-model.md` |
| `specs/hermes-weekly-intelligence/tasks.md` | Implement/verify tasks and completion state | `tasks.md` |
| `specs/hermes-weekly-intelligence/context-manifest.md` | Implement/check context | `context-manifest.md` |
| `specs/hermes-weekly-intelligence/verify-evidence.md` | Fresh verify evidence | `verify-evidence.md` |
| `specs/hermes-weekly-intelligence/acceptance.md` | Completion record | `acceptance.md` |
| `specs/hermes-weekly-intelligence/commit-plan.md` | Commit planning gate | closeout requirement |
| `docs/automation-contracts.md` | Documents Hermes register mode, scopes, apply boundary | focused docs diff |
| `src/app/api/v1/weekly/suggestions/route.ts` | Adds `mode: register` for Hermes preview artifact | T002 |
| `src/app/api/v1/weekly/suggestions/route.test.ts` | Register/generate/idempotency tests | focused tests PASS |
| `src/app/api/v1/weekly/suggestions/[id]/apply/route.test.ts` | Source metadata apply route tests | focused tests PASS |
| `src/lib/automation/openapi.ts` | Shared automation OpenAPI update: Redis queued jobs/status/retry plus Hermes register/apply artifact schema | T014; Redis T012/T018/T019 |
| `src/app/api/v1/openapi.json/route.test.ts` | OpenAPI Redis job and Hermes register mode regression guards | focused tests PASS |

---

## Excluded Files

| File | Reason |
|---|---|
| `.claude/settings.local.json` | Local/tooling state, unrelated to Hermes implementation. |
| `docker/*`, `package.json`, `pnpm-*`, `scripts/*`, image retirement files | Pre-existing dirty state from earlier features; not part of Hermes diff. |
| `src/app/api/v1/jobs/*`, `src/lib/jobs/*`, `src/workers/*` | Redis job orchestration feature files, not current Hermes feature. |
| `src/app/api/ai/image/*`, `src/app/api/upload/image/*`, image service deletions | Image retirement feature files, not current Hermes feature. |
| `src/lib/automation/hermes-artifacts.ts`, `src/lib/automation/hermes-artifacts.test.ts` | Shared preview/report parser required by workbench service; included in product-surface batch so that UI/service files remain self-contained. |
| `src/lib/automation/weekly-suggestions.ts`, `src/lib/automation/weekly-suggestions.test.ts` | Shared apply helper and validation used by workbench; included in product-surface batch. |
| `src/lib/services/weekly-workbench*`, `src/components/weekly/SuggestionPanel*`, `src/components/weekly/AutomationRunTimeline*`, `src/app/api/weekly/workbench/summary/*`, `src/app/api/weekly/workbench/candidates/*`, `src/app/api/weekly/workbench/runs/*`, `src/app/api/weekly/workbench/[id]/*` | Workbench UI/service/wrapper route tree is included in product-surface batch; `workbench/jobs` is owned by Redis batch. |
| `specs/admin-modernization-roadmap/**`, `specs/.active` | Roadmap closeout / queue planning batch; not Hermes feature commit scope. |

---

## Resolved Ownership Decisions

| Decision | Resolution |
|---|---|
| Workbench UI/service files | Product-surface batch owns them because they are interleaved with admin shell/workbench and image-retirement UI. |
| Hermes parser/helper files consumed by workbench | Product-surface batch owns `hermes-artifacts*` and `weekly-suggestions*` to keep that batch self-contained. |
| Shared OpenAPI file | Hermes contract batch owns `src/lib/automation/openapi.ts` and its test after Redis backend/runtime lands. |
| Roadmap status files | Roadmap closeout batch owns them. |

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| Large dirty worktree | `git add` could accidentally include previous feature work | Only add explicitly approved paths; do not use `git add -A` or `git add .`. |
| Commit order dependency | Hermes contract route imports parser/helper files owned by product-surface batch; OpenAPI includes Redis job schemas. | Commit product-surface first, then runtime-config, then Redis backend/runtime, then Hermes contract. |
| Shared OpenAPI ownership | This batch includes Redis OpenAPI documentation as well as Hermes artifact schema because the file diff is interleaved. | Commit message and plan call it an automation contract update, not a pure Hermes-only file. |
| No real Hermes runtime smoke | Admin-side contract passed, but external Hermes skill/NAS runtime remains out of scope | Recorded as residual risk in `acceptance.md`. |
| pnpm non-TTY guard | `pnpm type-check` cannot run in this environment | Local `tsc --noEmit` passed and is recorded. |

---

## Commit Batches

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | Included Files only | `feat(automation): add Hermes suggestion artifact contract` | Admin-side Hermes register/apply/OpenAPI/docs contract plus SDD records. |

---

## Execution Rules

- 未获得用户明确确认前，不得执行 `git add` 或 `git commit`。
- 只允许 add `Included Files` 中的精确路径。
- 不得使用 `git add -A`、`git add .` 或等价宽泛命令。
- 不自动执行 `git push`。

---

## User Confirmation

等待用户确认：

- `确认提交 hermes-contract`: 按本计划精确 stage 并提交 Hermes automation contract batch.
- `修改计划`: 根据用户要求调整 included/excluded/batches.
- `暂不提交`: closeout stays PASS but commit result remains `not_submitted`.

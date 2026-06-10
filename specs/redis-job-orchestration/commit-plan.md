# Commit Plan: Redis Job Orchestration

**Workspace**: `redis-job-orchestration`
**Date**: 2026-06-08
**Status**: Awaiting User Confirmation

> Commit plan 是提交前的用户确认 gate。未获得用户明确确认前，不得执行 `git add` 或 `git commit`。

---

## Summary

`redis-job-orchestration` 已完成 PASS closeout，但当前工作树混有多个历史 feature 的未提交改动。用户已确认先按 product-surface combined batch 处理共享 UI/service 文件，并单独建立 runtime dependency/config batch。Redis 提交计划现在只覆盖 queue/worker/status/retry/docs/runtime 文件。

`package.json`、lockfile、config/startup health 已移至 `specs/admin-modernization-roadmap/runtime-dependency-config-commit-plan.md`，不再作为本 Redis batch 的决策项。

---

## Included Files

| File | Reason | Evidence |
|---|---|---|
| `specs/redis-job-orchestration/spec.md` | 当前 feature 规格。 | Feature Traits / Requirements。 |
| `specs/redis-job-orchestration/plan.md` | 当前 feature 方案和 ADR。 | BullMQ、`automation_runs`、worker topology ADR。 |
| `specs/redis-job-orchestration/data-model.md` | Redis key、run evidence 和状态语义。 | FR-010 / FR-011。 |
| `specs/redis-job-orchestration/tasks.md` | T001-T027 执行任务和最终 PASS 状态。 | Execution Readiness 已更新为 closeout。 |
| `specs/redis-job-orchestration/acceptance.md` | 持久验收记录。 | Evidence Table / Workflow Replay / Knowledge Capture / Completion Record。 |
| `specs/redis-job-orchestration/commit-plan.md` | 当前提交计划。 | SDD closeout commit gate。 |
| `src/lib/jobs/connection.ts`, `src/lib/jobs/connection.test.ts` | Redis/BullMQ connection adapter。 | T003。 |
| `src/lib/jobs/definitions.ts`, `src/lib/jobs/definitions.test.ts` | Job workflow registry。 | T006。 |
| `src/lib/jobs/locks.ts`, `src/lib/jobs/locks.test.ts` | Redis target lock 与 stale recovery。 | T007。 |
| `src/lib/jobs/rate-limit.ts`, `src/lib/jobs/rate-limit.test.ts` | Caller/workflow rate limit。 | T008。 |
| `src/lib/jobs/submit.ts`, `src/lib/jobs/submit.test.ts` | Queue submission service。 | T009 / FR-001。 |
| `src/lib/jobs/worker-handlers.ts`, `src/lib/jobs/worker-handlers.test.ts` | Sync/score worker handlers。 | T013。 |
| `src/lib/jobs/worker.ts`, `src/lib/jobs/worker.test.ts` | BullMQ worker lifecycle、heartbeat 和 terminal evidence。 | T014 / runtime smoke。 |
| `src/lib/jobs/status.ts`, `src/lib/jobs/status.test.ts` | Job status reader 和 history-only fallback。 | T017 / FR-003。 |
| `src/lib/jobs/retry.ts`, `src/lib/jobs/retry.test.ts` | Failed job retry service。 | T019 / FR-007。 |
| `src/lib/jobs/health.ts`, `src/lib/jobs/health.test.ts` | Worker/queue health summary。 | T020 / FR-008。 |
| `src/workers/automation-worker.ts` | 独立 worker entrypoint。 | T014；runtime smoke 需要 `server-only` shim。 |
| `src/app/api/v1/jobs/sync/route.ts`, `src/app/api/v1/jobs/sync/route.test.ts` | `/api/v1/jobs/sync` queue 化。 | T010。 |
| `src/app/api/v1/jobs/score/route.ts`, `src/app/api/v1/jobs/score/route.test.ts` | `/api/v1/jobs/score` queue 化。 | T011。 |
| `src/app/api/v1/jobs/[id]/route.ts`, `src/app/api/v1/jobs/[id]/route.test.ts` | Job status endpoint。 | T018。 |
| `src/app/api/v1/jobs/[id]/retry/route.ts`, `src/app/api/v1/jobs/[id]/retry/route.test.ts` | Failed job retry endpoint。 | T019。 |
| `src/lib/automation/http.ts` | `runQueuedAutomationRoute` 和 job/retry error mapping。 | T009-T011。 |
| `src/lib/automation/run.ts`, `src/lib/automation/run.test.ts` | queued/running/terminal run lifecycle helpers。 | T004-T005。 |
| `src/lib/automation/auth.ts`, `src/lib/automation/auth.test.ts` | Scheduler service token authentication helper。 | T015。 |
| `src/lib/automation/legacy-routes.ts` | Legacy human route response marker。 | T016。 |
| `src/lib/scheduling/inbox-scoring-scheduler.ts`, `src/lib/scheduling/inbox-scoring-scheduler.test.ts` | Cron scoring 改为 enqueue `score.run`。 | T015。 |
| `src/app/api/inbox/score-batch/route.ts`, `src/app/api/inbox/score-batch/route.test.ts` | Legacy scoring route 标注同步兼容，不写 `automation_runs`。 | T016。 |
| `src/app/api/sources/sync-all/route.ts`, `src/app/api/sources/sync-all/route.test.ts` | Legacy sync route 标注同步兼容，不写 `automation_runs`。 | T016。 |
| `src/app/api/health/route.ts`, `src/app/api/health/route.test.ts` | `/api/health` 暴露 jobQueue degraded/worker health。 | T020 / runtime smoke。 |
| `src/app/api/weekly/workbench/jobs/route.ts`, `src/app/api/weekly/workbench/jobs/route.test.ts` | Cookie-auth job summary wrapper。 | T021。 |
| `docs/automation-plan-admin.md` | 历史自动化总纲补充 Redis queue/worker 运行说明和 jobs endpoint 语义。 | T016 / T026；Redis worker runbook。 |
| `docs/cron-job-setup.md` | Cron 迁移说明与 legacy route header 语义。 | T016。 |
| `docs/nas-deployment.md` | NAS worker env 和 health 检查。 | T026。 |
| `docker/Dockerfile` | Runner 镜像复制 `src`/`tsconfig.json`，支持同镜像 worker。 | T026。 |
| `docker/docker-compose.nas.yml` | NAS `weekly-admin-worker` 服务。 | T026。 |

---

## Excluded Files

| File | Reason |
|---|---|
| `.claude/settings.local.json` | 本地工具权限设置，非当前 feature 交付内容。 |
| `specs/admin-shell-and-weekly-workbench/**` | 另一个已完成 feature 的规格、验收和提交计划。 |
| `specs/image-feature-retirement/**` | 另一个已完成 feature 的规格和验收。 |
| `specs/inbox-ai-scoring/acceptance.md` | 其它 feature 验收记录。 |
| `src/app/(dashboard)/**` | 主要属于 admin shell、图片退役、settings/content UI 等历史改动。 |
| `src/app/api/ai/**`, `src/app/api/inbox/[id]/crop-image/**`, `src/app/api/upload/image/**` | AI/image API 退役相关，不属于 Redis job orchestration。 |
| `src/app/api/weekly/workbench/[id]/**`, `src/app/api/weekly/workbench/candidates/**`, `src/app/api/weekly/workbench/runs/**`, `src/app/api/weekly/workbench/summary/**` | admin shell/workbench wrapper routes，不是本 feature 新增的 job summary wrapper。 |
| `src/components/content/**`, `src/components/inbox/**`, `src/components/weekly/AvailableContentsList*`, `src/components/weekly/PublishChecklist*`, `src/components/weekly/SelectedContentsList*`, `src/components/weekly/SuggestionPanel*`, `src/components/weekly/WeeklyEditor.tsx`, `src/components/weekly/WeeklyIssueLayout*`, `src/components/weekly/WeeklyPreview*`, `src/components/weekly/HoverImagePreview.tsx` | UI 壳层、工作台或图片退役改动，不属于本 feature 的执行控制层。 |
| `src/lib/ai/client.ts`, `src/lib/services/content.ts`, `src/lib/services/image-*`, `src/lib/services/inbox.ts`, `src/lib/services/karakeep-resync.ts`, `src/lib/services/quail.ts`, `src/lib/services/sync-orchestrator.ts`, `src/lib/validations/content.ts`, `src/proxy.ts` | 内容/图片/legacy service 改动，与 Redis job orchestration 无直接归属或属于其它 feature。 |
| `scripts/**` | 图片退役或迁移脚本改动，不属于本 feature。 |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `src/lib/config-validation.ts`, `src/lib/config-validation.test.ts`, `src/app/api/health/startup/route.ts` | 已归入 runtime dependency/config batch。 |
| `src/components/dashboard/weekly-production-dashboard*`, `src/components/weekly/AutomationRunTimeline*`, `src/components/weekly/WeeklyWorkbench*`, `src/lib/services/weekly-workbench*` | 已归入 product-surface combined batch，Redis batch 只保留 job summary API 和 backend health/status。 |
| `src/lib/automation/openapi.ts`, `src/app/api/v1/openapi.json/route.test.ts` | 共享 Redis + Hermes automation contract 文件；归入后续 Hermes contract batch，避免本 Redis batch 顺带提交 Hermes OpenAPI schema。 |
| `specs/.active`, `specs/admin-modernization-roadmap/**` | Roadmap closeout / queue planning batch；不混入 Redis feature commit。 |

---

## Resolved Ownership Decisions

| Decision | Resolution |
|---|---|
| Dependency/config files | Moved to `runtime-dependency-config-commit-plan.md`. |
| Shared dashboard/workbench UI and aggregation service | Moved to `product-surface-commit-plan.md`. |
| Roadmap status files and `.active` | Kept for roadmap closeout batch. |
| `docs/automation-plan-admin.md` | Included here as a Redis/runtime runbook because it documents queued jobs and worker deployment; Hermes-specific contract remains `docs/automation-contracts.md`. |
| OpenAPI document/test | Deferred to Hermes contract batch because the current whole-file diff contains both Redis job status/retry schemas and Hermes suggestion artifact schemas. |

---

## Risks

| Risk | Impact | Handling |
|---|---|---|
| staged changes | 当前无 staged changes；后续若用户手动 stage，可能改变提交边界。 | 提交前再次检查 `git diff --cached --name-only`。 |
| dependency/config split | Redis code depends on `bullmq`/`ioredis` and config validation, but those files are committed in the preceding runtime-config batch. | Commit order must keep runtime-config before Redis backend/runtime. |
| shared OpenAPI doc deferred | Redis backend commit will land before the full OpenAPI doc update. | Follow with Hermes contract batch before roadmap closeout. |
| broad historical doc | `docs/automation-plan-admin.md` contains older Post-F2/Hermes context in addition to Redis worker notes. | Treat it as historical automation plan/runbook; authoritative Hermes contract is deferred to Hermes batch. |
| untracked feature directories | `specs/redis-job-orchestration/**` 和多个 admin-shell/image 文件都是 untracked；宽泛 add 会混入其它 feature。 | 只允许 add 用户确认后的精确路径；不得 `git add -A`。 |
| runtime smoke touched production-like data | smoke 创建过 automation token 和 failed scoring run evidence。 | token 已 revoked；acceptance 只记录 runId，不记录 Redis 密码或 token。 |

---

## Commit Batches

| Batch | Files | Commit Message | Rationale |
|---|---|---|---|
| 1 | Included Files only | `feat(redis-jobs): queue automation sync and scoring` | Queue submit、worker、status/retry、health、docs 和 acceptance 必须同批保持可验证。 |

---

## Execution Rules

- 未获得用户明确确认前，不得执行 `git add` 或 `git commit`。
- 只允许 add `Included Files` 中的精确路径。
- 不得使用 `git add -A`、`git add .` 或等价宽泛命令。
- 每个 batch 单独提交；任一 batch 失败时停止后续 batch。
- 不自动执行 `git push`。push 必须由用户另行明确要求。

---

## User Confirmation

等待用户确认：

- `确认提交 redis-jobs`: 按本计划精确 stage 并提交 Redis backend/runtime batch。
- `修改计划`: 根据用户要求调整 included/excluded/batches。
- `暂不提交`: closeout 保持 awaiting_user_confirmation，并保留 dirty files。

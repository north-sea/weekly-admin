# Acceptance Record: Redis Job Orchestration

**Workspace**: `redis-job-orchestration` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)

> 本记录已补齐真实 Redis + app + worker + score job smoke。代表性 scoring 样本最终业务失败，但队列提交、worker 执行、重试、terminal evidence、status endpoint 和 health 可见性闭环通过。

---

## Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| FR-001 Redis-backed queue 和 sync/score 第一批 job 化 | 已新增 BullMQ/ioredis 依赖、`worker:automation` script、job registry、submit service；`/api/v1/jobs/sync` 与 `/api/v1/jobs/score` route 已改为提交 queued job envelope，不再同步调用长任务 handler。 | `package.json`, `src/lib/jobs/definitions.ts`, `src/lib/jobs/submit.ts`, `src/app/api/v1/jobs/sync/route.test.ts`, `src/app/api/v1/jobs/score/route.test.ts` | PASS |
| FR-002 保留 automation auth/scope/Idempotency-Key | route 和 submit tests 覆盖 idempotency required、same key replay、payload conflict、scope forbidden；cron scheduler 使用 `CRON_API_TOKEN` 走同一 submit 边界。 | `src/lib/automation/auth.test.ts`, `src/lib/automation/run.test.ts`, `src/lib/jobs/submit.test.ts`, `src/lib/scheduling/inbox-scoring-scheduler.test.ts` | PASS |
| FR-003 job status 查询 | 新增 status reader 与 `/api/v1/jobs/{id}` endpoint，合并 durable run、Redis snapshot、BullMQ retained state 和 history-only fallback；runtime smoke 中 run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` 状态经历 `running` -> `retrying` -> `failed`，status endpoint 返回 `historyOnly=false`、`redis.available=true`、`queue.state=failed`。 | `src/lib/jobs/status.test.ts`, `src/app/api/v1/jobs/[id]/route.test.ts`, runtime smoke 2026-06-08 | PASS |
| FR-004 workflow/target lock | Redis target lock 支持同 target 冲突、same run 复用、TTL stale recovery、release 不删除他人锁；submit 阶段使用独立 `JOB_TARGET_LOCK_TTL_SECONDS`，避免 queued job 因 60 秒 rate-limit window 过期而被同 target 重复入队。 | `src/lib/jobs/locks.test.ts`, `src/lib/jobs/submit.test.ts`, `src/lib/config-validation.test.ts` | PASS |
| FR-005 caller/workflow rate limit | Redis bucket 返回 allowed / retry-after；submit 入队前执行 rate-limit；Redis unavailable 有明确错误路径。 | `src/lib/jobs/rate-limit.test.ts`, `src/lib/jobs/submit.test.ts` | PASS |
| FR-006 durable `automation_runs` evidence | queued/running/terminal lifecycle helper 已拆分；worker 在领取、完成和最终失败时写回 `automation_runs`；runtime smoke durable row `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` 为 `workflow=score`、`step=run`、`status=failed`、`error_code=AutomationJobExecutionError`、`finished_at=2026-06-08T14:39:36.000Z`。 | `src/lib/automation/run.test.ts`, `src/lib/jobs/worker.test.ts`, `src/lib/jobs/worker-handlers.test.ts`, runtime DB query 2026-06-08 | PASS |
| FR-007 failed job retry | retry service 和 endpoint 只允许 failed + retained payload 的 supported workflow 重试；保留原失败 evidence；Redis/BullMQ payload 过期后返回不可重试原因。 | `src/lib/jobs/retry.test.ts`, `src/app/api/v1/jobs/[id]/retry/route.test.ts` | PASS |
| FR-008 Admin UI job/worker health 可见 | dashboard 增加 queue/backlog/worker stale surface；workbench timeline 支持 queued/running/retrying/retryable/history-only 状态；worker 空闲时也写 heartbeat，active 时记录 current run/job；runtime health 返回 `workerCount=1`、`workerStale=0`、`queue.failed=1` 并 degraded；retry button 仍为 disabled placeholder。 | `src/lib/jobs/worker.test.ts`, `src/lib/jobs/health.test.ts`, `src/components/dashboard/weekly-production-dashboard.test.tsx`, `src/components/weekly/AutomationRunTimeline.test.tsx`, `src/components/weekly/WeeklyWorkbench.test.tsx`, runtime smoke 2026-06-08 | PASS |
| FR-009 Redis unavailable 明确失败 / degraded | startup health、submit、health summary 和 UI wrapper 均覆盖 Redis unavailable；sync/score 不做静默同步 fallback。 | `src/lib/config-validation.test.ts`, `src/lib/jobs/connection.test.ts`, `src/lib/jobs/submit.test.ts`, `src/lib/jobs/health.test.ts`, `src/app/api/weekly/workbench/jobs/route.test.ts` | PASS |
| FR-010 Redis 不成为业务事实源 | `data-model.md` 明确 MySQL `automation_runs` 与业务表是事实源；Redis 只保存 queue、lock、rate-limit、status、heartbeat。 | `specs/redis-job-orchestration/data-model.md`, `src/lib/jobs/status.test.ts` | PASS |
| FR-011 不新增持久 job/status 表 | MVP 未新增 Prisma schema 或 migration；状态扩展通过 TypeScript union 和 OpenAPI enum 表达。 | `specs/redis-job-orchestration/data-model.md`, `src/lib/automation/contracts.test.ts`, `src/app/api/v1/openapi.json/route.test.ts` | PASS |
| FR-012 dashboard/workbench 保留 `automation_runs` 历史语义 | Redis status 过期时返回 history-only；UI 显示 status expired note，不隐藏 durable run。 | `src/lib/jobs/status.test.ts`, `src/components/weekly/AutomationRunTimeline.test.tsx`, `src/components/weekly/WeeklyWorkbench.test.tsx` | PASS |
| NFR-001 submit API 快速返回 | route tests 验证 sync/score 返回 queued response；代码路径不再在 submit route 调用 `SyncOrchestrator` / `InboxScoringService.runBatch`。 | `src/app/api/v1/jobs/sync/route.test.ts`, `src/app/api/v1/jobs/score/route.test.ts` | PASS |
| NFR-002 worker 可重启与 stale 防护 | worker tests 覆盖 queued -> running -> terminal、final failure、attempt retry、heartbeat/status update；lock TTL 处理 stale recovery。 | `src/lib/jobs/worker.test.ts`, `src/lib/jobs/locks.test.ts` | PASS |
| NFR-003 status 查询避免拖慢 Admin | MVP 只在现有 dashboard/workbench summary 显示 queue health，不新增跨 workflow 历史任务中心；health/status reader 有 bounded summary 语义。 | `src/lib/jobs/health.ts`, `src/app/api/weekly/workbench/jobs/route.ts`, `src/components/dashboard/weekly-production-dashboard.tsx` | PASS |
| NFR-004 Redis key/TTL/retry policy 可配置 | env validation 覆盖 `REDIS_URL`、`JOB_QUEUE_PREFIX`、status TTL、target lock TTL、heartbeat、retention；Docker/NAS 文档记录 worker env。 | `src/lib/config-validation.test.ts`, `docs/automation-plan-admin.md`, `docs/nas-deployment.md`, `docker/docker-compose.nas.yml` | PASS |
| NFR-005 关键路径测试覆盖 | Focused suite 覆盖 queue、lock、idempotency、retry、Redis unavailable、run evidence、UI degraded。 | `./node_modules/.bin/vitest run ...` -> 27 files / 113 tests passed；`./node_modules/.bin/tsc --noEmit` passed；`./node_modules/.bin/eslint .` -> 0 errors / 462 warnings | PASS |
| Runtime smoke: Redis + app + worker + score job | 通过 SSH tunnel 连接 NAS Redis；启动本地 Next dev `:3100` 和 worker；`POST /api/v1/jobs/score {"limit":1,"delay":0}` 返回 HTTP 202；status endpoint 轮询到 terminal `failed`；`automation_runs` 写入 terminal row；health 显示 worker 在线和 failed backlog degraded；所有临时 automation token 均已 revoked。 | runtime smoke 2026-06-08, run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` | PASS |

---

## Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PASS | queue、submit、worker、status、retry、health、OpenAPI、scheduler、legacy compatibility、UI surface 和 deployment notes 均有 focused tests 或文件证据。 |
| Workflow closure | PASS | 真实 runtime replay 已证明 submit -> Redis/BullMQ -> worker -> retry -> terminal status -> `automation_runs` -> health/status query 闭环。 |
| User-visible outcome | PASS | runtime health/status 已返回 worker/backlog/recent run 状态；dashboard/workbench 组件测试覆盖这些状态的可见渲染。 |

**Overall**: PASS

**三维不一致说明**: 不适用。代表性业务样本最终 `failed`，但该 terminal failure 是 worker 正确写入的可观测结果，不是 orchestration 闭环失败。

---

## Workflow Replay

- **输入摘要**: NAS Redis 通过 SSH tunnel 暴露到 `127.0.0.1:6380`；本地 Next dev 启动在 `127.0.0.1:3100`；独立 worker 用同一 `JOB_QUEUE_PREFIX=weekly-admin-smoke-*`；临时 automation token 具备 `score:run,ops:read` scope；提交 `POST /api/v1/jobs/score` payload `{"limit":1,"delay":0}`。
- **最终 payload 摘要**: submit 返回 HTTP 202，`runId=auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56`，`status=queued`，`statusUrl=/api/v1/jobs/auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56`。Status 轮询看到 `running`、`retrying`、`failed`；terminal response 包含 `durableStatus=failed`、`historyOnly=false`、`redis.available=true`、`queue.state=failed`。DB row 为 `workflow=score`、`step=run`、`status=failed`、`error_code=AutomationJobExecutionError`、`error_message=Inbox scoring batch failed`。
- **用户可见结果断言**: health jobQueue runtime response 显示 `workerCount=1`、`workerStale=0`、`queue.failed=1`、`jobQueueStatus=degraded`；dashboard/workbench 组件测试覆盖 failed/retryable/history-only/worker stale/backlog 渲染，因此用户可见状态链路成立。
- **Replay 类型**: 真实 API/runtime replay。代表性 scoring 样本最终失败，作为 terminal failure evidence 验收；业务样本失败不阻塞 Redis orchestration feature。

### Smoke Steps Executed

1. 使用 NAS `redis:8.0.2` 容器，经 SSH tunnel 映射到本地 `127.0.0.1:6380`，Redis AUTH 通过。
2. 临时创建 automation token，scope 为 `score:run,ops:read`，smoke 结束后全部撤销。
3. 启动 app：`next dev -p 3100`。
4. 启动 worker：`tsx src/workers/automation-worker.ts`。
5. 提交 score job：

   ```bash
   curl -i -X POST http://127.0.0.1:3100/api/v1/jobs/score \
     -H "Authorization: Bearer ${CRON_API_TOKEN}" \
     -H "Idempotency-Key: smoke-score-$(date +%Y%m%d%H%M%S)" \
     -H "Content-Type: application/json" \
     -d '{"limit":1,"delay":0}'
   ```

6. Submit 快速返回 HTTP 202，记录 `runId` / `jobId` / `statusUrl`。
7. 轮询 `/api/v1/jobs/{runId}`，确认状态从 `running` / `retrying` 进入 terminal `failed`。
8. 查询 `automation_runs`，确认同一 `runId` 有 terminal row 和 error evidence。
9. 查询 `/api/health`，确认 worker heartbeat 与 failed backlog 可见。
10. 关闭 dev server、worker、SSH tunnel，并撤销临时 automation token。

### Smoke Pass Criteria

| Check | Required Evidence |
|---|---|
| Submit quick response | PASS: HTTP 202，`runId=auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56`，`statusUrl` 返回，route 未等待 scoring terminal。 |
| Worker completion | PASS: status endpoint seen states `running,retrying,failed`，worker 执行并写 terminal status。 |
| Durable evidence | PASS: `automation_runs` row 与 run id 一致，terminal `failed`，含 `AutomationJobExecutionError` / `Inbox scoring batch failed`。 |
| UI visibility | PASS: `/api/health` runtime response 暴露 `workerCount=1`、`workerStale=0`、`queue.failed=1`；dashboard/workbench component tests 覆盖渲染。 |
| Degraded behavior | PASS: failed backlog 使 jobQueue degraded；核心 health HTTP 200。Redis unavailable 行为由 submit/health tests 覆盖。 |

---

## Verification Commands

| Command | Result | Notes |
|---|---|---|
| `./node_modules/.bin/vitest run src/lib/config-validation.test.ts src/lib/jobs/connection.test.ts src/lib/jobs/definitions.test.ts src/lib/jobs/locks.test.ts src/lib/jobs/rate-limit.test.ts src/lib/jobs/submit.test.ts src/lib/jobs/worker-handlers.test.ts src/lib/jobs/worker.test.ts src/lib/jobs/status.test.ts src/lib/jobs/retry.test.ts src/lib/jobs/health.test.ts src/lib/automation/auth.test.ts src/lib/automation/contracts.test.ts src/lib/automation/run.test.ts src/app/api/v1/jobs/sync/route.test.ts src/app/api/v1/jobs/score/route.test.ts 'src/app/api/v1/jobs/[id]/route.test.ts' 'src/app/api/v1/jobs/[id]/retry/route.test.ts' src/app/api/v1/openapi.json/route.test.ts src/app/api/health/route.test.ts src/app/api/weekly/workbench/jobs/route.test.ts src/app/api/inbox/score-batch/route.test.ts src/app/api/sources/sync-all/route.test.ts src/components/dashboard/weekly-production-dashboard.test.tsx src/components/weekly/AutomationRunTimeline.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx src/lib/scheduling/inbox-scoring-scheduler.test.ts` | PASS | 27 files / 113 tests passed。 |
| `./node_modules/.bin/tsc --noEmit` | PASS | TypeScript static check passed。 |
| `pnpm lint` | BLOCKED BY TOOLING | pnpm 在非 TTY 下先触发依赖目录清理并报 `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]`，未进入 lint。 |
| `./node_modules/.bin/eslint .` | PASS WITH WARNINGS | 0 errors / 462 warnings；warnings 主要为既有 `no-explicit-any`、`set-state-in-effect`、`no-require-imports`、unused vars。 |
| Runtime Redis/app/worker smoke | PASS | 真实 replay 通过；run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` terminal `failed` 是可观测业务失败，orchestration 闭环 PASS。 |

---

## Closeout Checklist

| Item | Status | Evidence / Rationale | Next Step |
|---|---|---|---|
| 旧逻辑、旧路径、fallback 或临时兼容退役 | 延后 | `/api/v1/jobs/sync` 与 `/api/v1/jobs/score` 已 queue 化；legacy human routes `/api/inbox/score-batch`、`/api/sources/sync-all` 保持同步执行并标注 headers，不写 `automation_runs`。Karakeep resync 内存 Map 未纳入首批范围。 | Legacy human routes 保留兼容；Karakeep resync Redis 化进入后续 slice。 |
| 发布、提交、CI 或 follow-through | 延后 | 本地 focused tests、tsc、eslint binary 和 runtime smoke 已通过；未执行 CI、git commit。 | `commit-plan.md` 已生成，等待用户确认；CI 可在提交或 PR 后执行。 |
| SDD closeout-ready gate | 已完成 | `tasks.md` 无未完成任务；本文件包含 Evidence Table、Verdict Summary、Workflow Replay、Closeout Checklist、Knowledge Capture 和 Completion Record。项目内未发现 `skills/sdd/scripts/validate-sdd.sh` 或 `.agents/skills/sdd/scripts/validate-sdd.sh`，因此执行人工 closeout-ready 检查。 | 无。 |
| 文档、阶段说明、模板或验收记录更新 | 已完成 | `spec.md`、`plan.md`、`data-model.md`、`tasks.md`、本 `acceptance.md`、automation/NAS docs 均已记录；runtime replay 证据已写入本文件。 | 无。 |
| ADR、架构债或演进触发信号 | 已完成 | ADR 固定 BullMQ、`automation_runs` durable evidence、独立 worker、Redis unavailable 明确失败、第一批 sync/score。 | attempt 历史、Karakeep resync Redis 化、publish worker 化、完整任务中心作为后续演进触发。 |
| Knowledge Capture Gate | 已完成 | 可复用知识已写入下方 `Knowledge Capture`；外部 `nmem wm` 当前无法连接 `127.0.0.1:14242`，未触发外部同步。 | 保持 recorded-only；后续如需要可人工同步到外部知识库。 |
| Roadmap 回写与下一 feature 推荐 | 已完成 | `specs/admin-modernization-roadmap/plan.md` 已有 Post-F3 Reassessment；`tasks.md` 已回写 T013/T025 完成和下一步 `hermes-weekly-intelligence`。 | 下一步 `specify hermes-weekly-intelligence`。 |

---

## Knowledge Capture

| Type | Title | Summary | Evidence | Scope | Sync Status | Follow-up |
|---|---|---|---|---|---|---|
| decision | Target lock TTL 独立于 rate-limit window | `JOB_TARGET_LOCK_TTL_SECONDS` 默认 3600 秒，避免 queued job 等待超过 60 秒 rate-limit window 后同 target 被重复入队。 | `src/lib/config-validation.ts`, `src/lib/jobs/submit.ts`, `src/lib/jobs/submit.test.ts` | Redis job submit / lock policy | recorded-only | 后续如调高 worker 并发，按真实最长任务时间复核 TTL。 |
| gotcha | Worker entrypoint 需要 `server-only` shim | 独立 `tsx` worker 不在 Next runtime 内，直接加载含 `server-only` 的模块会失败；entrypoint 先注册 no-op shim，再动态 import job worker。 | `src/workers/automation-worker.ts`, runtime smoke 2026-06-08 | Next.js app + external Node worker | recorded-only | 如改为 build 后 worker bundle，重新验证 shim 是否仍需要。 |
| procedure | Redis/app/worker smoke replay | 使用 NAS Redis SSH tunnel、本地 app、独立 worker 和临时 automation token 提交 score job；验收 quick 202、status terminal、`automation_runs` row、health jobQueue，再撤销临时 token。 | run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56`, Smoke Steps Executed | Future queue/worker runtime verification | recorded-only | 后续可把 smoke 固化为运维 runbook 或 CI 环境脚本。 |
| follow-up | Karakeep 和 weekly publish 仍未 worker 化 | 首批 MVP 只迁移 sync/score；Karakeep resync 内存 `Map`、weekly suggest/apply/publish worker 化和完整任务中心仍是后续演进点。 | `specs/redis-job-orchestration/tasks.md`, Closeout Checklist | Roadmap follow-up | follow-up | 在 Hermes 或后续 execution-control slice 中重新评估。 |

---

## Commit Result

| Field | Value |
|---|---|
| Status | awaiting_user_confirmation |
| Commit Hashes | 无 |
| Commit Messages | 计划为 `feat(redis-jobs): queue automation sync and scoring`，最终以用户确认的 commit plan 为准。 |
| Included Files | 见 `specs/redis-job-orchestration/commit-plan.md` 的 Included Files / Commit Batches。 |
| Excluded / Remaining Files | 工作树包含 image retirement、admin shell/workbench、content UI、settings、inbox scoring 等无关或混合归属改动；见 commit plan。 |
| Reason | `commit-plan.md` 已生成；未获得用户明确提交确认，且存在 Needs User Decision 文件，因此未执行 `git add` / `git commit`。 |

---

## Completion Record

- **最终结论**: PASS
- **完成依据**: Evidence Table 覆盖 P1/P2 requirement；focused suite 27 files / 113 tests passed；`tsc --noEmit` passed；eslint binary 0 errors / 462 warnings；runtime replay run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` 证明 submit、worker、retry、terminal evidence、status 和 health 闭环。
- **阻塞项**: 无。
- **延后项**: legacy human routes 保留同步兼容；Karakeep resync 内存状态、weekly suggest/apply/publish worker 化、完整任务中心、持久 attempt 表均不属于首批 MVP。
- **退役结论**: `/api/v1/jobs/sync` 与 `/api/v1/jobs/score` 已从 request lifecycle 长任务退役为 queue submit；legacy human routes 保留并明确标注不写自动化 run。
- **提交结论**: awaiting_user_confirmation；已生成 `specs/redis-job-orchestration/commit-plan.md`，未执行 `git add` / `git commit`。
- **后续动作**: `redis-job-orchestration` closeout 完成；下一步推荐 `specify hermes-weekly-intelligence`，或先由用户确认/修改/暂缓 commit plan。

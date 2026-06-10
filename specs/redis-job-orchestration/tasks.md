# Tasks: Redis Job Orchestration

**Workspace**: `redis-job-orchestration` | **Date**: 2026-06-07
**Input**: `specs/redis-job-orchestration/spec.md` + `plan.md`
**Prerequisites**: spec.md, plan.md, data-model.md

---

## 执行原则

- 第一批只迁移 `/api/v1/jobs/sync` 和 `/api/v1/jobs/score`。
- Redis/BullMQ 不作为事实源；terminal evidence 必须写入 `automation_runs`。
- Submit route 不得执行长任务；长任务只能由独立 worker 执行。
- 不新增 Prisma schema；若实现发现必须新增持久 job/attempt 表，先回到 plan。
- 所有新状态必须有测试覆盖：idempotency、queue、lock、rate-limit、Redis unavailable、worker failure、UI degradation。

---

## Phase 1: 依赖与配置边界

**目标**: 引入 queue runtime 前，先固定配置、禁用策略和测试 seam。

- [x] T001 添加 BullMQ/Redis 依赖和 worker script
  - scope: `package.json`, `pnpm-lock.yaml`
  - maps_to: ADR-001 / NFR-004
  - work: 添加 `bullmq` 和必要 Redis client 依赖；新增 `worker:automation` script
  - verify: `bullmq` / `ioredis` 已加入依赖，`worker:automation` 已加入 scripts；`./node_modules/.bin/tsc --noEmit` 通过。注意：`pnpm install` 因 `msgpackr-extract@3.0.4` ignored builds 返回 1，但依赖目录已恢复，focused tests 可运行。

- [x] T002 定义 job queue 环境配置和 startup validation
  - scope: `src/lib/config-validation.ts`, `src/app/api/health/startup/route.ts`
  - maps_to: FR-009 / NFR-004
  - work: 增加 `REDIS_URL`、`JOB_QUEUE_PREFIX`、`JOB_QUEUE_DISABLED`、job status TTL、target lock TTL、worker heartbeat/retention 配置；startup health 展示 job queue degraded 而不影响非 job 核心启动
  - verify: `./node_modules/.bin/vitest run src/lib/config-validation.test.ts src/lib/jobs/connection.test.ts` -> 2 files / 7 tests passed

- [x] T003 建立 Redis/BullMQ connection adapter
  - scope: `src/lib/jobs/connection.ts`, `src/lib/jobs/connection.test.ts`
  - maps_to: FR-001 / FR-009
  - work: 提供 queue/worker/status 共享连接工厂和 `checkJobRedisHealth`
  - verify: `./node_modules/.bin/vitest run src/lib/config-validation.test.ts src/lib/jobs/connection.test.ts` -> 2 files / 7 tests passed；`./node_modules/.bin/tsc --noEmit` passed

---

## Phase 2: Run lifecycle 与 job 数据模型

**目标**: 把现有同步 `withAutomationRun` 拆成可排队/可完成的生命周期操作。

- [x] T004 扩展 automation run status 类型
  - scope: `src/lib/automation/run.ts`, `src/lib/automation/contracts.ts`, OpenAPI status schema
  - maps_to: FR-003 / FR-012
  - work: TypeScript union 增加 `queued`、`cancelled`；保持 Prisma schema 不变
  - verify: `./node_modules/.bin/vitest run src/lib/automation/run.test.ts src/lib/automation/contracts.test.ts src/app/api/v1/openapi.json/route.test.ts src/lib/jobs/definitions.test.ts src/lib/jobs/locks.test.ts src/lib/jobs/rate-limit.test.ts` -> 6 files / 29 tests passed

- [x] T005 提取 queued run lifecycle helpers
  - scope: `src/lib/automation/run.ts`, `src/lib/automation/run.test.ts`
  - maps_to: US1 / FR-002 / FR-006
  - work: 新增 `createOrReplayQueuedAutomationRun`、`markAutomationRunRunning`、`completeAutomationRun`、`failAutomationRun`
  - verify: `run.test.ts` 覆盖 same idempotency replay、payload conflict、queued existing run、running update、terminal completion、failure update

- [x] T006 定义 job workflow registry
  - scope: `src/lib/jobs/definitions.ts`, `src/lib/jobs/definitions.test.ts`
  - maps_to: FR-001 / CD-004
  - work: 定义 `sync.run`、`score.run`、reserved weekly job types、target key、attempt/backoff、rate-limit policy
  - verify: `definitions.test.ts` 覆盖 source-specific sync、all-source sync、score batch target、reserved weekly type 不可提交

- [x] T007 实现 Redis lock 和 active target index
  - scope: `src/lib/jobs/locks.ts`, `src/lib/jobs/locks.test.ts`
  - maps_to: FR-004 / US3-1 / US3-3
  - work: 实现 target lock acquire/refresh/release/stale TTL；MVP 对不同 idempotency 的同 target job 返回 conflict
  - verify: `locks.test.ts` 覆盖同 target 冲突、same run 复用、TTL stale recovery、release failure 不删除他人 lock

- [x] T008 实现 caller/workflow rate limit
  - scope: `src/lib/jobs/rate-limit.ts`, `src/lib/jobs/rate-limit.test.ts`
  - maps_to: FR-005 / US3-2
  - work: 用 Redis bucket 返回 allowed/retryAfter；rate-limit 在入队前执行
  - verify: `rate-limit.test.ts` 覆盖 under limit、over limit、window reset、Redis unavailable；`./node_modules/.bin/tsc --noEmit` passed

---

## Phase 3: Job submission API

**目标**: 让 sync/score route 快速返回 job/run status，而不是同步执行长任务。

- [x] T009 实现 submit service
  - scope: `src/lib/jobs/submit.ts`, `src/lib/jobs/submit.test.ts`
  - maps_to: US1 / FR-001 / FR-002 / FR-009
  - work: auth caller 输入后创建/复用 queued run、检查 rate-limit/lock、`queue.add(jobId=runId)`、返回 statusUrl
  - verify: `submit.test.ts` 覆盖 enqueue success、idempotent queued replay、Redis enqueue failure marks run failed、Redis unavailable rate-limit；`./node_modules/.bin/vitest run src/lib/jobs/submit.test.ts src/app/api/v1/jobs/sync/route.test.ts src/app/api/v1/jobs/score/route.test.ts` -> 3 files / 8 tests passed

- [x] T010 Queue 化 `/api/v1/jobs/sync`
  - scope: `src/app/api/v1/jobs/sync/route.ts`, `src/app/api/v1/jobs/sync/route.test.ts`
  - maps_to: US1 / US4 / FR-002
  - work: 保留 body schema/auth/scope/idempotency；改为调用 submit service；不再调用 `SyncOrchestrator` 直接执行
  - verify: route test 覆盖 idempotency key required 和 quick queued response；route 不再调用 synchronous `runAutomationRoute`

- [x] T011 Queue 化 `/api/v1/jobs/score`
  - scope: `src/app/api/v1/jobs/score/route.ts`, `src/app/api/v1/jobs/score/route.test.ts`
  - maps_to: US1 / US4 / FR-002
  - work: 保留 body schema/auth/scope/idempotency；改为调用 submit service；不再调用 `InboxScoringService.runBatch` 直接执行
  - verify: route test 覆盖 body validation 和 quick queued response；route 不再调用 synchronous `runAutomationRoute`；`./node_modules/.bin/tsc --noEmit` passed

- [x] T012 更新 OpenAPI 和 automation docs
  - scope: `src/lib/automation/openapi.ts`, `src/app/api/v1/openapi.json/route.test.ts`, `docs/automation-plan-admin.md`
  - maps_to: US4 / FR-002 / FR-003
  - work: 标注 sync/score 返回 queued job envelope；status enum 包含 queued/running/cancelled；说明 Redis unavailable 行为
  - verify: `./node_modules/.bin/vitest run src/app/api/v1/openapi.json/route.test.ts src/app/api/v1/jobs/sync/route.test.ts src/app/api/v1/jobs/score/route.test.ts` -> 3 files / 7 tests passed；`./node_modules/.bin/tsc --noEmit` passed

---

## Phase 4: Worker 执行层

**目标**: 独立 worker 领取 job，执行业务服务，并写回 durable evidence。

- [x] T013 实现 worker handlers
  - scope: `src/lib/jobs/worker-handlers.ts`, `src/lib/jobs/worker-handlers.test.ts`
  - maps_to: FR-006 / NFR-002
  - work: `sync.run` 调用 `DataSourceService` + `SyncOrchestrator.syncDataSource`；`score.run` 调用 `InboxScoringService.runBatch`
  - verify: `./node_modules/.bin/vitest run src/lib/jobs/worker-handlers.test.ts` -> 1 file / 7 tests passed；`./node_modules/.bin/tsc --noEmit` passed。handlers tests 覆盖 succeeded、empty、partial_success、failed result mapping

- [x] T014 实现 automation worker entrypoint
  - scope: `src/workers/automation-worker.ts`, `src/lib/jobs/worker.ts`, worker tests
  - maps_to: CD-007 / US5
  - work: 创建 BullMQ Worker，处理 active/completed/failed events，刷新 heartbeat，更新 Redis status 和 `automation_runs`
  - verify: `./node_modules/.bin/vitest run src/lib/jobs/worker.test.ts src/lib/jobs/worker-handlers.test.ts` -> 2 files / 11 tests passed；`./node_modules/.bin/tsc --noEmit` passed。worker tests 覆盖 queued -> running -> terminal、final failure、attempt retry、heartbeat/status update

- [x] T015 迁移 inbox scoring scheduler 到 enqueue 语义
  - scope: `src/lib/scheduling/inbox-scoring-scheduler.ts`, scheduler tests if present
  - maps_to: Scope transition / prior cron risk
  - work: hourly scheduler 不再直接 `runBatch`；改为使用 automation token/service identity 提交 `score.run` job，或明确 disabled until worker is enabled
  - verify: `./node_modules/.bin/vitest run src/lib/scheduling/inbox-scoring-scheduler.test.ts src/lib/automation/auth.test.ts src/lib/jobs/worker-handlers.test.ts` -> 3 files / 17 tests passed；`./node_modules/.bin/tsc --noEmit` passed；`rg` confirmed scheduler has no `runBatch` call

- [x] T016 处理 legacy sync/score compatibility paths
  - scope: `src/app/api/inbox/score-batch/route.ts`, `src/app/api/sources/sync-all/route.ts`, docs/tests
  - maps_to: Scope Boundaries / migration safety
  - work: 明确旧 human/legacy route 是保持同步、代理到 queue、还是标注 legacy；不得产生双重自动化事实
  - verify: `./node_modules/.bin/vitest run src/app/api/inbox/score-batch/route.test.ts src/app/api/sources/sync-all/route.test.ts src/lib/scheduling/inbox-scoring-scheduler.test.ts` -> 3 files / 7 tests passed；`./node_modules/.bin/tsc --noEmit` passed。legacy human routes 保持同步执行并用 headers 标注不写 `automation_runs`

---

## Phase 5: Status、health 与 retry

**目标**: 让 Admin UI/API 能查询任务状态、worker 健康和失败恢复。

- [x] T017 实现 job status reader
  - scope: `src/lib/jobs/status.ts`, `src/lib/jobs/status.test.ts`
  - maps_to: US2 / FR-003 / FR-012
  - work: 合并 `automation_runs`、BullMQ job、Redis status；Redis 过期时返回 history-only 状态
  - verify: `./node_modules/.bin/vitest run src/lib/jobs/status.test.ts src/lib/jobs/worker.test.ts` -> 2 files / 9 tests passed；`./node_modules/.bin/tsc --noEmit` passed。单测覆盖 retained Redis snapshot、expired Redis history-only、failed durable run、BullMQ active fallback、not found

- [x] T018 新增 automation job status endpoint
  - scope: `src/app/api/v1/jobs/[id]/route.ts`, route tests, OpenAPI
  - maps_to: US2 / US4
  - work: automation caller 可按 run id 查询 status；保留 auth/scope
  - verify: `./node_modules/.bin/vitest run 'src/app/api/v1/jobs/[id]/route.test.ts' src/lib/jobs/status.test.ts src/app/api/v1/openapi.json/route.test.ts` -> 3 files / 13 tests passed；`./node_modules/.bin/tsc --noEmit` passed。route test 覆盖 authorized status、not found、Redis expired fallback、scope forbidden

- [x] T019 新增 retry service 和 endpoint
  - scope: `src/lib/jobs/retry.ts`, `src/app/api/v1/jobs/[id]/retry/route.ts`, tests
  - maps_to: US2-3 / FR-007
  - work: 对 failed retryable run 创建新 job/attempt link，保留原失败证据；不可重试错误返回明确原因
  - verify: `./node_modules/.bin/vitest run src/lib/jobs/retry.test.ts 'src/app/api/v1/jobs/[id]/retry/route.test.ts' src/app/api/v1/openapi.json/route.test.ts` -> 3 files / 13 tests passed；`./node_modules/.bin/tsc --noEmit` passed。tests 覆盖 retryable failure、non-failed run cannot retry、payload retained/digest-preserving idempotency、missing retained payload、scope forbidden、unsupported reserved workflow

- [x] T020 新增 worker health summary
  - scope: `src/lib/jobs/health.ts`, `src/app/api/health/route.ts` or `startup/route.ts`, tests
  - maps_to: US5 / FR-008
  - work: 汇总 queue depth、oldest queued age、failed count、heartbeat freshness；health degraded 不误报核心 app down
  - verify: `./node_modules/.bin/vitest run src/lib/jobs/health.test.ts src/app/api/health/route.test.ts` -> 2 files / 8 tests passed；`./node_modules/.bin/tsc --noEmit` passed。tests 覆盖 healthy、stale heartbeat、backlog threshold、Redis unavailable；`/api/health` jobQueue degraded 只降级 overall，不返回 503

---

## Phase 6: Admin UI 可见面

**目标**: 在现有 dashboard/workbench runs 区域展示 queue/worker 状态，不先新增完整任务中心页面。

- [x] T021 新增 cookie-auth job summary wrapper
  - scope: `src/app/api/weekly/workbench/jobs/route.ts`, route tests
  - maps_to: CD-003 / FR-008
  - work: 为 dashboard/workbench 提供 queue depth、running、failed/retryable、worker health summary
  - verify: `./node_modules/.bin/vitest run src/app/api/weekly/workbench/jobs/route.test.ts src/lib/jobs/health.test.ts` -> 2 files / 7 tests passed；`./node_modules/.bin/tsc --noEmit` passed。route test 覆盖正常、Redis unavailable degraded、auth required

- [x] T022 增强 dashboard job status surface
  - scope: `src/components/dashboard/weekly-production-dashboard.tsx`, tests
  - maps_to: US2 / US5
  - work: 在现有驾驶舱加入 queued/running/failed/retryable/worker stale 状态
  - verify: `./node_modules/.bin/vitest run src/components/dashboard/weekly-production-dashboard.test.tsx src/app/api/weekly/workbench/jobs/route.test.ts` -> 2 files / 9 tests passed；`./node_modules/.bin/tsc --noEmit` passed。component test 覆盖 queue normal、backlog warning、worker stale、history-only/Redis unavailable

- [x] T023 增强 workbench runs timeline
  - scope: `src/components/weekly/AutomationRunTimeline.tsx`, `src/components/weekly/WeeklyWorkbench.tsx`, tests
  - maps_to: US2 / FR-008
  - work: 支持 queued/running/retryable、status expired、retry action placeholder 或 API trigger
  - verify: `./node_modules/.bin/vitest run src/components/weekly/AutomationRunTimeline.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx` -> 2 files / 8 tests passed；`./node_modules/.bin/tsc --noEmit` passed。component tests 覆盖 queued/running/failed/retryable、history-only/status expired、retry placeholder

---

## Phase 7: 验证、文档与收口准备

**目标**: 为 execute/verify/closeout 提供可复现证据路径。

- [x] T024 更新 targeted tests
  - scope: automation/job route/service/component focused tests
  - maps_to: NFR-005
  - work: 整理最小测试集合，覆盖 queue、lock、idempotency、retry、Redis unavailable、run evidence、UI degraded
  - verify: `./node_modules/.bin/vitest run src/lib/config-validation.test.ts src/lib/jobs/connection.test.ts src/lib/jobs/definitions.test.ts src/lib/jobs/locks.test.ts src/lib/jobs/rate-limit.test.ts src/lib/jobs/submit.test.ts src/lib/jobs/worker-handlers.test.ts src/lib/jobs/worker.test.ts src/lib/jobs/status.test.ts src/lib/jobs/retry.test.ts src/lib/jobs/health.test.ts src/lib/automation/auth.test.ts src/lib/automation/contracts.test.ts src/lib/automation/run.test.ts src/app/api/v1/jobs/sync/route.test.ts src/app/api/v1/jobs/score/route.test.ts 'src/app/api/v1/jobs/[id]/route.test.ts' 'src/app/api/v1/jobs/[id]/retry/route.test.ts' src/app/api/v1/openapi.json/route.test.ts src/app/api/health/route.test.ts src/app/api/weekly/workbench/jobs/route.test.ts src/app/api/inbox/score-batch/route.test.ts src/app/api/sources/sync-all/route.test.ts src/components/dashboard/weekly-production-dashboard.test.tsx src/components/weekly/AutomationRunTimeline.test.tsx src/components/weekly/WeeklyWorkbench.test.tsx src/lib/scheduling/inbox-scoring-scheduler.test.ts` -> 27 files / 113 tests passed

- [x] T025 运行静态检查
  - scope: repo
  - maps_to: repo quality gate
  - work: 运行 type/lint，记录既有 warnings 与本 feature 错误
  - verify: `./node_modules/.bin/tsc --noEmit` passed；`pnpm lint` 未进入 lint，因 pnpm 先触发 install/deps purge 并在非 TTY 下报 `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]`；改跑等价本地二进制 `./node_modules/.bin/eslint .` -> 0 errors / 462 warnings（既有 warnings 为主，包括 no-explicit-any、set-state-in-effect、no-require-imports 等）

- [x] T026 编写 local/NAS worker 启动说明
  - scope: `docs/automation-plan-admin.md`, optional deployment notes
  - maps_to: CD-007 / US5
  - work: 记录 `pnpm worker:automation`、Redis env、Docker/NAS worker command、health smoke
  - verify: `rg -n "worker:automation|weekly-admin-worker|REDIS_URL|services\\.jobQueue|JOB_TARGET_LOCK_TTL|JOB_WORKER_HEARTBEAT" docs/automation-plan-admin.md docs/nas-deployment.md docker/docker-compose.nas.yml docker/Dockerfile package.json` confirmed local/NAS worker paths；`./node_modules/.bin/tsc --noEmit` passed。另补 `docker/Dockerfile` runner copy `src`/`tsconfig.json`，确保同镜像 `pnpm worker:automation` 可执行

- [x] T027 执行 verification replay
  - scope: `specs/redis-job-orchestration/acceptance.md` draft or verify notes
  - maps_to: Feature Traits / Evidence Gate
  - work: 执行 smoke：启动 Redis + app + worker；提交 score job；验证 quick response、worker completion、`automation_runs` terminal、UI visible status
  - verify: `specs/redis-job-orchestration/acceptance.md` 已记录 Evidence Table、PASS 三维 verdict、Redis/app/worker smoke steps、pass criteria、verification commands 和 closeout checklist；runtime smoke run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` 已通过 orchestration 闭环

---

## Coverage Matrix

| Spec item | Tasks |
|---|---|
| US1 job submission / idempotency | T004, T005, T009, T010, T011 |
| US2 status / retry | T017, T018, T019, T023 |
| US3 lock / rate-limit / stale recovery | T007, T008, T009, T014 |
| US4 contract compatibility | T010, T011, T012, T018 |
| US5 worker health | T014, T020, T021, T022 |
| FR-001 queue | T001, T003, T006, T009 |
| FR-006 durable run evidence | T005, T013, T014, T017 |
| FR-009 Redis unavailable | T002, T003, T009, T020, T021 |
| NFR-005 tests | T024, T025, T027 |

---

## Execution Readiness

- 推荐下一步：`specify hermes-weekly-intelligence`
- 阻塞项：无。
- 已完成执行顺序：Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7
- 当前 checkpoint：T001-T027 已完成；`acceptance.md` 记录 PASS、runtime smoke evidence、closeout checklist、Knowledge Capture 和 commit plan 状态。当前 feature 已完成，下一步回到 `admin-modernization-roadmap` 创建 `hermes-weekly-intelligence` workspace。

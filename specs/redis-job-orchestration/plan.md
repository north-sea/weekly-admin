# Implementation Plan: Redis Job Orchestration

**Workspace**: `redis-job-orchestration` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/redis-job-orchestration/spec.md`

---

## Summary

本计划把现有同步执行的 `/api/v1/jobs/sync` 和 `/api/v1/jobs/score` 改造成 Redis-backed job submission + independent worker execution。推荐方案是在现有 Next.js/Prisma 单体内新增轻量 job boundary，使用 BullMQ 管理 queue/worker/retry/status，使用 Redis 保存执行控制状态，继续使用 MySQL `automation_runs` 作为 durable run evidence。

候选方案讨论已跳过：`spec.md` 的 clarify decisions 已固定 Redis 只做执行控制层、第一批只迁移 sync/score、MVP 不新增持久 job 表、worker 不能绑在 request lifecycle。Plan 仍在 ADR 中记录被放弃方案和代价。

---

## Architecture Overview

当前系统已有 automation auth/scope/idempotency 和 `automation_runs`，但长任务仍在 API route 内同步执行。本 feature 在 `/api/v1` caller boundary 后增加 job layer：

```text
n8n / cron / Admin UI wrapper / future Hermes
        |
        v
/api/v1/jobs/sync or /api/v1/jobs/score
        |
        | auth + scope + idempotency + request digest
        v
automation_runs (queued/running/terminal durable evidence)
        |
        v
BullMQ Queue on Redis
        |
        v
Automation Worker process
        |
        +--> SyncOrchestrator.syncDataSource(...)
        +--> InboxScoringService.runBatch(...)
        |
        v
automation_runs result/error + Redis ephemeral status/heartbeat
        |
        v
Admin dashboard/workbench job status surface
```

提交 API 只负责鉴权、幂等、创建/复用 run、入队和返回 job status，不执行长任务。Worker 独立进程负责领取 job、刷新 heartbeat、执行业务服务、更新 `automation_runs` 和 Redis status。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|---|---|---|---|---|
| Queue / Worker pattern | https://github.com/study8677/awesome-architecture/blob/main/tutorial/04-%E5%8D%81%E5%A4%A7%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84%E6%A8%A1%E5%BC%8F.md | 长任务从 request lifecycle 转入后台 worker；适合 sync/score 批处理 | 不引入完整 DAG、跨服务事务或多租户调度平台 | 成长期 |
| BullMQ Redis queue | https://github.com/taskforcesh/bullmq | Queue/Worker/QueueEvents、jobId 幂等、attempts/backoff、Redis-backed status 能覆盖 MVP | 不把 BullMQ job record 当业务事实源；repeatable jobs 不作为第一批 cron 替换条件 | 成长期 |
| Existing automation contract | `specs/agent-and-automation-contracts/plan.md` | 复用 token/scope/idempotency/response envelope/`automation_runs` | 不重开 API 契约设计，不绕过 Admin service/API | 成长期 |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `/api/v1/jobs/sync` submitter | `automation_runs` row with `queued` status and request digest | Repeated caller, Admin UI, worker | Same `Idempotency-Key` returns same run/job; payload conflict returns 409 |
| `/api/v1/jobs/score` submitter | BullMQ job with `jobId = runId` | Automation worker | Worker receives job and transitions Redis status / `automation_runs.status` to `running` |
| Automation worker | sync/score result summary | `automation_runs.result_summary`, dashboard/workbench runs | Completed job has terminal status and result counts visible via API/UI |
| Automation worker | error code/message and attempt metadata | retry API, operator UI, future n8n/Hermes | Failed job is visible as retryable with original failure evidence retained |
| Redis job status keys | queued/running/retryable/backlog/queue depth | Admin task surface | UI/API shows queue depth, running jobs, failed count, worker heartbeat |
| Worker heartbeat | `last_seen`, `current_job`, processed counters | health endpoint / task surface | Health returns degraded when heartbeat stale or queue backlog exceeds threshold |
| Redis lock/rate-limit keys | conflict/retry-after decisions | submit APIs and automation callers | Duplicate target is rejected/reused consistently; rate-limit response includes retry-after |

**孤儿 artifact 处理**: weekly suggest/apply/publish 的 job type/status 先作为 `data-model.md` 中的 reserved workflow types 登记；第一批不产生 Redis job，因此没有 active orphan artifact。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|---|---|---|---|
| 一致性 | MySQL `automation_runs` 是 durable run fact | Redis status 只做 ephemeral 查询和执行控制；terminal outcome 必须落 MySQL | run evidence service tests |
| 可观测性 | queued/running/failed/retryable/worker health 可见 | 新增 job status reader 和 task surface 聚合 | API/component tests |
| 可靠性 | worker crash、重复提交、stale lock 可恢复 | BullMQ attempts/backoff + Redis TTL lock + heartbeat stale detection | queue/lock/retry tests |
| 安全性 | 保留 automation token/scope | submit/status/retry API 走既有 auth/scope；UI 走 cookie wrapper | auth regression tests |
| 可演进性 | 后续 n8n/Hermes 使用同一 job language | workflow/job type registry 独立于具体 sync/score handler | data-model review + OpenAPI snapshot |

---

## Capacity / Scale Notes

- **规模假设**: 个人/小团队 Admin；sync/score 是低并发批处理，目标并发 worker 1-3。
- **读写特征**: submission 写少，status/health 读多；业务写入仍由 MySQL/Prisma 服务层完成。
- **失败代价**: 不能丢任务、不能重复外部副作用、不能让 running 状态永久卡住；可接受 Redis 不可用时明确失败并要求重试。
- **Retention**: Redis completed/failed job retention 以天级或数量级限制；长期历史只查 `automation_runs`。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|---|---|---|---|---|---|
| ADR-001 queue library | 需要可靠 queue/worker/retry/status | A: BullMQ; B: 手写 Redis list/lock; C: 继续同步 route | 选 BullMQ | 新增依赖和 Redis 连接配置；需学习 BullMQ failure semantics | BullMQ docs |
| ADR-002 durable evidence | Redis job status 不应成为事实源 | A: 继续 `automation_runs`; B: 新 job 表; C: Redis only | 选 A，MVP 不新增表 | attempt 历史主要保存在 Redis/result summary，复杂查询能力有限 | spec CD-006 |
| ADR-003 worker topology | request lifecycle 不能跑长任务 | A: 独立 Node worker; B: Next API route drain; C: croner only | 选 A；NAS Docker 可用同镜像不同 command | 部署需要新增 worker command/process health | spec CD-007 |
| ADR-004 Redis unavailable | 不应返回成功后丢任务 | A: 明确失败; B: 静默同步 fallback; C: 内存队列 fallback | 默认 A | Redis down 时 sync/score 不可用，需要运维处理 | spec CD-005 |
| ADR-005 first migration slice | 降低外部副作用回归 | A: sync/score; B: sync/score/publish; C: 全部 weekly | 选 A | publish/suggest/apply 暂不享受 worker retry/status | spec CD-004 |

---

## Key Design Decisions

### Decision 1: 使用 BullMQ 管理 queue/worker

- **背景**: 现有代码没有 Redis queue client；手写 queue/lock/retry 容易漏掉 stalled/retry/status 细节。
- **选项**:
  - A: BullMQ + Redis - 覆盖 Queue/Worker/QueueEvents、jobId dedupe、attempt/backoff。
  - B: 原生 Redis list/set + Lua - 依赖少，但要自建 retry、stalled 和 status。
  - C: 保持同步 route + `croner` - 无新增依赖，但无法解决 request lifecycle 和可观测性。
- **结论**: 选择 BullMQ；Redis key/lock/rate-limit 仍由本 feature 控制，不把 BullMQ 当事实源。
- **影响**: 新增 `bullmq` 和 Redis client 依赖；新增 worker 启动命令和连接配置。
- **来源**: https://github.com/taskforcesh/bullmq

### Decision 2: 拆分 automation run lifecycle helper

- **背景**: 当前 `runAutomationRoute` + `withAutomationRun` 会在 route handler 内执行任务；queue 模式需要先 create/replay run，再由 worker complete/fail run。
- **选项**:
  - A: 扩展 `withAutomationRun` 为 submit/complete 两段式 helper。
  - B: Worker 内再次调用现有 `withAutomationRun`。
- **结论**: 选择 A。新增或提取 `createQueuedAutomationRun`、`markAutomationRunRunning`、`completeAutomationRun`、`failAutomationRun` 等 helper。
- **影响**: 保持既有 idempotency conflict 语义；现有同步 route tests 要更新为 queued response。
- **来源**: 当前代码 `src/lib/automation/run.ts`

### Decision 3: `automation_runs.status` 扩展到 queued/cancelled

- **背景**: spec 要求 queued/running/succeeded/partial_success/failed/cancelled/skipped；Prisma schema 中 status 是 `String`，无需 schema change。
- **选项**:
  - A: 扩展 TypeScript union 和响应映射。
  - B: 新增 MySQL enum/table。
- **结论**: 选择 A。`queued` 表示已创建 run 并成功入队；`running` 表示 worker 已领取；terminal 状态继续沿用现有语义。
- **影响**: 不新增 Prisma migration；UI 和 OpenAPI 需要更新 status enum。
- **来源**: 当前 `prisma/schema.prisma` 和 spec CD-006

### Decision 4: 任务中心先增强现有 dashboard/workbench runs

- **背景**: spec 允许复用现有入口；完整新页面会扩大 UI 改动。
- **选项**:
  - A: 增强 dashboard/workbench runs 区域，新增 worker/backlog summary。
  - B: 新建 `/jobs` 任务中心页面。
- **结论**: 选择 A 作为 MVP；如果 UI 信息密度超出 runs 区域，再在后续任务拆出页面。
- **影响**: 复用 `AutomationRunTimeline` 和 weekly workbench summary；减少导航和路由变更。
- **来源**: spec CD-003

---

## Module Design

### Module: Redis / BullMQ connection

**职责**: 统一创建 Redis/BullMQ connection，配置 key prefix、超时和 health check。

**改动概述**: 新增 `src/lib/jobs/connection.ts`，读取 `REDIS_URL`、`JOB_QUEUE_PREFIX`、`JOB_QUEUE_DISABLED` 等环境变量。

**关键接口 / 行为**:

```text
getJobRedisConnection()
  validates REDIS_URL
  sets BullMQ-compatible options
  returns shared connection for Queue/Worker/QueueEvents

checkJobRedisHealth()
  pings Redis
  returns ok/degraded with error code
```

**注意事项**:

- Redis 不可用时 submit API 默认返回 503/degraded，不执行同步 fallback。
- 测试中使用 mock adapter，不要求真实 Redis。

### Module: Job type registry

**职责**: 定义 workflow、job name、target lock、scope、retry 和 rate-limit 策略。

**改动概述**: 新增 `src/lib/jobs/definitions.ts`。

**关键接口 / 行为**:

```text
sync.run
  scope: sync:run
  target: data_source:{sourceId} or data_sources:all
  attempts: 2
  backoff: exponential

score.run
  scope: score:run
  target: inbox:score_batch
  attempts: 2
  backoff: exponential

weekly.suggest/apply/publish
  reserved status mapping only in MVP
```

**注意事项**:

- publish 不迁入第一批 worker。
- target lock key 必须稳定，不使用原始 payload 字符串。

### Module: Automation job submitter

**职责**: 在 `/api/v1/jobs/*` route 后创建/复用 run，检查 lock/rate-limit，入队并返回 job status。

**改动概述**: 新增 `src/lib/jobs/submit.ts`，重构 sync/score route 从 synchronous handler 切到 submitter。

**关键接口 / 行为**:

```text
submitAutomationJob({ caller, workflow, step, target, idempotencyKey, payload })
  digest payload
  find/create automation_runs queued record
  reject payload conflict
  if existing queued/running -> return current job status
  check rate-limit and target lock/index
  queue.add(jobName, payloadWithRunId, { jobId: runId, attempts, backoff })
  return { jobId, runId, status, target, statusUrl }
```

**注意事项**:

- 如果 run 创建后入队失败，必须把 run 标记为 `failed`，error code 为 Redis/queue error，并返回 503。
- `jobId = runId`，避免同一 run 重复入队。

### Module: Automation worker

**职责**: 独立处理 BullMQ jobs，并把执行结果写回 `automation_runs`。

**改动概述**: 新增 `src/workers/automation-worker.ts` 或 `scripts/workers/automation-worker.ts`，并新增 `pnpm worker:automation`。

**关键接口 / 行为**:

```text
Worker('automation')
  on job active:
    mark run running
    acquire/refresh target lock
    update heartbeat
  execute:
    sync.run -> SyncOrchestrator.syncDataSource/listDataSources
    score.run -> InboxScoringService.runBatch
  on completed:
    complete automation_runs with result summary/status
    release lock/index
  on failed:
    fail automation_runs only after final attempt
    retain retryable status in Redis between attempts
```

**注意事项**:

- Worker 不能依赖 Next request context。
- Worker 必须安全处理 process restart；stale lock 用 TTL 恢复。

### Module: Job status / health reader

**职责**: 聚合 Redis ephemeral status、BullMQ queue counts、worker heartbeat 和 `automation_runs` durable history。

**改动概述**: 新增 `src/lib/jobs/status.ts`；新增 automation status endpoint 和 cookie-auth UI wrapper。

**关键接口 / 行为**:

```text
getJobStatus(runId)
  read automation_runs durable row
  read Redis/BullMQ job if retained
  merge status, attempt, queue position, worker, error

getJobDashboardSummary()
  queue depth
  running jobs
  failed/retryable count
  oldest queued age
  worker heartbeat status
```

**注意事项**:

- Redis status 缺失时不能删除 durable history；UI 显示 "history only / status expired"。
- 查询必须有 limit/filter，避免拖慢 dashboard。

### Module: Retry API

**职责**: 允许对失败且可重试的 run 创建新的 attempt/job，同时保留原失败证据。

**改动概述**: 新增 retry service，优先复用原 payload digest 和 target；是否新增 endpoint 由 tasks 阶段拆分。

**关键接口 / 行为**:

```text
retryAutomationRun(runId)
  require same scope as original workflow
  require terminal failed and retryable error
  create new idempotency key suffix or attempt id
  enqueue new job linked to original run
  preserve original error in result summary/history
```

**注意事项**:

- MVP 可先支持 API retry，不强制完整 UI retry button；但 UI 必须能显示 retryable 状态。
- 如 attempt 历史需求超过 `automation_runs.result_summary` 能力，再回到 plan 评估持久 job_attempts 表。

---

## Data Model

本 feature 不默认新增 MySQL 表或 Prisma migration。详细 Redis key、status、payload 和 `automation_runs` 映射见 [data-model.md](data-model.md)。

核心原则：

- Redis: queue、lock、rate-limit、ephemeral status、heartbeat。
- MySQL: `automation_runs` durable run evidence。
- BullMQ job id: 使用 `automation_runs.id`。
- `automation_runs.status`: TypeScript union 扩展 `queued` / `cancelled`，schema 不变。

---

## Project Structure

```text
src/lib/jobs/
  connection.ts
  definitions.ts
  submit.ts
  status.ts
  locks.ts
  rate-limit.ts
  worker-handlers.ts
src/workers/
  automation-worker.ts
src/app/api/v1/jobs/
  sync/route.ts
  score/route.ts
  [id]/route.ts              # optional status endpoint
  [id]/retry/route.ts        # optional retry endpoint
src/app/api/weekly/workbench/
  jobs/route.ts              # cookie-auth UI summary wrapper, optional
specs/redis-job-orchestration/
  plan.md
  data-model.md
```

---

## Risks and Tradeoffs

- BullMQ 新增依赖和 Redis runtime 配置；需要确保本地、NAS Docker 和生产环境都有明确启动/禁用策略。
- `automation_runs` 没有专用 attempt 表；MVP 通过 Redis + result summary 保留 attempt 信息，复杂历史查询会受限。
- 如果 Redis job 已过 retention，UI 只能展示 durable run history，不能恢复 queue position。
- Worker 与 Next app 同仓库同服务层，部署简单，但仍需要额外进程监控。
- sync/score response 会从 "同步完成结果" 变成 "queued/running status"；需要更新 tests、OpenAPI 和调用方期望。

---

## Evolution Path

- **MVP**: BullMQ queue + independent worker；迁移 `/api/v1/jobs/sync` 和 `/api/v1/jobs/score`；dashboard/workbench 显示 queue/worker summary；不新增 MySQL job 表。
- **成长期**: 将 inbox scoring `croner` 改为 repeatable/scheduled job；把 Karakeep resync 内存 `Map` 状态迁入 Redis job status；评估 publish worker 化。
- **成熟期**: 如果 attempt 历史、dead-letter 审计、跨 workflow 查询成为常态，再新增 `jobs` / `job_attempts` 持久表或独立任务中心页面。

---

## Anti-Pattern Check

- **Redis as source of truth**: 禁止。Redis status 过期不影响 `automation_runs` 历史。
- **Silent fallback**: 禁止默认开启。Redis unavailable 必须明确失败。
- **Fake automation token**: 禁止。UI wrapper 仍应服务端委托正式 automation token 或读取 cookie-auth summary。
- **Long task in route**: 禁止。submit route 不调用 `SyncOrchestrator` 或 `InboxScoringService.runBatch`。
- **Big-bang migration**: 禁止。第一批只迁移 sync/score。

---

## Verification Strategy

- Unit tests:
  - idempotency replay and payload conflict in queued mode
  - Redis unavailable returns degraded/503 and no silent success
  - lock conflict and rate-limit retry-after
  - status merge when Redis status exists, expired, or worker heartbeat stale
- Worker tests:
  - sync/score job transitions queued -> running -> terminal
  - final failure updates `automation_runs.error_code/error_message`
  - retry/backoff retains original failure evidence
- Route tests:
  - `/api/v1/jobs/sync` and `/api/v1/jobs/score` return job/run/status envelope
  - auth/scope behavior remains compatible with existing contract tests
  - OpenAPI includes queued/running and status/retry endpoints if added
- UI tests:
  - dashboard/workbench shows queue depth, running, failed/retryable, stale worker
  - Redis status unavailable degrades without hiding durable `automation_runs`
- Manual/runtime smoke:
  - start Next app + worker + Redis
  - submit score job with `Idempotency-Key`
  - verify quick submit response, worker completion, `automation_runs` terminal row, UI visible status

---

## Stage Readiness

- 推荐下一步：`tasks redis-job-orchestration`
- 阻塞项：无。方案已固定 BullMQ + independent worker + Redis ephemeral status + `automation_runs` durable evidence。
- 需要在 tasks 阶段拆分的重点：依赖安装、run lifecycle helper、sync/score route queue 化、worker、status/health API、UI summary、OpenAPI/tests、NAS/local worker 启动说明。

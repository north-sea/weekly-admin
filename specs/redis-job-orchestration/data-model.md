# Data Model: Redis Job Orchestration

**Workspace**: `redis-job-orchestration` | **Date**: 2026-06-07

> 本文件记录 Redis key/status/payload 与既有 `automation_runs` 的映射。MVP 不新增 MySQL 表或 Prisma migration。

---

## Storage Ownership

| 存储 | 职责 | Retention | 是否事实源 |
|---|---|---|---|
| MySQL `automation_runs` | durable run id、caller、workflow、idempotency、request digest、terminal result/error | 长期 | 是，运行证据事实源 |
| Redis / BullMQ | queue、job status、attempt in progress、lock、rate-limit、worker heartbeat | 短期 TTL/数量限制 | 否 |
| MySQL business tables | `inbox_items`、`contents`、`weekly_issues` 等业务结果 | 长期 | 是，业务事实源 |

---

## Entities

### Automation Run (表名: `automation_runs`)

**描述**: 继续作为 durable run evidence。Queue 模式只扩展状态语义，不改 schema。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | String(64) | PK | `runId`，同时作为 BullMQ `jobId` |
| token_id | Int | FK | automation caller token |
| workflow | String(80) | INDEX | `sync` / `score` / reserved weekly workflows |
| step | String(80) | INDEX | 第一批为 `run` |
| target_type | String? | INDEX | `data_source` / `data_sources` / `inbox` |
| target_id | String? | INDEX | source id、`all` 或 batch target |
| idempotency_key | String(160) | UNIQUE with token/workflow/step | caller-provided key |
| request_digest | String(128) | NOT NULL | stable payload digest |
| status | String(30) | INDEX | `queued` / `running` / `succeeded` / `partial_success` / `skipped` / `empty` / `failed` / `cancelled` |
| result_summary | Json? | nullable | terminal counts、attempt summary、retry source |
| error_code | String? | nullable | terminal failure code |
| error_message | String? | nullable | terminal failure message |
| started_at | DateTime? | existing default | submission time in MVP；worker start time kept in Redis status |
| finished_at | DateTime? | nullable | terminal completion time |

**Rules**:

- Same token + workflow + step + idempotency key + same digest returns existing run/job state.
- Same idempotency key with different digest returns `IDEMPOTENCY_PAYLOAD_CONFLICT`.
- `queued` means run record exists and BullMQ enqueue succeeded.
- `running` means worker claimed the BullMQ job.
- Terminal statuses must be written even if Redis status later expires.

### BullMQ Job (Redis)

**描述**: Redis queue execution unit. It is not durable business evidence.

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| queue | String | fixed | `automation` |
| name | String | enum | `sync.run` / `score.run` |
| jobId | String | unique while retained | equals `automation_runs.id` |
| data.runId | String | required | linked automation run |
| data.workflow | String | required | mirrors run workflow |
| data.step | String | required | mirrors run step |
| data.target | Object | required | lock target |
| data.payload | Object | required | validated route payload |
| opts.attempts | Number | configured | default 2 for sync/score |
| opts.backoff | Object | configured | exponential/fixed per workflow |
| opts.removeOnComplete | Object | configured | bounded retention; do not remove too aggressively if jobId dedupe is needed |
| opts.removeOnFail | Object | configured | bounded failed retention for UI/debug |

**Rules**:

- `jobId = runId` prevents duplicate queue insertion for the same durable run.
- BullMQ job completion is not sufficient; worker must update `automation_runs`.
- BullMQ retention can expire; UI must then fall back to `automation_runs`.

### Redis Job Status Key

**Key**: `{prefix}:status:{runId}`

**描述**: UI/API-friendly ephemeral job status snapshot.

| Field | Type | TTL | 说明 |
|---|---|---|---|
| runId | string | same key TTL | linked run |
| jobId | string | same key TTL | BullMQ job id |
| workflow | string | same key TTL | `sync` / `score` |
| step | string | same key TTL | `run` |
| status | string | same key TTL | queued/running/retrying/retryable/failed/succeeded/expired |
| attempt | number | same key TTL | current BullMQ attempt |
| maxAttempts | number | same key TTL | configured attempts |
| workerId | string? | same key TTL | active worker |
| queuedAt | ISO string | same key TTL | enqueue time |
| startedAt | ISO string? | same key TTL | worker start time |
| updatedAt | ISO string | same key TTL | last status update |
| errorCode | string? | same key TTL | latest error |
| errorMessage | string? | same key TTL | latest error summary |

**Rules**:

- TTL should outlive normal operator debugging window, e.g. 7 days or bounded by config.
- Missing key means Redis status expired or Redis unavailable, not that the durable run disappeared.

### Redis Target Lock / Active Index

**Key**: `{prefix}:lock:{workflow}:{targetKey}`

**描述**: 防止同一 workflow/target 冲突执行。

| Field | Type | TTL | 说明 |
|---|---|---|---|
| runId | string | required | owner run |
| workflow | string | required | workflow |
| targetKey | string | required | normalized target |
| acquiredAt | ISO string | required | lock time |
| heartbeatAt | ISO string? | optional | last worker refresh |

**Rules**:

- Same idempotency key can return existing owner run.
- Different idempotency key on same target returns conflict or configured queued behavior; MVP uses conflict.
- TTL prevents permanent stale locks. Worker refreshes while active and releases on terminal state.

### Redis Rate Limit Bucket

**Key**: `{prefix}:rate:{scope}:{callerOrWorkflow}:{window}`

**描述**: caller/workflow 级频率控制。

| Field | Type | TTL | 说明 |
|---|---|---|---|
| count | number | window TTL | request count |
| resetAt | ISO string | window TTL | retry-after source |

**Rules**:

- Exceeding bucket returns rate-limit error and `retryAfter`.
- Rate limit must be checked before queue insertion.

### Worker Heartbeat

**Key**: `{prefix}:worker:{workerId}`

**描述**: Worker health and current processing snapshot.

| Field | Type | TTL | 说明 |
|---|---|---|---|
| workerId | string | heartbeat TTL | process id / hostname / random suffix |
| version | string | heartbeat TTL | app version if available |
| lastSeenAt | ISO string | heartbeat TTL | health freshness |
| currentRunId | string? | heartbeat TTL | active run |
| currentJobName | string? | heartbeat TTL | active job type |
| processedCount | number | heartbeat TTL | lifetime count |
| failedCount | number | heartbeat TTL | lifetime failure count |

**Rules**:

- Health is degraded when no heartbeat exists, heartbeat is stale, or oldest queued age exceeds threshold.
- Heartbeat TTL should be short, e.g. 2-3x heartbeat interval.

---

## Workflow / Target Registry

| Workflow | Step | BullMQ Job Name | Scope | Target Key | First Batch |
|---|---|---|---|---|---|
| `sync` | `run` | `sync.run` | `sync:run` | `data_source:{id}` or `data_sources:all` | yes |
| `score` | `run` | `score.run` | `score:run` | `inbox:score_batch` | yes |
| `weekly` | `suggest` | `weekly.suggest` | `weekly:suggest` | `weekly_issue:{id}` | reserved |
| `weekly` | `apply` | `weekly.apply` | `weekly:suggest` | `weekly_issue:{id}` | reserved |
| `weekly` | `publish` | `weekly.publish` | `weekly:publish` | `weekly_issue:{id}` | reserved |

---

## Status Mapping

| Redis / BullMQ State | `automation_runs.status` | UI Label | Notes |
|---|---|---|---|
| waiting/delayed | `queued` | queued | submit accepted, not yet active |
| active | `running` | running | worker claimed job |
| completed with all ok | `succeeded` | succeeded | terminal durable |
| completed with partial errors | `partial_success` | partial success | terminal durable |
| completed with no work | `empty` | empty | terminal durable |
| completed but skipped by policy | `skipped` | skipped | terminal durable |
| failed, attempts remain | `running` + Redis `retrying` | retrying | durable terminal not written yet |
| failed, no attempts remain | `failed` | failed | terminal durable |
| manually cancelled | `cancelled` | cancelled | optional MVP |
| Redis expired, MySQL terminal exists | MySQL status | history only | UI should show status expired note |

---

## Retention and Cleanup

- Redis status keys: configurable TTL, default proposal 7 days.
- Redis target locks: configurable TTL, default proposal 1 hour; worker active processing refreshes with heartbeat TTL so crash recovery stays fast.
- Worker heartbeat: short TTL, default proposal 60-180 seconds.
- BullMQ completed jobs: bounded by count and age; retain enough to support recent UI/status.
- BullMQ failed jobs: retain longer than completed jobs for debugging.
- `automation_runs`: no new retention policy in this feature.

---

## Migration Notes

- No Prisma migration is required for MVP.
- TypeScript types and OpenAPI status enum must include `queued` and `cancelled`.
- If implementation discovers a need for durable per-attempt history, return to plan and add Prisma models before coding that storage.

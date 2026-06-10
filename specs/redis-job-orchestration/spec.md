# Feature Specification: Redis Job Orchestration

**Workspace**: `redis-job-orchestration`
**Created**: 2026-06-07
**Status**: Draft
**Input**: 用户要求继续 `admin-modernization-roadmap` 下一项；roadmap 推荐 `specify redis-job-orchestration`

> `specs/.active` 已同步指向当前 workspace。

---

## Feature Traits

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 涉及 sync、score、weekly suggestions、apply、publish 等多个长任务阶段。 |
| `external-side-effects` | ✅ | 任务会触发 Karakeep/RSS 同步、AI 评分、周刊发布、Quail 投递等外部或数据库写入副作用。 |
| `artifact-handoff` | ✅ | Redis job/status 产物会被 Admin UI、automation contracts 和后续 Hermes/n8n 消费。 |
| `user-visible-output` | ✅ | 任务中心、运行中状态、失败原因和重试入口需要在 Admin UI 可见。 |
| `prior-closure-failure` | ✅ | 之前已出现端到端闭环和运行状态证据不足；本 feature 必须避免只新增队列而缺少可观测闭环。 |

**结论**: 下游 `plan` 必须启用 Producer-Consumer Matrix；`verify` 必须覆盖 queue/lock/status/retry 的 Evidence Gate；`closeout` 必须做 Workflow Replay。

---

## Context

`admin-shell-and-weekly-workbench` 已把首页和周刊工作台改成消费 `automation_runs` 的生产驾驶舱，但它刻意不引入 Redis。当前自动化契约已经存在：

- `/api/v1/jobs/sync`
- `/api/v1/jobs/score`
- `/api/v1/weekly/candidates`
- `/api/v1/weekly/suggestions`
- `/api/v1/weekly/suggestions/{id}/apply`
- `/api/v1/weekly/publish`
- `automation_runs`

当前问题是执行控制仍分散在 Next API route、进程内 cron、内存 Map 或同步请求中。运行中状态、并发互斥、重试、rate limit、任务排队和 worker 健康还没有统一边界。Redis 在 roadmap 中被定义为 job queue、lock、rate limit 和 job status 层，不是业务事实源。

只读代码定位补充：

- `src/app/api/v1/jobs/sync/route.ts` 目前在 request lifecycle 内同步遍历 data sources 并调用 `SyncOrchestrator.syncDataSource`，完成后由 `runAutomationRoute` 写入 `automation_runs`。
- `src/app/api/v1/jobs/score/route.ts` 目前在 request lifecycle 内同步调用 `InboxScoringService.runBatch`，完成后由 `runAutomationRoute` 写入 `automation_runs`。
- `src/lib/automation/run.ts` 的 `withAutomationRun` 已提供 `running/succeeded/partial_success/skipped/empty/failed`、request digest 和 idempotency conflict，但它不是 queue、lock 或 retry worker。
- `src/lib/scheduling/inbox-scoring-scheduler.ts` 使用 `croner` 和 `globalThis` 启动进程内 hourly scoring cron。
- `src/lib/services/karakeep-resync.ts` 仍使用内存 `Map` 保存 Karakeep resync job 状态；该状态在进程重启后丢失。
- `package.json` 当前没有 Redis queue client 依赖；plan 阶段必须显式选择依赖或实现方式。

---

## User Scenarios & Testing

### User Story 1 - 作为维护者，我能把长任务提交为可追踪 job (Priority: P1)

维护者需要启动同步、评分、建议生成或发布时，系统应快速返回 job/run evidence，而不是让浏览器或 automation caller 等待长任务完成。

**Acceptance Scenarios**:

1. **[US1-1] 提交 job**
   **Given** 我通过 Admin UI 或 `/api/v1/jobs/*` 触发长任务
   **When** 请求通过认证和幂等校验
   **Then** 系统必须创建或复用一个 job，并返回 job id、run id、status、target、下一步查询地址

2. **[US1-2] 幂等复用**
   **Given** 同一个 caller 使用同一个 `Idempotency-Key` 重试请求
   **When** payload digest 一致
   **Then** 系统必须返回同一个 job/run 状态，不得重复执行外部副作用

3. **[US1-3] payload 冲突**
   **Given** 同一个 `Idempotency-Key` 被不同 payload 复用
   **When** 系统检测到 digest 不一致
   **Then** 必须拒绝请求并返回可定位的冲突错误

### User Story 2 - 作为维护者，我能看到任务运行中、成功、失败和可重试状态 (Priority: P1)

任务状态应可在 Admin UI 和 API 中查询，避免用户只能翻日志或猜任务是否还在跑。

**Acceptance Scenarios**:

1. **[US2-1] 状态查询**
   **Given** job 已提交
   **When** 我查询 job 或打开任务中心
   **Then** 能看到 status、workflow、step、target、attempt、started/finished 时间、错误摘要和关联 run id

2. **[US2-2] 运行中状态**
   **Given** worker 正在处理任务
   **When** 页面刷新或 API 查询
   **Then** 状态必须保持 `queued` 或 `running`，不得误显示成功或空状态

3. **[US2-3] 失败恢复**
   **Given** job 失败且满足重试条件
   **When** 我点击重试或调用 retry API
   **Then** 系统必须创建新的 attempt，并保留原失败证据

### User Story 3 - 作为系统维护者，我能防止重复长任务和过量调用 (Priority: P1)

同步、评分和发布任务不能因为多端点击、n8n 重试或浏览器刷新而并发冲突。

**Acceptance Scenarios**:

1. **[US3-1] 锁**
   **Given** 同一 workflow/target 已有 running job
   **When** 第二个请求到达
   **Then** 系统必须按配置拒绝、合并或排队，并返回明确原因

2. **[US3-2] rate limit**
   **Given** caller 或 workflow 超过频率限制
   **When** 请求继续到达
   **Then** 系统必须返回 rate-limit 错误和可重试时间

3. **[US3-3] stale lock 恢复**
   **Given** worker 崩溃或超时导致锁残留
   **When** TTL 到期或恢复任务运行
   **Then** 系统必须能释放或标记 stale 状态，不永久阻塞后续任务

### User Story 4 - 作为后续 Hermes/n8n 调用方，我能继续使用稳定 automation contract (Priority: P1)

Redis job orchestration 不应改变外部 caller 的认证、scope、OpenAPI 和幂等语义。

**Acceptance Scenarios**:

1. **[US4-1] 契约兼容**
   **Given** 现有 automation caller 调用 `/api/v1/jobs/sync` 或 `/api/v1/jobs/score`
   **When** Redis job layer 启用
   **Then** 认证、scope、`Idempotency-Key` 和 response envelope 仍兼容现有 contract

2. **[US4-2] durable run evidence**
   **Given** Redis 保存 queue/status 的临时状态
   **When** job 完成或失败
   **Then** durable 结果必须写入或关联 `automation_runs`，Admin UI 仍以它作为长期运行事实源

3. **[US4-3] Redis 不可用降级**
   **Given** Redis 不可用
   **When** 任务入口被调用
   **Then** 系统必须返回明确服务不可用错误或走明确配置的同步 fallback，不得静默丢任务

### User Story 5 - 作为运维者，我能知道 worker 是否健康 (Priority: P2)

任务队列上线后，需要能判断 worker 是否在线、积压是否过高、失败是否集中。

**Acceptance Scenarios**:

1. **[US5-1] worker health**
   **Given** worker 进程运行
   **When** 我查看 health 或任务中心
   **Then** 能看到 worker heartbeat、last processed time、queue depth、failed count

2. **[US5-2] backlog 警示**
   **Given** queued jobs 超过阈值或 oldest queued age 过高
   **When** 任务中心加载
   **Then** UI 必须显示 backlog 警示和建议处理动作

---

## Requirements

### Functional Requirements

- **FR-001**: 系统必须提供 Redis-backed job queue，并登记 sync、score、weekly suggestion、apply、publish 的 job type/status 语义；第一批执行迁移必须覆盖 sync/score。
- **FR-002**: job submission 必须保留现有 automation auth/scope/Idempotency-Key 语义，不得绕过 `/api/v1` contract。
- **FR-003**: 系统必须提供 job status 查询能力，返回 queued/running/succeeded/partial_success/failed/cancelled/skipped 等状态。
- **FR-004**: 系统必须提供 workflow/target 级 lock，防止同一资源的冲突执行。
- **FR-005**: 系统必须提供 caller/workflow 级 rate limit，并返回可重试时间。
- **FR-006**: job 完成、失败或跳过后，必须写入或关联 `automation_runs`，并保留 error code/message、attempt、external ref 和 result summary。
- **FR-007**: 系统必须支持失败 job 的显式 retry，retry 不得抹掉原 attempt 的失败证据。
- **FR-008**: Admin UI 必须提供任务中心或现有 dashboard/workbench 可见入口，展示 queue depth、running、failed、retryable 和 worker health。
- **FR-009**: Redis 不可用时，任务入口必须明确失败或按配置走同步 fallback；不得返回成功后丢任务。
- **FR-010**: 本 feature 不得让 Redis、n8n、Hermes 或 Postgres 成为业务事实源；业务写入仍通过 Admin service/API 和 MySQL。
- **FR-011**: 如果需要新增 job/status 持久表或字段，必须通过 Prisma Migrate，并在 `data-model.md` 中记录实体关系。
- **FR-012**: 必须保留现有 `automation_runs` 的历史查询语义，不能让 dashboard/workbench 只依赖 Redis ephemeral 状态。

### Non-Functional Requirements

- **NFR-001**: job submission API 应快速返回，避免长任务阻塞 request lifecycle。
- **NFR-002**: worker 必须可安全重启；重复领取、重复执行和 stale lock 必须有防护。
- **NFR-003**: job status 查询必须限制分页、filter 和 retention，避免任务中心拖慢 Admin。
- **NFR-004**: Redis key 命名、TTL、retry policy 和 dead-letter 策略必须可配置且可测试。
- **NFR-005**: 关键路径必须有单测或集成测试覆盖 queue、lock、idempotency、retry、Redis unavailable 和 run evidence。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|---|---|---|---|---|
| 一致性 | MySQL/automation_runs 保持 durable fact | 避免 Redis 临时状态变事实源 | 完成后 run evidence 可查 | 是 |
| 可观测性 | job 状态、worker 健康、失败原因可见 | 长任务上线后必须可排障 | UI/API evidence | 是 |
| 可靠性 | worker crash、重复请求、stale lock 可恢复 | 避免任务卡死或重复副作用 | retry/lock tests | 是 |
| 安全性 | 继续使用 automation token/scope | 不扩大调用面 | auth/scope tests | 是 |
| 可演进性 | 后续 n8n/Hermes 消费同一 job/status 语义 | 避免后续再建一套状态模型 | Producer-Consumer Matrix | 是 |

### Key Entities

- **Job**: Redis queue 中的执行单元，包含 workflow、step、target、payload digest、caller、idempotency key、attempt 和 status。
- **Job Attempt**: 一次实际执行尝试，包含 worker id、started/finished、error、result summary。
- **Job Lock**: workflow/target 级互斥控制，带 TTL 和 stale 恢复语义。
- **Rate Limit Bucket**: caller/workflow 级调用频率控制。
- **Worker Heartbeat**: worker 健康、last seen、currently processing、queue depth。
- **Automation Run**: durable run evidence，继续作为 Admin UI 的长期事实源。

---

## Clarification Decisions

### CD-001 Redis 是执行控制层，不是业务事实源

**Decision**: Redis 只保存 queue、lock、rate-limit、ephemeral status 和 worker heartbeat。业务数据仍写入 MySQL；长期运行证据仍以 `automation_runs` 为准。

**Reason**: roadmap 已明确 MySQL 为业务事实源；`admin-shell-and-weekly-workbench` 已消费 `automation_runs` 作为 UI 状态来源。

### CD-002 不重新定义 automation contract

**Decision**: 本 feature 不新增一套外部 automation API。现有 `/api/v1` endpoint 是 caller boundary；Redis job layer 在其后接管执行控制。

**Reason**: `agent-and-automation-contracts` 已完成并稳定 token/scope/OpenAPI/idempotency。

### CD-003 任务中心可以先复用现有 dashboard/workbench 入口

**Decision**: UI 目标是让 job 状态可见；实现可以先在现有驾驶舱/工作台 runs 区域增强，也可以新增任务中心页面，最终由 plan 决定。

**Reason**: 避免提前承诺复杂新页面；重点是运行中、失败、重试和 worker health 可操作。

### CD-004 第一批 job 化入口限定为 sync/score

**Decision**: 第一批 Redis job 化入口应优先覆盖 `POST /api/v1/jobs/sync` 与 `POST /api/v1/jobs/score`。Weekly suggestions、apply 和 publish 需要在 data model 中登记 job type/status 语义，但不要求第一批全部迁入 worker。

**Reason**: sync/score 已以 `/api/v1/jobs/*` 暴露，且当前仍同步执行长任务；它们最适合作为 Redis queue/lock/status 的最小可验收闭环。Publish 有 Quail 外部副作用和刚完成的 UI publish wrapper，过早迁移会放大回归面。

### CD-005 默认不做静默同步 fallback

**Decision**: Redis 不可用时，Redis-backed job endpoint 默认返回明确的 service unavailable / degraded 错误，并写入或关联失败证据；只有 plan 明确标注且测试覆盖的低风险入口，才允许配置化同步 fallback。

**Reason**: 本 feature 的核心目标是执行控制和可观测性。静默 fallback 会让 caller 以为任务已入队，实际却绕过 queue/lock/status，导致重复副作用或状态丢失。

### CD-006 MVP 不新增持久 job 表，除非 plan 证明 Redis retention 不足

**Decision**: MVP 的 durable run evidence 继续使用 `automation_runs`。Redis 保存 queue、lock、rate-limit、ephemeral status 和 worker heartbeat；不默认新增 `jobs` / `job_attempts` MySQL 表。

**Reason**: `automation_runs` 已能承载长期 run/idempotency/result evidence。新增持久 job 表会带来 schema、迁移和事实源边界复杂度，只有当 retry attempt、dead-letter 或任务中心历史查询无法由 Redis + `automation_runs` 支撑时，才在 plan/data-model 中升级。

### CD-007 Worker 不绑死在 Next request lifecycle

**Decision**: Worker 必须是可独立启动、可重启、可健康检查的执行单元；plan 可以选择独立 Node worker 进程、NAS Docker worker 或受控后台 runner，但不能只依赖浏览器请求或普通 API route 执行长任务。

**Reason**: 现有问题正是长任务卡在 request lifecycle、进程内 cron 和内存状态中。Redis job layer 需要把提交、领取、执行和状态查询拆开，才能提供 worker heartbeat、stale lock recovery 和 backlog evidence。

---

## Scope Boundaries

### In Scope

- Redis-backed queue、lock、rate-limit、job status。
- Worker process 或 worker route 的执行控制边界。
- `/api/v1/jobs/sync`、`/api/v1/jobs/score` 的 job 化。
- weekly suggest/apply/publish 的 job type/status 映射；是否迁入第一批 worker 由 plan 控制，默认不强制。
- Admin UI 的 job/runs/worker health 可见状态。
- Redis unavailable、retry、stale lock、idempotency conflict 的测试。

### Out of Scope

- 不让 Hermes 直接写业务 DB；Hermes 智能建议属于 `hermes-weekly-intelligence`。
- 不迁移 MySQL 业务事实到 Redis 或 Postgres。
- 不重写 `/api/v1` token/scope/OpenAPI 基础契约。
- 不实现完整分布式工作流平台、复杂 DAG 或跨服务事务。
- 不删除 legacy sync/score 路径，除非 plan 明确给出兼容迁移策略。
- 不要求第一批迁移 Quail publish、weekly suggestions 或 suggestion apply 的执行路径。

---

## Clarify Findings

本轮 clarify 结论已经回写为 CD-004 至 CD-007。后续 `plan` 仍需展开以下方案细节，但它们不再阻塞进入 plan：

- 选择 Redis queue 依赖和 key/TTL 命名策略。
- 定义 sync/score 的 job payload、lock target、rate-limit bucket 和 retry policy。
- 明确 Redis job status 与 `automation_runs` 状态的映射和刷新时机。
- 决定 worker 在本地、NAS Docker 和生产容器中的启动命令与 health endpoint。
- 若 plan 发现 Redis + `automation_runs` 无法支撑任务中心历史或 retry attempt 查询，再新增 `data-model.md` 和 Prisma Migrate 范围。

---

## Success Criteria

- `specs/redis-job-orchestration/plan.md` 明确 Redis key/data model、queue/worker topology、retry policy、run evidence mapping 和 UI surface。
- `/api/v1/jobs/sync` 或 `/api/v1/jobs/score` 至少一个入口通过 Redis job path 提交、执行、完成并可查询状态；推荐第一批同时覆盖两者。
- 重复 idempotency request 不重复副作用。
- running/failed/retryable 状态在 Admin UI 或 API 中可见。
- Redis unavailable 有明确失败或配置化 fallback。
- 不新增未记录的业务事实源。

---

## Stage Readiness

- 推荐下一步：`plan`
- 阻塞项：无。第一批 job 化入口、Redis unavailable 默认行为、持久 job 表策略和 worker 边界已在 Clarification Decisions 中固定；plan 阶段需要展开 queue 依赖、Redis key/TTL、retry/dead-letter、run evidence mapping、worker topology 和 UI/API 验证路径。

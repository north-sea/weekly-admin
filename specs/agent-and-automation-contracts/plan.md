# Implementation Plan: Agent And Automation Contracts

**Workspace**: `agent-and-automation-contracts` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/agent-and-automation-contracts/spec.md`

---

## Summary

在现有 Admin 单体内新增 automation contract 层：独立 service token/scope 鉴权、`/api/v1` agent-friendly API、统一响应 envelope、automation run/idempotency 持久化、OpenAPI 契约和兼容旧路径的共享 service。方案不引入 Redis/job queue，不实现 n8n workflow 或 Hermes skill，只把 Admin 侧契约稳定下来。

---

## Architecture Overview

当前项目是 Next.js App Router + Prisma/MySQL 单体。推荐方案是在单体内增加一层 automation boundary，而不是把自动化逻辑拆成外部服务。

```text
n8n / cron / Hermes / MCP
        |
        | Authorization: Bearer <automation token>
        v
src/app/api/v1/*
        |
        v
Automation Auth + Scope Guard
        |
        v
Automation Contract Wrapper
  - request validation
  - idempotency lookup
  - run lifecycle
  - response envelope
        |
        v
Existing domain services
  - SyncOrchestrator
  - InboxScoringService
  - weekly-automation
  - weekly-organizer
  - quailService
        |
        v
MySQL business facts + automation metadata
  - existing business tables
  - automation_tokens
  - automation_runs
  - operation_logs as audit mirror
```

旧 `/api/weekly/*`、`/api/sources/sync-all` 和现有 UI 路径继续可用。新 `/api/v1` contract 面向 agent/automation，并通过共享 service 调用现有业务能力，避免双实现漂移。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| 分层单体 | https://github.com/study8677/awesome-architecture/blob/main/tutorial/04-%E5%8D%81%E5%A4%A7%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84%E6%A8%A1%E5%BC%8F.md | 现有项目已经是 Next.js 单体；新增边界层可保持低成本和事务可控 | 不拆微服务，不引入独立 API gateway | MVP/成长期 |
| 管道/工作流边界 | https://github.com/study8677/awesome-architecture/tree/main/templates | 自动化是 sync -> score -> suggest -> review -> publish 的多阶段流程，适合用 producer/consumer matrix 固化产物 | 本 feature 不实现完整异步编排引擎 | 成长期 |
| 事件驱动/队列 | https://github.com/study8677/awesome-architecture/blob/main/tutorial/04-%E5%8D%81%E5%A4%A7%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84%E6%A8%A1%E5%BC%8F.md | 后续 `redis-job-orchestration` 可接管长任务、锁、状态和重试 | 当前阶段不引入 Redis queue，避免过早成熟期架构 | 后续演进 |

**候选方案讨论说明**: 本阶段跳过用户交互式候选方案选择。原因是上游 roadmap 与 clarify 已明确唯一合理方向：automation token 与 human JWT 分离、`/api/v1` 契约、专用 run/idempotency 持久化、旧路径兼容。其余方案作为 ADR 中的放弃项记录。

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `/api/v1/jobs/sync` / `SyncOrchestrator` | Sync run result: fetched/upserted/skipped/errors | `/api/v1/jobs/score`, admin operator, future job dashboard | `automation_runs.result_summary` has counts; response includes `runId`, `status`, counts |
| Inbox scoring service | AI score, summary, promotion result | `/api/v1/weekly/candidates`, feedback digest, weekly suggestions | Candidate API returns score fields; feedback digest can aggregate actions against scored content |
| `/api/v1/weekly/candidates` | Candidate list for a date range/week | `/api/v1/weekly/suggestions` and external agents | Suggestion request can reference candidate ids; OpenAPI documents candidate shape |
| `weekly-organizer` | Weekly suggestion artifact: intro/items/section/featured/reason | `/api/v1/weekly/suggestions/:id/apply` or human review workflow | Suggestion is schema validated; apply endpoint writes selected items or marks rejected |
| Weekly apply/auto-link service | `weekly_content_items` and updated issue counters | Admin weekly editor and publish flow | DB unique key prevents duplicate links; weekly API/UI shows selected content |
| Publish contract | Publish request payload and Quail result | Quail, admin publish status, external caller | Response contains Quail ids; weekly issue stores Quail fields and publish error if failed |
| Automation auth guard | Automation caller identity and scope | All `/api/v1` write/read endpoints | `automation_runs.token_id` and scope check result recorded |
| Automation run wrapper | Run status and idempotency result | Repeated callers, ops UI, operation log mirror | Same idempotency key returns stored response summary instead of repeating side effects |

**孤儿 artifact 处理**: AI suggestion preview 是 intentionally staged artifact，必须由 explicit apply/confirm contract 消费后才写入 `weekly_content_items`。若首版不实现 apply endpoint，plan/tasks 必须把 suggestion 标为 preview-only，并禁止把它计入 workflow closure。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 安全 | Automation token 最小 scope，secret 不落日志 | token hash 存储、scope guard、脱敏响应、service caller 与 human user 分离 | auth/scope 单测；日志脱敏测试 |
| 幂等性 | 重复写入请求不重复创建、关联或发布 | `automation_runs` 按 token/workflow/idempotency key 唯一约束；run wrapper 先查后执行业务 | route/service 测试重复请求 |
| 一致性 | MySQL business fact 与 run 状态可恢复一致 | 关键写入在 transaction 内创建/更新 run；外部副作用单独标记 | DB state + response snapshot 测试 |
| 可观测性 | 每次 automation call 有 runId、caller、status、error 分类 | run 表、response meta、operation log mirror | operation log/run 查询测试 |
| 向后兼容 | 旧 UI/API 不被破坏 | 旧路径保持 human auth；新 `/api/v1` 使用共享 service | existing route tests + new v1 tests |
| 可演进性 | 后续 queue/job 可接管而不改 caller contract | response 使用 `runId/status/result`，不绑定同步实现 | plan review + future migration notes |

---

## Capacity / Scale Notes

- **规模假设**: 单人/小团队后台；automation 请求低频，cron 级别为小时/天/周；候选内容和周刊 item 数量在百级到低千级。
- **读写特征**: 读写混合但写入低频；最高风险来自重试、超时和并发重复触发，不来自吞吐。
- **失败代价**: 重复发布和 secret 泄漏最高；重复创建/关联会污染业务事实；空结果和依赖不可用应返回可机器判断状态。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001: 独立 automation token | Roadmap 要求 human JWT 与 automation token 分离 | A 独立 token/scope；B 复用 JWT；C 只用 env secret | 选 A，`CRON_API_TOKEN` 仅作兼容/bootstrap | 需要新增表、管理和测试 | `specs/admin-modernization-roadmap/plan.md`; `docs/cron-job-setup.md` |
| ADR-002: 专用 run/idempotency 存储 | `operation_logs` 不适合 run lifecycle 和 idempotency lookup | A 新 run 表；B 只写 operation_logs；C 文件日志 | 选 A，operation_logs 做审计 mirror | 新增 schema 和迁移 | `prisma/schema.prisma`; `src/lib/services/operation-log.ts` |
| ADR-003: 保留旧路径，新增 `/api/v1` | 旧路径已被 UI/cron 使用，roadmap 要 agent-friendly endpoint | A 直接替换旧路径；B 新增 v1 wrapper；C 只文档化旧路径 | 选 B | 双入口维护成本，需要共享 service 测试 | `docs/cron-job-setup.md`; `specs/admin-modernization-roadmap/spec.md` |
| ADR-004: AI suggestions preview-first | `weekly-organizer` 当前只返回结构化结果，不写事实表 | A AI 直接写库；B preview + apply；C 不暴露 AI suggestion | 选 B | 需要 suggestion artifact/apply contract | `src/lib/ai/server/weekly-organizer.ts` |
| ADR-005: 不引入 Redis job | Redis 编排是后续 feature，当前只稳定 API contract | A 同步 contract；B 立即引入 Redis queue | 选 A，并保持 run/status 可演进 | 长任务仍以同步或 fire-and-forget 兼容 | `specs/admin-modernization-roadmap/plan.md` |

---

## Module Design

### Module: Automation Auth

**职责**: 验证 automation bearer token，解析 caller、scope 和 token 状态。

**改动概述**:

- 新增 `automation_tokens` Prisma model。
- 新增 `src/lib/automation/auth.ts` 或同等模块。
- 支持 token hash 校验，不保存明文 token。
- 返回 `AutomationCaller`：`tokenId`、`name`、`type`、`scopes`。

**关键行为**:

```text
authenticateAutomationRequest(request, requiredScope)
  token = extract Bearer
  reject missing/malformed token -> 401
  hash token and lookup active automation_tokens
  reject expired/revoked -> 401
  reject missing scope -> 403
  update last_used_at best effort
  return caller
```

**注意事项**:

- Human JWT auth remains in `src/lib/auth.ts` and existing routes.
- Secret must not appear in logs, response, operation details, or test snapshots.

### Module: Automation Run and Idempotency

**职责**: 为每次 automation call 分配 runId，记录状态，并防止重复写入副作用。

**改动概述**:

- 新增 `automation_runs` Prisma model。
- 新增 run wrapper：start/reuse/finish/fail。
- 写入类 API 要求或接受 `Idempotency-Key` header；无 key 的高风险写入应返回 400 或生成 non-idempotent run，具体由 endpoint contract 决定。

**关键行为**:

```text
withAutomationRun({ caller, workflow, step, target, idempotencyKey, requestDigest }, handler)
  if idempotencyKey exists and completed run found:
    return stored response summary with meta.idempotentReplay = true
  create run(status='running')
  execute handler
  update run(status='succeeded'|'partial_success'|'skipped'|'empty'|'failed')
  mirror operation_logs when useful
```

**注意事项**:

- Run status is not a business fact; MySQL business tables remain source of truth.
- External side effects must mark whether they were attempted and whether remote ids were returned.

### Module: API Contract Envelope

**职责**: 统一 `/api/v1` response shape、status、error code 和 metadata。

**改动概述**:

- Reuse `createNextSuccessResponse` / `createNextErrorResponse`.
- Add automation-specific meta: `runId`, `caller`, `status`, `idempotentReplay`.
- Keep existing `success/data/error/meta` envelope.

**关键行为**:

```json
{
  "success": true,
  "data": { "status": "created", "counts": {} },
  "meta": {
    "timestamp": "...",
    "runId": "auto_...",
    "status": "succeeded"
  }
}
```

### Module: `/api/v1` Agent-Friendly Endpoints

**职责**: 提供稳定 automation contract，消费现有 service。

**首版 endpoint 建议**:

| Endpoint | Scope | 行为 |
|---|---|---|
| `GET /api/v1/openapi.json` | public or `ops:read` | 返回 contract schema |
| `GET /api/v1/weekly/candidates` | `weekly:read` | 按日期/周返回候选内容 |
| `POST /api/v1/weekly/suggestions` | `weekly:suggest` | 调用 `organizeWeekly` 生成 preview artifact |
| `POST /api/v1/weekly/suggestions/:id/apply` | `weekly:suggest` or `weekly:publish` | 可选首版；将 suggestion 写入 weekly items |
| `POST /api/v1/jobs/sync` | `sync:run` | 包装 `SyncOrchestrator` 或 `sync-all` |
| `POST /api/v1/jobs/score` | `score:run` | 包装 inbox scoring batch/run |
| `GET /api/v1/ai/feedback/digest` | `ops:read` | 从 baseline 扩展为真实 digest |
| `POST /api/v1/weekly/publish` | `weekly:publish` | 包装 Quail publish，要求 idempotency |

**注意事项**:

- Existing `/api/v1/ai/score` can remain human/JWT compatible or be split into automation wrapper. Plan tasks must choose exact migration shape.
- Existing `/api/weekly/*` routes should not be silently changed to automation token only.

### Module: OpenAPI Contract

**职责**: 让 n8n/Hermes/MCP 能机器读取 API shape。

**改动概述**:

- Add `/api/v1/openapi.json` route.
- Source of truth can be static generated JSON or TS object co-located with route schemas.
- Must document auth scheme, scopes, idempotency header, response envelope, status enum, error codes.

### Module: Legacy Cron Compatibility

**职责**: 收口 `docs/cron-job-setup.md` 和代码认证现实。

**改动概述**:

- Update docs to prefer `/api/v1/jobs/sync`, `/api/v1/weekly/...`.
- Document `CRON_API_TOKEN` as automation token value, not human JWT.
- Keep old examples either as legacy wrapper or mark migration.

---

## Data Model

需要 [data-model.md](data-model.md)。核心新增实体：

- `automation_tokens`: hashed service token, caller type, scopes, status, expires/revoked/last used metadata.
- `automation_runs`: run lifecycle, idempotency key, request digest, response summary, error classification, token relation.

All schema changes must be implemented via Prisma Migrate.

---

## Project Structure

```text
prisma/schema.prisma
prisma/migrations/<timestamp>_agent_and_automation_contracts/
src/lib/automation/auth.ts
src/lib/automation/run.ts
src/lib/automation/contracts.ts
src/app/api/v1/openapi.json/route.ts
src/app/api/v1/jobs/sync/route.ts
src/app/api/v1/jobs/score/route.ts
src/app/api/v1/weekly/candidates/route.ts
src/app/api/v1/weekly/suggestions/route.ts
src/app/api/v1/weekly/publish/route.ts
src/app/api/v1/ai/feedback/digest/route.ts
docs/cron-job-setup.md
specs/agent-and-automation-contracts/data-model.md
```

Exact route list can be narrowed during `tasks` if implementation scope needs slicing, but token/auth/run foundation should not be split away from first contract endpoints.

---

## Risks and Tradeoffs

- New token tables increase operational responsibility; mitigate with hash-only storage, seed/bootstrap path, disabled/revoked states, and tests.
- Dual old/new routes may drift; mitigate by sharing domain services and testing both wrappers where legacy remains.
- Idempotency for external Quail calls cannot guarantee remote rollback; mitigate by checking local Quail ids before publish and requiring `forceRepublish`.
- Full OpenAPI generation can expand scope; start with static route for v1 contract if generation library would introduce unnecessary tooling.
- Run table can become an ad hoc job system; keep it as request/run audit only until `redis-job-orchestration`.

---

## Evolution Path

- **MVP**: Synchronous `/api/v1` contract with token/scope, run/idempotency storage, OpenAPI JSON, and key endpoints.
- **成长期**: Add ops UI for automation runs, richer feedback digest, token management UI, and broader route coverage.
- **成熟期**: Redis-backed job orchestration handles locks, retries, progress and long-running tasks while preserving the same external response contract.

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。明确不引入 Redis queue、microservice 或 API gateway。
- 是否引用了外部模式但没有适配检查：否。Architecture Reference 已说明适配与不适配。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。新增 token/run 状态在 [data-model.md](data-model.md) 记录；不新增缓存或队列。

---

## Verification Strategy

- Unit tests for token hash lookup, expired/revoked token rejection, scope guard, and secret redaction.
- Unit tests for idempotency replay: first write executes handler, repeated key returns stored summary.
- Route tests for `/api/v1` endpoints: auth failure, scope failure, validation failure, success, skipped/empty, partial failure where applicable.
- Service tests for weekly create/link idempotency and existing `weekly_content_items` unique constraint handling.
- Contract test or snapshot for `/api/v1/openapi.json` including security scheme, scopes, idempotency header and response envelope.
- Migration verification: Prisma migrate generated, `pnpm prisma generate`, `pnpm type-check`, focused Vitest suite.
- Runtime smoke: create automation token, call one read endpoint and one idempotent write endpoint twice, verify same business fact and run records.

---

## Stage Readiness

- 是否需要 `data-model.md`：需要。新增 token、run/idempotency 持久化模型。
- 下一步建议：`tasks`
- 阻塞项：无。方案可拆解为 migration/auth/run/contracts/docs/tests。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 主实现计划 |
| data-model.md | 需要 | automation token + run/idempotency 模型 |
| tasks.md | 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | 后续阶段生成 | 用于最终验收结论 |

---

## Sources

| 决策 | 来源 URL / 文件 | 备注 |
|------|----------------|------|
| 分层单体、管道边界参考 | https://github.com/study8677/awesome-architecture/blob/main/tutorial/04-%E5%8D%81%E5%A4%A7%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84%E6%A8%A1%E5%BC%8F.md | 架构模式参考，不照搬 |
| Automation scope and endpoint roadmap | `specs/admin-modernization-roadmap/spec.md` | F2 范围 |
| Human JWT vs automation token | `specs/admin-modernization-roadmap/plan.md` | Phase 2 决策 |
| Cron token expectation | `docs/cron-job-setup.md` | 需迁移/收口 |
| Existing response envelope | `src/lib/utils/serialization.ts` | 复用 success/data/error/meta |
| Existing audit limitation | `prisma/schema.prisma`; `src/lib/services/operation-log.ts` | operation_logs 不足以承载 run/idempotency |

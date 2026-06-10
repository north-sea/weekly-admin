# Implementation Plan: Admin Modernization Roadmap

**Workspace**: `admin-modernization-roadmap` | **Date**: 2026-06-02 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/admin-modernization-roadmap/spec.md`

---

## Summary

本计划把 Admin 现代化改造拆成一组可独立交付的 feature，并规定推荐执行顺序、跨系统边界、依赖关系和验证路径。当前 Next.js 16 基线和 database/search 边界已经完成；后续主线从迁移治理开始，再收口评分闭环、自动化契约和产品表层。生产 secrets 相关事项作为单独 deferred follow-up，不进入本次主线排序。

本 plan 是 umbrella plan，不直接替代各执行 feature 的 `plan.md`。进入开发前，每个 feature 仍需拥有自己的 `spec.md` / `plan.md` / `tasks.md`。

---

## Architecture Overview

目标架构保持 Admin 作为业务事实源和审核台，NAS 上的自动化组件作为编排、智能和异步处理能力接入。

```text
Karakeep / RSS / 手动输入
        |
        v
Admin API + MySQL/Prisma  <-----------------------+
事实源：inbox_items / contents / weekly_issues       |
        |                                           |
        | emits operation logs / candidates          |
        v                                           |
Redis jobs / locks / rate limits                    |
        |                                           |
        +--> n8n triggers sync/score/publish -------+
        |
        +--> Hermes skills read candidates/feedback
                |
                v
        Postgres + pgvector + hermes-db MCP
        智能读模型：偏好、向量、建议、agent run logs
                |
                v
Admin UI 展示建议 -> 人确认 -> Admin API 写回 MySQL
```

关键边界：

- **Admin/MySQL 是事实源**：生产表写入必须通过 Admin API 或 Admin 服务层。
- **n8n 是调度器**：定时、重试、通知和 webhook 编排，不直接写核心业务表。
- **Hermes 是判断层**：偏好学习、选题建议、排序建议和复盘，不直接发布或修改周刊。
- **Redis 是执行控制层**：job、锁、rate limit、任务状态，不存业务事实。
- **Postgres/pgvector/hermes-db 是智能读模型**：向量召回和记忆，不替代 MySQL。
- **Meilisearch 是 optional keyword backend**：不阻塞启动或整体健康。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| Next.js 16 App Router upgrade | https://nextjs.org/docs/app/guides/upgrading/version-16 | 指导 `middleware` -> `proxy`、Turbopack 默认、`next lint` 移除、Request APIs 异步化、Node 20.9+ | 不能自动解决业务 UI、MySQL/Prisma、NAS 编排问题 | 成长期 |
| `nextjs-tpl` self-hosted admin shell | `/Users/yqg/personal/webs/nextjs-tpl` | 紧凑侧栏、surface tokens、API token、OpenAPI、agent-friendly 入口 | 不照搬 monorepo、Drizzle、SQLite/Postgres 双模式 | 成长期 |
| Job queue / worker pattern | UNVERIFIED | 将同步、评分、发布等长任务从 Next API Route 中剥离 | 本轮不引入复杂分布式平台；先以 Redis 轻量落地 | 成长期 |
| Read model / CQRS-lite | UNVERIFIED | MySQL 保持事实源，PG/pgvector 做智能读模型 | 不做完整 CQRS，不引入双写业务事实 | 成长期 |

---

## Post-F0 Reassessment

2026-06-02 完成 `next16-upgrade-baseline` 后，路线需要调整：

| Feature | 结论 | 调整原因 |
|---------|------|----------|
| F0 `next16-upgrade-baseline` | 已完成 | `pnpm lint/type-check/test/build` 通过；proxy smoke 通过；acceptance 已记录。 |
| F1 `admin-shell-and-weekly-workbench` | 需要迭代后再开发 | UI 工作台应消费稳定的 scoring/promoted contents/job/search 状态；不要在 health/search 和 scoring 状态未收口时大改 UI。 |
| F2 `agent-and-automation-contracts` | 需要保留，但顺序后移到 F8/F6 之后 | 工作树已有 `/api/v1` 和 feedback digest 痕迹；应先确认 scoring/operation log 事实，再定义 OpenAPI 和 token scope。 |
| F3 `redis-job-orchestration` | 需要迭代，后移 | 当前 `inbox-ai-scoring` 仍以 Node cron 为明确范围；Redis job 应作为后续替换/任务中心 feature，不抢先改。 |
| F4 `hermes-weekly-intelligence` | 需要迭代，后移 | Hermes 依赖 F2 的 API 契约、F8 的反馈数据和 F6 的读模型边界。 |
| F5 `image-feature-retirement` | 需要提前设计，但实现分阶段 | Next 16 build 仍保留 `react-image-crop` / `sharp`，图片退役可减少依赖和 UI 噪音；字段 drop 仍必须后置。 |
| F6 `database-and-search-strategy` | 需要提前 | `/api/health` 因 Meilisearch 不可用返回 503，说明 optional search 策略不能继续只停留在 roadmap 里。 |
| F7 `migration-tooling-baseline` | 需要提前 | 本轮和 inbox scoring 都触碰 Prisma schema / SQL；后续继续改 DB 前应建立 migrate baseline。 |
| F8 `inbox-ai-scoring-continuation` | 需要优先收口 | 当前工作树已有 scoring schema/service/tests/API 改动和 acceptance，UI 工作台应基于它的最终输出。 |

## Recommended Execution Order

### Completed Foundations

1. `next16-upgrade-baseline`
   - 已完成。保留为所有后续 UI 和路由改造的前置稳定层。

2. `database-and-search-strategy`
   - 已完成。Meilisearch 已成为 optional keyword backend；NAS runtime smoke 证明 `/api/health` degraded HTTP 200、authenticated `/api/search` fallback HTTP 200。
   - 保留后续优化：Meilisearch timeout/circuit breaker、FULLTEXT fallback 优化、NAS Meili 网络复用。

3. `migration-tooling-baseline`
   - 已完成。Prisma baseline migration、seed、legacy migration deprecation、deploy 前 `prisma migrate deploy` 和真实 NAS deploy 验证均已通过。
   - 后续任何 schema change 都必须通过 `prisma/migrations/`，不得新增 `database/*.sql` 作为 schema 变更入口。

4. `inbox-ai-scoring-continuation`
   - 已完成。settings 默认值、processing sweep、doctor/backfill、DB apply、UI evidence 和 acceptance 均已收口。
   - 代表性 `score-batch` 样本仍有上游 `405 Not Allowed`，归为后续内容抓取质量跟进，不阻塞主线。

5. `agent-and-automation-contracts`
   - 已完成。automation token、scope、OpenAPI、agent-friendly API、idempotency、`automation_runs`、apply/publish contract 和 live smoke 均通过。
   - secret rotation、token 管理 UI 和审计面板仍作为 deferred follow-up，不阻塞主线。

### Phase 1: Product Surface

6. `image-feature-retirement`
   - 下一步。周刊已去图片，先退役图片入口/上传/裁剪/AI 图片路径，避免新 workbench 继续承载 legacy image surface。
   - 字段 drop 仍必须在 migration baseline 之后执行。

7. `admin-shell-and-weekly-workbench`
   - 以 `nextjs-tpl` 为主重塑后台壳层和周刊生产驾驶舱。
   - 消费稳定的 scoring/search/contracts 和 `/api/v1` weekly suggestion/apply/publish 契约，且在图片入口退役后再做主 UI 设计。

### Phase 2: Execution Control and Intelligence

8. `redis-job-orchestration`
   - 将长任务逐步迁入 Redis job/lock/status。
   - 消费既有 `/api/v1` contract 和 `automation_runs`，形成任务中心和可观测性。

9. `hermes-weekly-intelligence`
   - 在 API 契约和读模型稳定后接入 Hermes skill。
   - 先做建议和复盘，不直接写 MySQL，不做自动发布。

## Post-F6 Reassessment

2026-06-03 完成 `database-and-search-strategy` 后，路线再次调整：

| Feature | 结论 | 调整原因 |
|---------|------|----------|
| F0 `next16-upgrade-baseline` | 已完成 | Next.js 16、proxy、lint/type-check/build/smoke 已完成。 |
| F6 `database-and-search-strategy` | 已完成 | Meili optional、health degraded、MySQL fallback、Admin index isolation 和 NAS smoke 均通过。 |
| Deferred `security-and-runtime-hardening` | 暂不进入主线排序 | 用户要求先不管 secret 相关 feature。保留为单独风险 follow-up；Meili timeout/circuit breaker 可在 migration 或 search follow-up 中择机处理。 |
| F7 `migration-tooling-baseline` | 需要迭代并保持下一优先级 | fallback 生产失败证明 schema drift / Prisma relation assumptions 是现实风险；后续字段 drop、API token、Redis job 前必须先建立 migrate baseline 和 drift 检查。 |
| F8 `inbox-ai-scoring-continuation` | 需要迭代后 closeout | 大多数任务已完成，但 acceptance 仍有 R3 UI N/A、T105 DB 回填查询、逐条耗时证据不足；应在 migration baseline 后做 runtime 验证和收尾。 |
| F2 `agent-and-automation-contracts` | 需要迭代 | scope 应明确 automation token 与 human JWT 分离、OpenAPI、idempotency、audit；不能复用临时 JWT smoke 思路作为正式自动化鉴权。 |
| F5 `image-feature-retirement` | 需要提前到 UI 前 | 图片功能已是 legacy；先退役入口和写入路径，再设计周刊工作台更干净。 |
| F1 `admin-shell-and-weekly-workbench` | 需要迭代，继续后移 | UI 应消费稳定 scoring/search/contracts，并在图片入口清理后设计；避免把 backend/runtime 补丁夹带到 UI feature。 |
| F3 `redis-job-orchestration` | 需要迭代，后移 | 现有 inbox scoring 仍是进程内 cron；Redis job 应在 API 契约稳定后接管长任务状态和任务中心。 |
| F4 `hermes-weekly-intelligence` | 需要迭代，仍最后 | Hermes 依赖 scoring 输出、feedback digest、API contracts、PG/pgvector read-model 边界和人工确认 UI。 |

新推荐顺序：

1. `migration-tooling-baseline`
2. `inbox-ai-scoring-continuation`
3. `agent-and-automation-contracts`
4. `image-feature-retirement`
5. `admin-shell-and-weekly-workbench`
6. `redis-job-orchestration`
7. `hermes-weekly-intelligence`

Deferred follow-up, not in the mainline order:

- `security-and-runtime-hardening`

## Post-F7 Reassessment

2026-06-04 复核 `migration-tooling-baseline` 完成后的剩余未开发 feature：

| Feature | 是否需要迭代 | 调整结论 |
|---------|--------------|----------|
| `migration-tooling-baseline` | 不需要继续迭代主线 | 已 PASS。`acceptance.md` 记录 GitHub Actions run `26896308413` / deploy job `79336833413`：迁移在停止旧容器前执行，Prisma 输出 `No pending migrations to apply.`，部署后 `/api/health` 通过。 |
| `inbox-ai-scoring-continuation` | 需要小迭代后 closeout | 迁移前置已解除。剩余工作不应再走旧 SQL；需要补 runtime/UI/DB evidence，把 `acceptance.md` 的 R3 UI N/A、T105 查询、逐条耗时/P95 残缺收掉。 |
| `agent-and-automation-contracts` | 需要迭代 spec | 现在可把 token/API 表、operation log、idempotency 等持久化改动纳入 Prisma Migrate；spec 必须显式要求 migration + seed/fixture + deploy evidence。仍不处理 secret rotation。 |
| `image-feature-retirement` | 需要迭代 spec | 字段 drop 已被 migration baseline 解锁，但仍必须分阶段：先清 UI/API/读取点，再用 Prisma Migrate drop legacy image fields；drop 前保留备份/checkpoint 和 Astro 展示端读取清单。 |
| `admin-shell-and-weekly-workbench` | 需要迭代 spec | 顺序不提前。它应消费已 closeout 的 scoring 输出、search fallback、automation contracts，并在图片入口退役后设计，避免新 UI 继续承载 legacy image surface。 |
| `redis-job-orchestration` | 需要迭代 spec | 后置不变。接管 cron/job 状态时如新增 job 表或状态表，必须用 Prisma Migrate；应消费 automation contracts，而不是绕过 Admin API。 |
| `hermes-weekly-intelligence` | 需要迭代 spec | 仍最后。依赖 scoring 反馈、automation contracts、Redis/job 可观测性和 Admin UI 的人工确认面；PG/pgvector 仍是读模型，不替代 MySQL 事实源。 |

更新后的主线开发顺序：

1. `inbox-ai-scoring-continuation`
2. `agent-and-automation-contracts`
3. `image-feature-retirement`
4. `admin-shell-and-weekly-workbench`
5. `redis-job-orchestration`
6. `hermes-weekly-intelligence`

Deferred follow-up, not in the mainline order:

- `security-and-runtime-hardening`
- Meilisearch timeout/circuit breaker / FULLTEXT fallback tuning
- Prisma 7 seed config migration (`package.json#prisma` -> `prisma.config.ts`)
- GitHub Actions Node.js 20 action runtime upgrade before 2026-09-16

## Post-F2 Reassessment

2026-06-05 完成并提交 `agent-and-automation-contracts` 后，剩余未开发 feature 需要按新的 `/api/v1` 契约重新排序和收窄范围。

| Feature | 是否需要迭代 | 调整结论 |
|---------|--------------|----------|
| `agent-and-automation-contracts` | 不需要继续迭代主线 | 已完成并提交 commit `1f38443`。已落地 automation token、scope、OpenAPI、`automation_runs`、idempotency、operation log mirror、`/api/v1/jobs/sync`、`/api/v1/jobs/score`、weekly candidates/suggestions/apply/publish、feedback digest、proxy pass-through、docs 和 live smoke。 |
| `image-feature-retirement` | 需要迭代 spec，作为下一步 | 顺序保持最前。现在 automation contract 已稳定，图片退役应先清 Admin UI/API/上传/裁剪/AI 图片生成入口，再确认 Astro 展示端读取点，最后用 Prisma Migrate drop legacy image fields。不得再新增 `database/*.sql`。 |
| `admin-shell-and-weekly-workbench` | 需要重写 spec 输入 | 工作台不应继续围绕 legacy `/api/weekly/auto-link` 或图片入口设计。新版 UI 应消费 `/api/v1/weekly/candidates`、`/api/v1/weekly/suggestions`、`/api/v1/weekly/suggestions/{id}/apply`、`/api/v1/weekly/publish`、`automation_runs` 状态和 OpenAPI 契约。应在图片入口退役后开发，避免新壳层继承 legacy image surface。 |
| `redis-job-orchestration` | 需要迭代 spec | 不再负责定义外部调用契约；只接管执行控制层。应把已存在的 `/api/v1` contract 作为 caller boundary，设计 Redis job/lock/rate-limit/status 与 `automation_runs` 的关系。任何 job/status 表需走 Prisma Migrate。 |
| `hermes-weekly-intelligence` | 需要迭代 spec，继续最后 | Hermes 不直接写 MySQL、不直接发布。它应通过 `/api/v1/ai/feedback/digest` 学习偏好，通过 candidates/suggestions contract 生成建议，经 Admin UI 人工确认后由 apply/publish 写回。PG/pgvector/hermes-db 仍是读模型。 |
| `security-and-runtime-hardening` | 仍 deferred | 本次 token 已 hash 存储并完成 smoke，但 secret rotation、token 管理 UI、审计面板、Prisma 7 config、Meili circuit breaker 仍不是主线阻塞项。 |

更新后的主线开发顺序：

1. `image-feature-retirement`
2. `admin-shell-and-weekly-workbench`
3. `redis-job-orchestration`
4. `hermes-weekly-intelligence`

执行含义：

- `image-feature-retirement` 是下一步，因为它会减少 UI 和依赖噪音，并为工作台重设计清理旧 surface。
- `admin-shell-and-weekly-workbench` 紧随其后，承接已稳定的 scoring/search/automation contracts，形成用户可操作的人工确认面。
- `redis-job-orchestration` 在 UI 后做更合适，因为任务中心需要真实工作台入口和用户可见状态语义。
- `hermes-weekly-intelligence` 最后接入，避免 Hermes 在没有人工确认面和任务状态之前变成隐式事实源。

Deferred follow-up, not in the mainline order:

- `security-and-runtime-hardening`
- Meilisearch timeout/circuit breaker / FULLTEXT fallback tuning
- Prisma 7 seed config migration (`package.json#prisma` -> `prisma.config.ts`)
- GitHub Actions Node.js 20 action runtime upgrade before 2026-09-16

---

## Post-F5 Reassessment

2026-06-06 完成 `image-feature-retirement` 后，剩余未开发 feature 需要按“无图片 Admin surface”重新排序和收窄范围。

| Feature | 是否需要迭代 | 调整结论 |
|---------|--------------|----------|
| `image-feature-retirement` | 不需要继续迭代主线 | 已完成。Admin 常规路径中的上传、裁剪、主图、封面、AI 图片生成、Quail 图片输出和图片专用依赖已退役；字段 drop 后置，acceptance 已记录 Astro 技术读取和 Prisma Migrate 前置条件。 |
| `admin-shell-and-weekly-workbench` | 需要迭代 spec，作为下一步 | 必须按无图片产品模型重写 UI 输入。新工作台不再设计封面/主图/裁剪入口，应消费 `/api/v1/weekly/candidates`、`/api/v1/weekly/suggestions`、`/api/v1/weekly/suggestions/{id}/apply`、`/api/v1/weekly/publish`、`automation_runs` 状态、评分输出和 search fallback。 |
| `redis-job-orchestration` | 需要迭代 spec，继续后置 | 不再负责补图片副作用，也不负责定义外部 API 契约。范围应收窄为执行控制层：Redis job/lock/rate-limit/status、任务中心、与 `automation_runs` 的映射，以及从现有 cron/API 到 job 的迁移。 |
| `hermes-weekly-intelligence` | 需要迭代 spec，仍最后 | Hermes 应基于无图片周刊候选、评分反馈和人工确认工作台生成建议；不直接写 MySQL、不直接发布、不成为事实源。 |
| `security-and-runtime-hardening` | 仍 deferred | secret rotation、token 管理 UI、审计面板、Prisma 7 config、Meili circuit breaker 仍不是主线阻塞项。 |

更新后的主线开发顺序：

1. `admin-shell-and-weekly-workbench`
2. `redis-job-orchestration`
3. `hermes-weekly-intelligence`

执行含义：

- `admin-shell-and-weekly-workbench` 是下一步，因为图片退役已经清掉 legacy UI surface，现在可以设计真正的生产驾驶舱和人工确认面。
- `redis-job-orchestration` 放在 UI 之后，因为任务中心需要真实工作台入口、状态语言和用户可见操作语义。
- `hermes-weekly-intelligence` 继续最后，因为 Hermes 建议需要稳定的候选/评分/API 契约、任务状态和人工确认 UI。

Deferred follow-up, not in the mainline order:

- `security-and-runtime-hardening`
- Meilisearch timeout/circuit breaker / FULLTEXT fallback tuning
- Prisma 7 seed config migration (`package.json#prisma` -> `prisma.config.ts`)
- GitHub Actions Node.js 20 action runtime upgrade before 2026-09-16
- Legacy image field drop migration after Astro technical reads and remaining historical scripts are cleared

## Post-F3 Reassessment

2026-06-08 完成 `redis-job-orchestration` 后，剩余主线只剩 Hermes 智能建议。Redis job 已把 `/api/v1/jobs/sync` 与 `/api/v1/jobs/score` 从 request lifecycle 长任务切到 BullMQ/Redis submit + independent worker execution。

| Feature | 是否需要迭代 | 调整结论 |
|---------|--------------|----------|
| `redis-job-orchestration` | 不需要继续迭代主线 | 已 PASS。验收记录 `specs/redis-job-orchestration/acceptance.md` 覆盖 queue、lock、rate-limit、status、retry、worker health、legacy compatibility、docs 和 runtime replay。真实 smoke run `auto_1e130ac9-df5b-431f-9e84-39c86e1cdc56` 证明 submit -> worker -> retry -> terminal `automation_runs` -> status/health 闭环。代表性 scoring 样本最终业务失败，但该失败已作为 terminal evidence 可见，不阻塞 orchestration。 |
| `hermes-weekly-intelligence` | 需要 specify，作为下一步 | 现在可消费稳定的 `/api/v1` 契约、评分输出、Redis job status、worker health 和工作台人工确认面。Hermes 仍不得直接写 MySQL 或直接发布；必须通过 Admin API 和人工确认闭环。 |
| `security-and-runtime-hardening` | 仍 deferred | secret rotation、token 管理 UI、审计面板、Prisma 7 config、Meili circuit breaker 仍不是主线阻塞项。 |

更新后的主线开发顺序：

1. `hermes-weekly-intelligence`

执行含义：

- `hermes-weekly-intelligence` 是下一步，因为 Redis job 已提供长任务状态语言和 worker 健康，工作台也已有人工确认面。
- `.active` 暂不切换到 `hermes-weekly-intelligence`，因为该 workspace 还未创建；下一轮 `specify hermes-weekly-intelligence` 时再创建目录并切换，避免 `.active` 指向空工作区。

Deferred follow-up, not in the mainline order:

- `security-and-runtime-hardening`
- Meilisearch timeout/circuit breaker / FULLTEXT fallback tuning
- Prisma 7 seed config migration (`package.json#prisma` -> `prisma.config.ts`)
- GitHub Actions Node.js 20 action runtime upgrade before 2026-09-16
- Legacy image field drop migration after Astro technical reads and remaining historical scripts are cleared
- Karakeep resync 内存 `Map` 状态迁入 Redis job/status
- Weekly suggest/apply/publish worker 化或完整任务中心页面

---

## Final Roadmap Closeout

2026-06-08 完成 `hermes-weekly-intelligence` 后，`admin-modernization-roadmap` 主线 feature 已全部收口。Umbrella roadmap 不再推荐新的主线 implementation feature；剩余事项均为明确延后的 follow-up 或独立新需求。

| Area | Final State | Evidence |
|------|-------------|----------|
| Next.js 16 baseline | PASS | `specs/next16-upgrade-baseline/acceptance.md` 记录 lint/type-check/test/build、proxy smoke 和 Node 版本证据。 |
| Database/search boundary | PASS | `specs/database-and-search-strategy/acceptance.md` 记录 Meili optional、health degraded、MySQL fallback 和 NAS smoke。 |
| Migration governance | PASS | `specs/migration-tooling-baseline/acceptance.md` 记录 Prisma baseline、seed、legacy deprecation 和 deploy migration evidence。 |
| Inbox scoring continuation | CONDITIONAL PASS | `specs/inbox-ai-scoring-continuation/acceptance.md` 记录 DB 状态闭环、UI evidence 和 score-batch contract；代表性样本上游 405 归为内容抓取质量 follow-up。 |
| Automation contracts | PASS | `specs/agent-and-automation-contracts/acceptance.md` 记录 token scope、OpenAPI、idempotency、automation_runs 和 live smoke。 |
| Image retirement | PASS | `specs/image-feature-retirement/acceptance.md` 记录 UI/API/publish/dependency 图片链路退役；字段 drop 后置。 |
| Admin shell/workbench | PASS | `specs/admin-shell-and-weekly-workbench/acceptance.md` 记录 dashboard/workbench、建议、发布检查、runs 和响应式 replay。 |
| Redis job orchestration | PASS | `specs/redis-job-orchestration/acceptance.md` 记录 BullMQ/Redis submit、worker、retry、status、health 和 runtime smoke。 |
| Hermes weekly intelligence | PASS | `specs/hermes-weekly-intelligence/acceptance.md` 记录 preview artifact register、workbench 展示、ops report 和人工 apply 写回。 |

最终顺序状态：

1. `next16-upgrade-baseline` - done
2. `database-and-search-strategy` - done
3. `migration-tooling-baseline` - done
4. `inbox-ai-scoring-continuation` - done with external-content follow-up
5. `agent-and-automation-contracts` - done
6. `image-feature-retirement` - done
7. `admin-shell-and-weekly-workbench` - done
8. `redis-job-orchestration` - done
9. `hermes-weekly-intelligence` - done

No next recommended mainline feature.

Deferred follow-up, not blocking roadmap closeout:

- `security-and-runtime-hardening`
- Meilisearch timeout/circuit breaker / FULLTEXT fallback tuning
- Prisma 7 seed config migration (`package.json#prisma` -> `prisma.config.ts`)
- GitHub Actions Node.js 20 action runtime upgrade before 2026-09-16
- Legacy image field drop migration after Astro technical reads and remaining historical scripts are cleared
- Karakeep resync 内存 `Map` 状态迁入 Redis job/status
- Weekly suggest/apply/publish worker 化或完整任务中心页面
- External Hermes skill runtime, NAS deployment and hermes-db/PG migrations in their owning runtime/repo
- 内容抓取质量治理，覆盖 representative scoring replay 中的上游 `405 Not Allowed`

`.active` 已切回 `admin-modernization-roadmap`，用于执行本次 closeout。完成后如继续新需求，应显式指定新的 feature 或从 deferred follow-up 中选择一个重新进入 `specify`。

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| Karakeep/RSS sync | `inbox_items.pending` | AI scoring / Inbox UI | Inbox 可看到新增候选；评分 job 能消费未评分项 |
| AI scoring | `inbox_items.ai_score`, `summary`, promoted `contents` | Weekly workbench / Hermes planner | 周刊候选池按 ready 内容和分数展示 |
| Operation logger | `operation_logs` feedback events | Hermes preference learning | `GET /api/v1/ai/feedback/digest` 返回真实反馈样本 |
| Admin candidates API | weekly candidates payload | Hermes weekly planner | Hermes run log 中记录输入候选和生成建议 |
| Hermes planner | weekly suggestions | Admin UI | Admin 建议面板展示入选/剔除/排序理由 |
| Admin UI confirmation | selected weekly items | `weekly_content_items` | 周刊工作台和预览显示已确认内容 |
| Redis worker | job status/events | Task center UI | 任务中心展示 running/succeeded/failed/retry |
| OpenAPI contract | `/api/openapi.json` | n8n / Hermes / Codex / Claude | 外部调用按 spec 鉴权并通过 operation log 可追踪 |
| Meilisearch optional backend | keyword search hits | Search UI / fallback search service | Meili 可用时返回命中；不可用时 UI 进入 degraded 或 MySQL fallback |
| PG/pgvector read model | embeddings/preferences | Hermes semantic recall | Hermes 建议引用语义相似内容或历史偏好 |

**孤儿 artifact 处理**: 图片字段在 F5 中属于 legacy artifact。它们的 consumer 必须被清零后才能 drop；在清零前不得删除字段。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 可演进性 | 每个 feature 独立交付 | umbrella plan 只定义路线；实现 feature 单独建工作区 | 每个 feature 有独立 `spec/plan/tasks` |
| 一致性 | 单一事实源 | MySQL/Prisma 继续承载核心业务写入 | 任何 n8n/Hermes 写入都通过 Admin API |
| 可观测性 | 任务状态可查、失败可重试 | 引入 Redis job status 和任务中心 | 失败任务可在 UI 看到原因并重试 |
| 安全 | 外部自动化最小权限 | API token + scope + idempotency + audit | token 调用写入接口时生成 operation log |
| 可用性 | 搜索/Meili 不影响启动 | Meilisearch optional，health 降级而非整体失败 | Meili down 时 Admin 可启动且主流程可用 |
| 用户体验 | 首页回答“本周能否发布” | 首页和周刊编辑页围绕生产状态设计 | 手动 replay 完成一周组刊流程 |

---

## Capacity / Scale Notes

- **规模假设**: 个人/小团队周刊管理；内容规模以数千到数万条为主。
- **读写特征**: 读多写少；同步、评分、建议生成是批处理；周刊确认是人工低频写入。
- **失败代价**:
  - 同步失败：内容池不足，周刊断更风险。
  - 评分失败：候选排序质量下降，但可人工处理。
  - Hermes 建议失败：不影响人工组刊。
  - Meilisearch 失败：搜索降级，不应影响核心生产链。
  - 发布失败：外部副作用，必须审计并支持重试。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 Next.js 16 升级策略 | 用户明确希望升级到 Next.js 16 | 直接升并修 Turbopack / 保持 Next 15 / 升级但长期 webpack | 升级到 Next 16，Turbopack 通过为完成目标，webpack 只作短期回退 | 需要处理 middleware/proxy、lint、Request APIs、Node 版本 | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| ADR-002 UI 基线 | 用户希望参考 `nextjs-tpl` | 当前 UI 微调 / 复制模板 / 以模板为主改造业务工作台 | 以 `nextjs-tpl` 壳层和视觉基调为主，但按周刊生产重组 | 需要较大 UI 迁移和视觉统一 | `/Users/yqg/personal/webs/nextjs-tpl` |
| ADR-003 数据库职责 | NAS 已有 PG/pgvector，但 Admin 当前 MySQL/Prisma | 迁主库到 PG / 保持 MySQL + PG 读模型 / 保持纯 MySQL | 保持 MySQL 事实源，PG/pgvector 做智能读模型 | 有数据同步/索引维护成本 | UNVERIFIED |
| ADR-004 自动化边界 | NAS 已有 n8n/Hermes/Redis | n8n/Hermes 直写 DB / 全部留在 Admin / API 契约接入 | n8n 编排、Hermes 判断、Redis 控制，写入经 Admin API | 需要 token/scope/OpenAPI 和审计 | UNVERIFIED |
| ADR-005 Meilisearch 策略 | NAS 已有 `karakeep-meilisearch`，本地 Admin 连接不稳 | 修本地 Meili / 复用 NAS Meili / 退役 Meili | Meili optional，优先评估复用 NAS 实例；PG/pgvector 做语义检索 | 关键词搜索仍需处理网络和 index 隔离 | NAS docker inspect, UNVERIFIED |
| ADR-006 图片字段 | 周刊已去图片 | 长期保留 / 立即 drop / 分阶段 drop | 后续 drop，但必须先清读取点和准备迁移回滚 | 需要跨 Admin/Astro 展示端确认 | UNVERIFIED |

---

## Key Design Decisions

### Decision 1: Next.js 16 先于 UI 和自动化

- **背景**: Next.js 16 会改变构建、lint、middleware/proxy、Request APIs 和 Turbopack 默认行为。
- **选项**:
  - A: 先升级 Next.js 16，再做 UI/自动化。
  - B: 先做 UI/自动化，再升级。
- **结论**: 选择 A。框架基线不稳时做 UI 和 API 改造会放大回归面。
- **影响**: `next16-upgrade-baseline` 是第一个执行 feature。
- **来源**: https://nextjs.org/docs/app/guides/upgrading/version-16

### Decision 2: Admin 不迁主库

- **背景**: 当前 Admin 与 Astro 展示端围绕 MySQL/Prisma 运行；PG/pgvector 更适合智能检索。
- **选项**:
  - A: 主库迁 PG。
  - B: MySQL 保持事实源，PG/pgvector 做读模型。
  - C: 全部保持 MySQL。
- **结论**: 选择 B。
- **影响**: 后续 F6 只定义读模型和迁移触发条件，不做主库迁移。
- **来源**: UNVERIFIED

### Decision 3: n8n/Hermes 先做契约，不做 NAS 侧实现

- **背景**: 用户明确希望先确认 feature 描述，后续再开发。
- **选项**:
  - A: 本轮直接开发 NAS workflow/skill。
  - B: 本轮只定义 API 契约和边界。
- **结论**: 选择 B。
- **影响**: F2/F4 先输出接口、scope、artifact 和验收；NAS 实现另开 feature。
- **来源**: 用户澄清

### Decision 4: Meilisearch optional

- **背景**: NAS 已有 `karakeep-meilisearch`，但未映射宿主端口；Admin 本地连不上符合现状。
- **选项**:
  - A: 继续修本地 Meilisearch。
  - B: 复用 NAS Meilisearch 并设为 optional。
  - C: 立即退役 Meilisearch。
- **结论**: 选择 B。Meili 关键词搜索可保留，但不再阻塞启动或整体 health。
- **影响**: 搜索服务需要 fallback/degraded 设计；health check 需要区分核心依赖和可选依赖。
- **来源**: NAS docker inspect, UNVERIFIED

---

## Module Design

### Module: Next.js 16 Baseline

**职责**: 稳定框架、构建、类型和路由基础。

**改动概述**:

- 升级 `next` / `eslint-config-next`。
- 替换 `next lint`。
- 处理 `src/middleware.ts` 到 `src/proxy.ts`。
- 检查 App Router async APIs。
- 调整 `next.config.ts`。

**关键接口 / 行为**:

```text
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

**注意事项**:

- Node.js 20.9+ 是生产环境门槛。
- `--webpack` 只能作为临时回退，不作为完成标准。

### Module: Admin Shell + Weekly Workbench

**职责**: 将用户主界面改成周刊生产驾驶舱。

**改动概述**:

- 新壳层：参考 `nextjs-tpl` 的侧栏、surface tokens、PageIntro、SectionHeader。
- 新首页：展示本周是否可发布。
- 新周刊工作台：候选、已选、预览、检查清单。

**关键接口 / 行为**:

```text
/dashboard -> 本周生产状态
/weekly -> 周刊列表 + 本周状态
/weekly/editor/[id] -> 候选池 + 编排 + 预览 + 发布检查
```

**注意事项**:

- 不做模板展示页。
- 避免卡片嵌套和营销式 hero。

### Module: Agent/API Contracts

**职责**: 给 n8n、Hermes、MCP 提供稳定访问边界。

**改动概述**:

- API token。
- Scope。
- OpenAPI。
- Agent-friendly endpoints。
- Idempotency + dry-run + operation log。

**关键接口 / 行为**:

```text
GET  /api/openapi.json
GET  /api/v1/weekly/candidates
GET  /api/v1/ai/feedback/digest
POST /api/v1/weekly/suggestions
POST /api/v1/jobs/sync
POST /api/v1/jobs/score
```

**注意事项**:

- Hermes/n8n 不直写 DB。
- 写入类接口必须可审计。

### Module: Redis Job Orchestration

**职责**: 统一长任务执行状态和失败处理。

**改动概述**:

- Job type registry。
- Worker 或轻量 job runner。
- Lock / rate limit / retry。
- Task center UI。

**关键接口 / 行为**:

```text
enqueue(jobType, payload, idempotencyKey)
worker.run(job)
job.status -> Admin task center
```

**注意事项**:

- 可从现有 cron 过渡。
- 不把 Redis 当业务表。

### Module: Hermes Intelligence

**职责**: 生成偏好、建议、排序和复盘。

**改动概述**:

- 定义 Hermes skill 输入输出。
- 使用 hermes-db/PG/pgvector 保存智能读模型。
- Admin UI 消费建议。

**关键接口 / 行为**:

```text
feedback digest -> Hermes preference memory
weekly candidates -> Hermes planner -> weekly suggestions
suggestions -> Admin UI -> user confirms -> Admin API writes MySQL
```

**注意事项**:

- 建议不是事实源。
- 人工确认后才落库。

### Module: Search Backend Strategy

**职责**: 搜索能力降级和未来演进。

**改动概述**:

- Meilisearch optional。
- Health check 区分 degraded。
- MySQL fallback。
- 后续 PG/pgvector 语义检索。

**关键接口 / 行为**:

```text
if meili available:
  keyword search via dedicated index
else:
  MySQL fallback for title/summary/description/source_url
```

**注意事项**:

- 若复用 NAS `karakeep-meilisearch`，必须独立 index。
- 不与 Karakeep index 混用。

### Module: Image Retirement

**职责**: 安全退役图片链路。

**改动概述**:

- UI 入口先移除。
- API/服务依赖后移除。
- 字段读取点清零。
- 独立迁移 feature drop 字段。

**关键接口 / 行为**:

```text
阶段 1: hide UI + stop new writes
阶段 2: remove services/deps
阶段 3: remove reads
阶段 4: migration drop fields
```

**注意事项**:

- drop 前必须确认 Astro 展示端也不读。
- 历史内容不能报错。

---

## Data Model

本 umbrella plan 不创建 `data-model.md`。原因是它只定义路线，不直接引入具体表结构。

各执行 feature 的数据模型要求：

- `agent-and-automation-contracts`: 需要 `api_tokens` / scope / audit 相关 data-model。
- `redis-job-orchestration`: 需要 job 类型、状态、重试和 idempotency data-model。
- `hermes-weekly-intelligence`: 需要 suggestion、preference memory、embedding metadata data-model。
- `image-feature-retirement`: 需要 legacy 字段 drop 迁移 data-model。
- `database-and-search-strategy`: 需要 read model / index 命名和同步策略 data-model。

---

## Project Structure

Roadmap 工作区：

```text
specs/admin-modernization-roadmap/
├── spec.md
└── plan.md
```

后续 feature 工作区建议：

```text
specs/next16-upgrade-baseline/
specs/admin-shell-and-weekly-workbench/
specs/agent-and-automation-contracts/
specs/redis-job-orchestration/
specs/hermes-weekly-intelligence/
specs/image-feature-retirement/
specs/database-and-search-strategy/
```

---

## Risks and Tradeoffs

- **Next.js 16 回归风险**: Turbopack 默认构建可能暴露 server external packages、配置或 App Router 类型问题。先独立升级可降低后续改造风险。
- **UI 改造范围膨胀**: 以周刊生产驾驶舱为边界，避免把所有页面一次性重做。
- **多系统边界不清**: n8n/Hermes/Redis/PG 都容易变成事实源。必须坚持写入经 Admin API。
- **Meilisearch 复用风险**: NAS 现有 Meili 在 Karakeep 网络内，复用需要网络和 index 隔离。
- **图片字段 drop 风险**: 跨 Admin 与 Astro 展示端，必须先清读取点再迁移。
- **过早引入复杂队列**: Redis job 先做轻量执行控制，避免引入重型平台。

---

## Evolution Path

- **MVP**:
  - Next.js 16 通过。
  - Admin 首页/周刊工作台可回答本周生产状态。
  - Agent/n8n API 契约稳定。
  - Meili optional，不阻塞启动。

- **成长期**:
  - Redis job 中心上线。
  - Hermes 输出建议和复盘。
  - PG/pgvector 建立智能读模型。
  - 图片字段完成 drop。

- **成熟期**:
  - n8n 负责稳定调度和通知。
  - Hermes 基于长期偏好持续优化选题。
  - 搜索能力按实际价值在 Meilisearch keyword 与 PG/pgvector semantic 间分层。

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。Redis/Hermes/PG 都作为后续 feature，Next16 和 UI 基线先行。
- 是否引用了外部模式但没有适配检查：否。`nextjs-tpl` 只作为壳层和工程参考，不迁 monorepo/Drizzle。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。Redis job、Meili optional、PG read model 均已记录为独立 feature。
- 是否形成多事实源：否。MySQL/Prisma 明确为事实源。

---

## Verification Strategy

### Roadmap 验证

- 每个 feature 有独立工作区。
- `.active` 在执行时指向当前 feature，而不是长期停留在 umbrella roadmap。
- 每个 feature 的 plan 都引用本 roadmap 的边界决策。

### Next.js 16 验证

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`
- `pnpm build`
- 验证 Node.js 20.9+ 生产环境。
- 验证 `proxy.ts` auth 行为和 API bearer token 行为。

### UI 验证

- 桌面和移动宽度截图。
- 周刊生产 workflow replay：同步候选 -> 评分/晋升 -> 组刊 -> 预览 -> 发布检查。
- 文本不溢出，按钮/表格/状态可扫描。

### Automation 验证

- n8n token 调用只拥有对应 scope。
- Hermes 建议不会直接写生产表。
- 写入接口重复调用不会重复写入。
- operation log 可追溯调用方和结果。

### Search 验证

- Meili down 时 Admin 可启动。
- health 显示 degraded 而非整体 unhealthy。
- MySQL fallback 可返回基本结果。
- 若复用 NAS Meili，使用独立 index 并通过连接测试。

### Image Retirement 验证

- 周刊 UI 不再出现图片入口。
- 历史内容读取不报错。
- drop 字段前，Admin 和 Astro 展示端读取点清零。

---

## Stage Readiness

- 是否需要 `data-model.md`：当前 umbrella plan 不需要；各执行 feature 已按需生成。
- 当前阶段：`closeout`
- 下一步建议：无新的主线 feature。若继续推进，只能从 deferred follow-up 中选择独立 feature 重新 `specify`，或由用户提出新需求。
- 阻塞项：无。Roadmap closeout 已汇总到 `acceptance.md`；提交仍需用户显式确认 commit plan。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 当前 umbrella roadmap 的主实现计划 |
| data-model.md | 不需要 | 本工作区不直接改实体；执行 feature 再生成 |
| tasks.md | 已生成 | 记录 roadmap 级任务清单和最终 T026 closeout |
| acceptance.md | 已生成 | 用于 roadmap 收尾验收 |
| commit-plan.md | 已生成 | 提交前确认 gate；未确认前不得 `git add` / `git commit` |

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| Next.js 16 upgrade | https://nextjs.org/docs/app/guides/upgrading/version-16 | 官方升级文档 |
| Next.js codemods | https://nextjs.org/docs/app/guides/upgrading/codemods | 官方 codemod 文档 |
| Next.js 16 announcement | https://nextjs.org/blog/next-16 | 缓存和默认构建行为参考 |
| `nextjs-tpl` UI/API baseline | `/Users/yqg/personal/webs/nextjs-tpl` | 本地模板仓库 |
| NAS Meilisearch state | UNVERIFIED | 通过 `ssh nas docker ps/inspect` 观察，需在对应 feature 中复核 |

# Implementation Plan: Admin Modernization Roadmap

**Workspace**: `admin-modernization-roadmap` | **Date**: 2026-06-02 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/admin-modernization-roadmap/spec.md`

---

## Summary

本计划把 Admin 现代化改造拆成一组可独立交付的 feature，并规定推荐执行顺序、跨系统边界、依赖关系和验证路径。推荐路线是：先完成 Next.js 16 基线，再处理本次基线验证暴露的搜索健康降级和既有评分闭环状态，然后收敛 UI 工作台和 API 契约，随后引入 Redis/Hermes 和图片退役。

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

### Phase 0: Framework Baseline

1. `next16-upgrade-baseline`
   - 已完成。保留为所有后续 UI 和路由改造的前置稳定层。

### Phase 1: Stabilize Existing Foundations

2. `database-and-search-strategy`
   - 先让 Meilisearch 成为真正 optional backend，避免 `/api/health` 因搜索服务不可用整体 503。
   - 明确 MySQL / Meili / PG / Redis 的健康检查与降级语义。

3. `migration-tooling-baseline`
   - 在继续新增或 drop 字段前，建立 Prisma migrate baseline。
   - 避免后续图片退役、API token、Redis job 等 feature 继续使用裸 SQL 漂移。

4. `inbox-ai-scoring-continuation`
   - 收口当前已经落地的 scoring schema/service/API/tests/acceptance。
   - 让 UI 工作台能消费稳定的 `ai_score`、`scoring_status`、`auto_promoted`、operation feedback。

### Phase 2: Automation Contracts

5. `agent-and-automation-contracts`
   - 提供 token、scope、OpenAPI、agent-friendly API。
   - 为 n8n、Hermes、MCP 后续开发建立稳定边界。

### Phase 3: Product Surface

6. `admin-shell-and-weekly-workbench`
   - 以 `nextjs-tpl` 为主重塑后台壳层和周刊生产驾驶舱。
   - 消费 F6/F8/F2 的稳定状态和 API，不在 UI feature 中补业务事实。

7. `image-feature-retirement`
   - 与 UI 工作台设计联动：先隐藏入口和停用读取，再做依赖删除，字段 drop 后置。

### Phase 4: Execution Control and Intelligence

8. `redis-job-orchestration`
   - 将长任务逐步迁入 Redis job/lock/status。
   - 形成任务中心和可观测性。

9. `hermes-weekly-intelligence`
   - 在 API 契约和读模型稳定后接入 Hermes skill。
   - 先做建议和复盘，不做自动发布。

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

- 是否需要 `data-model.md`：当前 umbrella plan 不需要；各执行 feature 按需生成。
- 下一步建议：`tasks`
- 阻塞项：无。建议优先为 `next16-upgrade-baseline` 创建独立 spec/plan/tasks，然后进入实现。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 当前 umbrella roadmap 的主实现计划 |
| data-model.md | 不需要 | 本工作区不直接改实体；执行 feature 再生成 |
| tasks.md | 后续阶段生成 | 建议生成 roadmap 级任务清单，随后切到 F0 |
| acceptance.md | 后续阶段生成 | 用于 roadmap 收尾验收 |

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| Next.js 16 upgrade | https://nextjs.org/docs/app/guides/upgrading/version-16 | 官方升级文档 |
| Next.js codemods | https://nextjs.org/docs/app/guides/upgrading/codemods | 官方 codemod 文档 |
| Next.js 16 announcement | https://nextjs.org/blog/next-16 | 缓存和默认构建行为参考 |
| `nextjs-tpl` UI/API baseline | `/Users/yqg/personal/webs/nextjs-tpl` | 本地模板仓库 |
| NAS Meilisearch state | UNVERIFIED | 通过 `ssh nas docker ps/inspect` 观察，需在对应 feature 中复核 |

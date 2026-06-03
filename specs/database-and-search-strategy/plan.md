# Implementation Plan: Database And Search Strategy

**Workspace**: `database-and-search-strategy` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/database-and-search-strategy/spec.md`

---

## Summary

把 Meilisearch 从隐式硬依赖改成显式 optional keyword backend：健康检查支持 degraded，搜索 API 支持 MySQL fallback，Meilisearch index 名称可配置并默认使用 Admin 专用命名。MySQL + Prisma 保持业务事实源，Postgres/pgvector、Redis、Meilisearch 都只作为后续读模型或基础设施能力。

---

## Architecture Overview

本方案采用 CQRS-lite / read-model 思路，但只在当前单体 Next.js 应用内做最小落地：MySQL 是唯一写入事实源，Meilisearch 是可重建 keyword index，MySQL fallback 是 Meilisearch 不可用时的保底查询路径。

```text
Content writes
  -> MySQL via Prisma                         [required]
  -> best-effort Meilisearch index sync       [optional, log on failure]

Search reads
  -> Search service wrapper
      -> Meilisearch keyword index            [enabled]
      -> MySQL fallback via Prisma            [fallback]
      -> explicit disabled/misconfigured meta [disabled]

Health reads
  -> startup + MySQL                          [required]
  -> Meilisearch health                       [optional]
  -> overall: healthy | degraded | unhealthy
```

`/api/search` 不直接在 route 里判断连接错误，而是消费 search service 的结构化结果。`/api/health` 不再把 search 单项故障提升为整体 503。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| CQRS / Read Model | UNVERIFIED | MySQL 写模型保持事实源，Meilisearch 和未来 PG/pgvector 做可重建读模型 | 不做完整 CQRS，不引入事件总线或双写强一致协议 | 成长期 |
| Graceful Degradation | UNVERIFIED | 搜索不可用时核心 Admin 流程继续可用，health 显示 degraded | 不隐藏 MySQL/startup 这类关键故障 | MVP/成长期 |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| MySQL content writes | `contents` rows | Meilisearch sync functions | 内容保存后调用 sync；Meili down 时 warning 不回滚 MySQL |
| MySQL content rows | fallback result rows | `/api/search` response | Meili down 测试返回 `meta.mode = "fallback"` 且有分页结果 |
| Meilisearch sync functions | Admin keyword index documents | Meilisearch search path | Meili available 测试调用 configured index 返回 `meta.mode = "meilisearch"` |
| Meilisearch health check | Search service status | `/api/health` | Meili down 测试 `services.search.status = "degraded"` 且整体非 503 |
| Search service wrapper | `SearchResult` + metadata | route/client API consumers | route response 保持 `data`，新增 backward-compatible `meta` |
| Spec database boundary | source-of-truth decision | 后续 Hermes/Redis/PG features | 后续 specs/plans 引用该边界，不把读模型当事实源 |

**孤儿 artifact 处理**: Postgres/pgvector read model 本 feature 只定义边界，不生产数据；它是后续 Hermes/semantic-search feature 的预留消费方，不在本 feature 验收中要求落地。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 可用性 | Meilisearch down 不拖垮 Admin | health 支持 degraded；search 支持 fallback | 单测/route smoke 模拟 Meili down |
| 一致性 | MySQL 是唯一事实源 | index/read-model 写失败不回滚 MySQL | content 写入路径测试或现有 sync best-effort 检查 |
| 安全 | 共享 Meili 不污染 Karakeep | index 名称可配置并拒绝危险共享配置 | 配置单测覆盖 shared host + generic index |
| 性能 | fallback 不做无界扫描 | limit 上限、字段选择、保守排序 | fallback 单测覆盖空查询、limit、过滤 |
| 可观测性 | 能区分 enabled/fallback/disabled/misconfigured | search/health meta 结构化 | 响应 snapshot/断言 |

---

## Capacity / Scale Notes

- **规模假设**: 当前内容量约千级到低万级；fallback 目标是故障期间可用，不承担长期高质量搜索。
- **读写特征**: 搜索读多于索引写；内容写入必须优先保证 MySQL 成功。
- **失败代价**: Meili 慢或不可用会降低搜索体验；MySQL 不可用会影响核心业务，必须继续整体失败。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 Health degraded 语义 | 当前 `/api/health` 因 Meili down 返回 503 | A: 继续 503 / B: HTTP 200 + `overall: degraded` / C: 拆 readiness 和 liveness | 选择 B，本 feature 先保持一个 endpoint 并表达 degraded | 部署系统若只看 200 会忽略搜索故障，需日志/响应体观测 | UNVERIFIED |
| ADR-002 Fallback 查询策略 | Prisma schema 未建模 FULLTEXT，实际 DB 索引不确定 | A: 直接 FULLTEXT / B: Prisma `contains` / C: 不做 fallback | 选择 B，先做保守 contains + limit；FULLTEXT 作为后续优化 | 相关性和性能弱于 FULLTEXT/Meili | UNVERIFIED |
| ADR-003 Meili index 命名 | 当前硬编码 `contents`，共享实例有污染风险 | A: 继续 `contents` / B: `MEILISEARCH_INDEX_NAME` + Admin 默认 / C: 多 index 分层 | 选择 B，默认 `weekly_admin_contents`，共享实例拒绝 `contents` | 需要一次 index 重建/回填 | UNVERIFIED |
| ADR-004 NAS Meili 复用 | NAS 可能已有 Karakeep Meili，但网络和权限未核实 | A: 本 feature 直接接入 / B: 仅预留配置与防误写 / C: 放弃 Meili | 选择 B，复用接入作为后续运维 feature | 本 feature 不解决 NAS 网络访问 | UNVERIFIED |
| ADR-005 PG/pgvector 边界 | 后续 Hermes 需要语义召回 | A: 现在接入 PG / B: 只记录读模型边界 / C: 迁主库 | 选择 B，避免扩大本 feature | 语义检索不在本轮交付 | UNVERIFIED |

---

## Key Design Decisions

### Decision 1: Health 使用 degraded 而不是 search 失败即 503

- **背景**: Search 是效率能力，不是 Admin 事实源依赖；MySQL/startup 才是关键健康条件。
- **选项**:
  - A: Search unhealthy 继续影响 overall，简单但继续造成单点故障。
  - B: Search unhealthy 时 `overall = "degraded"`，HTTP 200，响应体保留 search 错误。
  - C: 拆 `/api/health/live` 与 `/api/health/ready`，语义更完整但扩大改动。
- **结论**: 选择 B。本 feature 保持 endpoint 兼容，同时修复部署健康误伤。
- **影响**: `HealthStatus.status` 和 response `overall` 类型要扩展到 `degraded`；status code 仅在 `unhealthy` 返回 503。
- **来源**: UNVERIFIED

### Decision 2: Search route 调用结构化 search service

- **背景**: 当前 route 捕获字符串错误判断 Meili down，逻辑脆弱且无法表达 fallback。
- **选项**:
  - A: 在 route catch 中直接调用 fallback。
  - B: 在 `src/lib/search.ts` 内封装 `searchContentsWithFallback`，返回结果和 mode metadata。
- **结论**: 选择 B，保持 route 薄，搜索降级逻辑集中。
- **影响**: `SearchResult` 增加可选 metadata；现有 client 仍读取 `data` 不破坏。
- **来源**: UNVERIFIED

### Decision 3: Fallback 先用 Prisma contains，不依赖 FULLTEXT

- **背景**: `database/schema.sql` 有 FULLTEXT，但当前 Prisma schema 不建模，生产状态需验证。
- **选项**:
  - A: `$queryRaw` + FULLTEXT，搜索质量较好但依赖实际索引。
  - B: Prisma `contains` + OR fields + limit，最保守。
  - C: 无 fallback，只返回 degraded 503。
- **结论**: 选择 B。若后续确认 FULLTEXT 存在，再优化。
- **影响**: fallback 支持的过滤/排序子集要显式记录到 metadata。
- **来源**: UNVERIFIED

### Decision 4: Meili index 名称可配置并拒绝共享危险默认值

- **背景**: 当前 `CONTENT_INDEX = 'contents'` 不适合共享 NAS Meili。
- **选项**:
  - A: 继续硬编码。
  - B: `MEILISEARCH_CONTENT_INDEX`，默认 `weekly_admin_contents`。
  - C: index prefix + 多模型 index。
- **结论**: 选择 B，满足当前单 index 模型并降低污染风险。
- **影响**: `setupContentIndex`、sync、search、stats、clear、wait task 都必须统一使用配置后的 index。
- **来源**: UNVERIFIED

---

## Module Design

### Module: Search Configuration

**职责**: 集中读取和校验 Meilisearch 配置。

**改动概述**:

- 新增或扩展 `src/lib/search.ts` 内配置层。
- `MEILISEARCH_CONTENT_INDEX` 默认 `weekly_admin_contents`。
- 可选 `MEILISEARCH_SHARED_INSTANCE=true` 或根据 host 配置策略触发危险 index 校验。
- 禁止共享实例使用 `contents` 这类泛用 index。

**关键接口 / 行为**:

```text
getSearchConfig():
  host = env.MEILISEARCH_HOST ?? "http://localhost:7700"
  indexName = env.MEILISEARCH_CONTENT_INDEX ?? "weekly_admin_contents"
  shared = env.MEILISEARCH_SHARED_INSTANCE === "true"
  if shared and indexName in ["contents", "bookmarks", "karakeep", ...]:
    return misconfigured
```

**注意事项**:

- 不把 secrets 写入日志。
- `.env.example` 需要补充新变量。

### Module: Search Service With Fallback

**职责**: 提供 Meilisearch + fallback 的统一搜索入口。

**改动概述**:

- 保留现有 `searchContents` Meilisearch 逻辑，或拆为 `searchContentsInMeili`。
- 新增 `searchContentsWithFallback(options)`。
- 新增 `searchContentsInMysql(options, reason)`。
- 搜索结果增加 `meta`，例如 `{ mode, degraded, reason, unsupportedFilters }`。

**关键接口 / 行为**:

```text
searchContentsWithFallback(options):
  if search config is disabled/misconfigured:
    return mysqlFallback(options, reason)
  try:
    return meiliSearch(options) + meta(mode="meilisearch")
  catch connection/auth/index errors:
    log warning
    return mysqlFallback(options, reason)
  catch non-recoverable validation errors:
    throw
```

**注意事项**:

- fallback 不承诺 highlight。
- fallback 对 unsupported sort/filter 在 metadata 中说明。
- suggestions 仍可在 Meili down 时返回 `[]`，不作为 P1 fallback。

### Module: MySQL Fallback Search

**职责**: 在 Meilisearch down 时提供基础内容查找。

**改动概述**:

- 使用 Prisma `contents.findMany` 和 `count`。
- 支持分页、limit 上限、基础 status/contentType/category/source/user/date 过滤。
- 查询字段优先覆盖 title、description、summary、content、source、source_url。
- 空查询按 `updated_at desc` 或 `created_at desc` 排序。

**关键接口 / 行为**:

```text
where = AND([
  query ? OR([
    title contains query,
    description contains query,
    summary contains query,
    content contains query,
    source contains query,
    source_url contains query
  ]) : {},
  supported filters
])
findMany({ where, skip, take, orderBy, select })
```

**注意事项**:

- 不用 `$queryRaw` 做 FULLTEXT，除非后续任务先验证 schema。
- 避免返回过大的 `content`；可截断或只返回必要字段，具体由实现阶段按现有 UI 需求决定。

### Module: Health Check

**职责**: 表达关键依赖健康与可选依赖降级。

**改动概述**:

- `HealthStatus.status` 扩展到 `healthy | degraded | unhealthy`。
- `overall` 扩展到 `healthy | degraded | unhealthy`。
- startup/db 失败设置 overall unhealthy。
- search 失败设置 search degraded；若当前 overall 仍 healthy，则改为 degraded。
- status code: unhealthy => 503；healthy/degraded => 200。

**关键接口 / 行为**:

```text
overall = healthy
if startup/db fail:
  overall = unhealthy
if search fail and overall != unhealthy:
  overall = degraded
return statusCode = overall === "unhealthy" ? 503 : 200
```

**注意事项**:

- 日志里记录 degraded status。
- 保持现有 `services.search` 字段位置，减少前端/运维解析破坏。

### Module: Environment Documentation

**职责**: 让部署者理解搜索配置和共享实例风险。

**改动概述**:

- 更新 `.env.example`：
  - `MEILISEARCH_CONTENT_INDEX="weekly_admin_contents"`
  - 可选 `MEILISEARCH_SHARED_INSTANCE="false"`
- 更新 NAS/deployment docs 中 Meilisearch optional 说明。

**注意事项**:

- 不记录真实 `.env` 中的 host/key 值。

---

## Data Model

不新增 MySQL 表，也不迁移主库。需要单独 `data-model.md` 记录逻辑状态模型、配置项和读模型边界，因为本 feature 引入了 `Search Degradation State`、index 命名和未来 read-model 关系。

---

## Project Structure

```text
src/lib/search.ts                         # search config, Meili path, MySQL fallback, metadata
src/app/api/search/route.ts               # consume structured search service
src/app/api/health/route.ts               # degraded health semantics
src/lib/services/search-api.ts            # optional response metadata typing if needed
.env.example                              # new safe config variables
docs/nas-deployment.md                    # optional Meili deployment semantics
specs/database-and-search-strategy/
  spec.md
  plan.md
  data-model.md
  tasks.md                               # next stage
```

---

## Risks and Tradeoffs

- MySQL `contains` fallback may be slow or low quality on larger datasets; mitigated by pagination, conservative fields, and future FULLTEXT optimization.
- HTTP 200 for degraded health can hide search outages from simple uptime probes; mitigated by response body, logs, and future split readiness/liveness endpoints if needed.
- Changing default index from `contents` to `weekly_admin_contents` may require backfill; tasks must include reindex/backfill or setup command verification.
- Shared NAS Meili is not fully solved; this feature only prevents unsafe default usage and leaves network attachment to a later operational decision.
- Search result metadata may require small client typing changes, but should keep existing `data` shape compatible.

---

## Evolution Path

- **MVP**: health degraded + MySQL fallback + configurable Admin index.
- **成长期**: verify real FULLTEXT availability, add `$queryRaw` FULLTEXT fallback, add reindex job/status, formalize NAS Meili access mode.
- **成熟期**: split health endpoints, introduce Redis-backed job/status for index rebuilds, add PG/pgvector semantic retrieval as separate read model.

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。只采用 CQRS-lite 边界，不引入事件总线、完整 CQRS 或主库迁移。
- 是否引用了外部模式但没有适配检查：否。所有参考均标为 UNVERIFIED，按当前代码现实收敛。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。新增状态已在 `data-model.md` 记录；不新增队列和缓存。

---

## Verification Strategy

- Unit tests for search config:
  - default index is Admin-specific.
  - shared instance rejects `contents`.
  - secrets are not exposed in error/meta.
- Unit tests for MySQL fallback:
  - query builds supported filters.
  - empty query uses safe ordering.
  - limit is capped.
  - unsupported filters/sorts are reported in metadata.
- Route tests or focused integration tests for `/api/search`:
  - Meili success returns `meta.mode = "meilisearch"`.
  - Meili connection failure returns HTTP 200 with fallback metadata.
  - invalid request remains HTTP 400.
- Health route tests:
  - db/startup healthy + Meili down => HTTP 200 and `overall = "degraded"`.
  - db down => HTTP 503 and `overall = "unhealthy"`.
  - all healthy => HTTP 200 and `overall = "healthy"`.
- Static verification:
  - `pnpm lint`
  - `pnpm type-check`
  - focused `pnpm test` for changed modules

---

## Stage Readiness

- 是否需要 `data-model.md`：需要。原因是本 feature 引入逻辑状态、配置项、读模型/index 关系，但不新增 DB 表。
- 下一步建议：`tasks`
- 阻塞项：无。NAS Meili 复用、FULLTEXT 优化、health endpoint 拆分均不阻塞 MVP 任务拆解。

---

## Design Artifacts

本次计划涉及的产物：

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 主实现计划 |
| data-model.md | 需要 | 记录搜索状态、配置、读模型关系 |
| tasks.md | 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | 后续阶段生成 | 用于最终验收结论 |

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| CQRS-lite / Read Model | UNVERIFIED | 来自架构质量门参考，未查外部官方文档 |
| Health degraded semantics | UNVERIFIED | 当前仓库约束下的本地决策 |
| MySQL fallback strategy | UNVERIFIED | 基于当前 Prisma schema 与 legacy SQL 差异 |
| Meilisearch index strategy | UNVERIFIED | 基于当前硬编码 index 与 roadmap 风险 |


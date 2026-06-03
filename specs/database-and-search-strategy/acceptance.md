# Acceptance Record: Database And Search Strategy

**Workspace**: `database-and-search-strategy` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)

---

## Evidence Table

| Requirement | Evidence | Test or File | Verdict |
|---|---|---|---|
| FR-001 health must define `healthy` / `degraded` / `unhealthy` | `HealthStatus.status` and `HealthCheckResponse.overall` now include `degraded`; route tests assert healthy, degraded, and unhealthy outcomes. | `src/app/api/health/route.ts`; `src/app/api/health/route.test.ts` | PASS |
| FR-002 Meilisearch unavailable must not make Admin global health 503 | Mocked `client.health()` failure returns HTTP 200 with `overall = "degraded"` and `services.search.status = "degraded"`. | test: `/api/health route > returns degraded HTTP 200 when only Meilisearch is down` | PASS |
| FR-003 MySQL/startup critical failures must remain unhealthy | Mocked `prisma.$queryRaw` failure returns HTTP 503 with `overall = "unhealthy"` and database status unhealthy. | test: `/api/health route > returns unhealthy HTTP 503 when database is down` | PASS |
| FR-004 `/api/search` must support Meili path and MySQL fallback | `searchContentsWithFallback` returns Meili metadata on success and calls `searchContentsInMysql` on Meili failure. GET/POST routes call the fallback-aware service. | `src/lib/search.ts`; `src/app/api/search/route.ts`; `src/lib/search.test.ts`; `src/app/api/search/route.test.ts` | PASS |
| FR-005 fallback response must include machine-readable metadata | Route tests assert HTTP 200 search response with `data.meta.mode = "fallback"`; service tests assert `degraded = true` and reason. | test: `/api/search route > returns fallback search results with HTTP 200 for GET/POST`; `search service > falls back to MySQL when Meilisearch search fails` | PASS |
| FR-006 fallback must cover safe content fields | MySQL fallback builds OR search over `title`, `description`, `summary`, `content`, `source`, `source_url`. | `src/lib/search.ts` `searchContentsInMysql` | PASS |
| FR-007 fallback must cap pagination | Service test passes `limit: 200` and asserts resulting limit is capped at `100`. | test: `search service > falls back to MySQL when Meilisearch search fails` | PASS |
| FR-008 Meili index name configurable with Admin default | `getSearchConfig()` defaults to `weekly_admin_contents`; test asserts `client.index()` uses default and configured values. | test: `search service > uses an Admin-specific index by default`; `uses the configured index name` | PASS |
| FR-009 shared Meili must reject generic `contents` index | Shared instance + `MEILISEARCH_CONTENT_INDEX=contents` marks config misconfigured and skips index write. | test: `search service > skips writes for dangerous shared index configuration` | PASS |
| FR-010 search index write failure must not block MySQL writes | Sync functions retain best-effort behavior and now also skip dangerous config without throwing. Content write callers still catch sync failures. | `src/lib/search.ts`; `src/lib/services/content.ts` existing best-effort calls | PASS |
| FR-011 degraded/fallback/index failures must be observable | Search responses expose `meta.mode`, `meta.reason`, `meta.unsupportedFilters`; health logs use `overall` status including degraded. | `src/lib/search.ts`; `src/app/api/health/route.ts`; focused tests | PASS |
| FR-012/013 database boundaries and future migration triggers documented | MySQL source-of-truth, Meili keyword index, PG/pgvector read model, Redis runtime state are recorded; no DB migration added. | `specs/database-and-search-strategy/plan.md`; `data-model.md`; `acceptance.md` | PASS |
| FR-014 NAS Meili reuse requires network/key/index checks | NAS deployment doc says Meili is optional, requires Admin independent index, and network access is separate. | `docs/nas-deployment.md` | PASS |

## Verdict Summary

| Dimension | Verdict | Notes |
|---|---|---|
| Component capability | PASS | Search config, index naming, fallback search, route integration, health degraded behavior, and startup validation were implemented with focused tests. |
| Workflow closure | PASS | Meili failure flows to MySQL fallback locally and on NAS after deploying the Prisma relation-name fix. |
| User-visible outcome | PASS | `/api/health` returns degraded HTTP 200 and authenticated `/api/search` returns fallback HTTP 200 on NAS. |

**Overall**: PASS

## Workflow Replay

- **输入摘要**: Meilisearch request failure represented by mocked `index.search()` rejection / `client.health()` rejection.
- **最终 payload 摘要**: `/api/search` response contains `success: true`, `data.meta.mode: "fallback"`; `/api/health` response contains `overall: "degraded"` and HTTP 200.
- **用户可见结果断言**: Search and health no longer report global service failure for Meili-only outage; database outage still returns unhealthy 503.
- **Replay 类型**: fixture. Focused route/service tests simulate the Meilisearch outage without requiring a live dev server.

## Verification Commands

```bash
pnpm test src/lib/search.test.ts src/app/api/search/route.test.ts src/app/api/health/route.test.ts
pnpm type-check
pnpm lint
```

Results on 2026-06-03:

- Focused tests: 3 files passed, 12 tests passed.
- Type check: passed.
- Lint: passed with existing warnings, 0 errors.
- `pnpm lint --quiet`: passed.
- `pnpm build`: passed.

## Runtime Smoke

NAS smoke on 2026-06-03 before redeploying the local fallback fix:

- `/api/health`: PASS. HTTP 200, `overall = "degraded"`, database/startup healthy, search degraded because Meilisearch health is unavailable.
- Unauthenticated `/api/search`: PASS for auth guard. HTTP 401 `Authentication required`.
- Authenticated `/api/search`: FAIL on the old deployed image. Request reached fallback after Meilisearch failure, then returned HTTP 500 because fallback used `include.category` while the generated Prisma relation is `categories`.

Local fix:

- `src/lib/search.ts` now uses `include.categories` for MySQL fallback.
- `mapContentToSearchDocument` accepts `categories?.name` and keeps compatibility with `category?.name`.
- `src/lib/search.test.ts` now asserts fallback category mapping and `include.categories`.

Remaining runtime gate:

- Completed by GitHub Actions run `26868458179`, commit `c6b425b`.

NAS smoke on 2026-06-03 after redeploying commit `c6b425b`:

- `/api/health`: PASS. HTTP 200, `overall = "degraded"`, database/startup healthy, search degraded because Meilisearch health is unavailable.
- Authenticated `/api/search?q=__sdd_smoke_database_search__&limit=1`: PASS. HTTP 200, `success = true`, `total = 0`, `data.meta.mode = "fallback"`, `data.meta.degraded = true`, `data.meta.reason = "meilisearch_unavailable"`.

## Closeout Checklist

| Check | Status | Notes |
|---|---|---|
| 旧逻辑退役 | PASS | `/api/search` 不再把 Meili connection failure 映射为 503；`scripts/test-search.ts` 改为 fallback-aware；startup validation 不再要求 `MEILISEARCH_HOST` 必填。 |
| 发布/CI 跟进 | PASS | 无数据库迁移；GitHub Actions run `26868458179` build/deploy success；部署后 NAS smoke 通过。 |
| 文档更新 | PASS | `.env.example`、`docs/nas-deployment.md`、`scripts/README.md` 已更新 optional Meili 与共享 index 规则。 |
| ADR 保留 | PASS | `plan.md` 保留 health degraded、fallback 查询、index 命名、NAS 复用边界、PG/pgvector 边界决策。 |
| 架构债 / 后续演进 | PASS | FULLTEXT fallback 优化、NAS Docker network 接入、PG/pgvector semantic retrieval 均明确延后，不阻塞本 feature。 |
| Workflow replay | PASS | fixture replay 通过；真实 NAS `/api/health` 和 authenticated `/api/search` 通过。 |

## Final Completion Record

**Status**: Complete.

**Delayed by design**:

- 不做 MySQL -> Postgres 主库迁移。
- 不实现 PG/pgvector semantic retrieval。
- 不自动接入 NAS `karakeep-meilisearch` Docker network。
- 不把 fallback 提升到 FULLTEXT；除非后续确认生产 schema 与性能边界。

**Deployment note**:

- Existing deployments may keep `MEILISEARCH_HOST` unset or unreachable; Admin should continue with degraded/fallback search.
- Shared Meilisearch deployments must use an Admin-specific index such as `weekly_admin_contents`.
- Production secrets/API keys should be rotated because a container inspect during smoke investigation exposed environment values in tool output.

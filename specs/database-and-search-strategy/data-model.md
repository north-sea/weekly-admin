# Data Model: Database And Search Strategy

**Workspace**: `database-and-search-strategy` | **Date**: 2026-06-03

> 本 feature 不新增数据库表。此文件记录逻辑状态、配置项、读模型/index 关系和未来迁移边界。

---

## Logical Entities

### MySQL Business Source Of Truth

**描述**: Admin 的业务事实源。保存不可丢失的内容、周刊、分类、标签、inbox、配置等数据。

| 字段 / 资源 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `contents` | MySQL table | required | 搜索 index 和 fallback 的主要来源 |
| `weekly_issues` | MySQL table | required | 周刊事实源 |
| `inbox_items` | MySQL table | required | 内容池事实源 |
| Prisma datasource | MySQL | required | 本 feature 不改 datasource provider |

**状态规则**:

```text
MySQL write succeeds
  -> business fact committed
  -> optional read-model/index sync may succeed or fail independently
```

### Meilisearch Keyword Index

**描述**: 可重建的关键词搜索读模型，不保存业务事实。

| 字段 / 配置 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `MEILISEARCH_HOST` | URL | optional | 未配置时可使用本地默认或进入 disabled/fallback 策略，具体实现按现有兼容处理 |
| `MEILISEARCH_MASTER_KEY` | secret | optional | 不得写入日志或文档 |
| `MEILISEARCH_CONTENT_INDEX` | string | default `weekly_admin_contents` | Admin 专用 index |
| `MEILISEARCH_SHARED_INSTANCE` | boolean string | default `false` | 为 `true` 时启用危险 index 校验 |

**禁止值**:

```text
when MEILISEARCH_SHARED_INSTANCE=true:
  MEILISEARCH_CONTENT_INDEX must not be:
    - contents
    - bookmarks
    - karakeep
    - karakeep_contents
```

具体禁止列表可在实现阶段按代码可维护性收敛，但必须覆盖 `contents`。

### Search Degradation State

**描述**: 搜索能力在 API 和 health 中暴露的逻辑状态。

| 状态 | 含义 | HTTP 行为 | 说明 |
|------|------|-----------|------|
| `enabled` | Meilisearch 可用，使用 keyword index | `/api/search` 200；health search healthy | 正常路径 |
| `fallback` | Meilisearch 不可用，使用 MySQL fallback | `/api/search` 200；health search degraded | 可用性优先 |
| `disabled` | 搜索后端未启用，但 MySQL 可用 | `/api/search` 200 或空结果 + metadata；health search degraded | 具体由实现保持兼容 |
| `misconfigured` | 搜索配置危险或无效 | `/api/search` fallback；health search degraded | 例如共享实例使用泛用 index |
| `unhealthy` | MySQL 或应用启动失败 | `/api/search` 5xx；health overall unhealthy | 关键依赖失败 |

**状态转换**:

```text
enabled
  -> fallback        when Meilisearch connection/auth/index request fails
  -> misconfigured  when config validation rejects search write/read

fallback
  -> enabled         when next Meilisearch request succeeds
  -> unhealthy      when MySQL fallback also fails

misconfigured
  -> enabled         after config fixed and Meilisearch request succeeds
  -> fallback        for read requests if MySQL is available
```

### MySQL Fallback Search Result

**描述**: Meilisearch 不可用时由 Prisma 查询生成的基础搜索结果。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `hits` | array | required | 映射为现有 `SearchDocument` 兼容形状 |
| `total` | number | required | fallback count；若性能考虑跳过 count，必须在 metadata 中说明 |
| `page` | number | required | 与现有 API 一致 |
| `limit` | number | required | 必须应用最大上限 |
| `processingTimeMs` | number | required | fallback 查询耗时 |
| `query` | string | required | 原始 query |
| `meta.mode` | string | `fallback` | 表示降级路径 |
| `meta.degraded` | boolean | true | 机器可读降级标记 |
| `meta.reason` | string | optional | Meili down / disabled / misconfigured |
| `meta.unsupportedFilters` | string[] | optional | 被忽略或降级的过滤/排序 |

### Postgres/pgvector Read Model

**描述**: 后续 Hermes、语义检索、偏好记忆和 agent run log 的读模型/记忆层。

| 资源 | 类型 | 约束 | 说明 |
|------|------|------|------|
| embeddings | vector rows | future | 从 MySQL 内容事实生成 |
| preference memory | structured records | future | 人工反馈或 Hermes 学习结果 |
| agent run logs | structured records | future | Agent 执行记录 |
| suggestions | structured records | future | 建议结果，需人工确认后才写回 MySQL |

**边界规则**:

```text
PG/pgvector data may recommend or recall.
It must not become source-of-truth content.
User confirmation writes final business facts to MySQL.
```

### Redis Runtime State

**描述**: 后续 job、lock、rate-limit、status 的运行时状态。

| 资源 | 类型 | 约束 | 说明 |
|------|------|------|------|
| job status | ephemeral key/value | future | 可过期、可重建 |
| locks | ephemeral key/value | future | 防并发，不保存业务事实 |
| rate limits | ephemeral key/value | future | 可过期 |

**边界规则**:

```text
Redis may coordinate runtime behavior.
Redis must not hold irreplaceable business facts.
```

---

## Relationships

```text
MySQL contents
  1:N derived Meilisearch Keyword Index documents
  1:N future PG/pgvector embedding rows

Meilisearch Keyword Index
  N:1 source MySQL contents
  can be rebuilt from MySQL

MySQL Fallback Search
  reads MySQL contents directly
  does not create durable records

Redis Runtime State
  references jobs or resource ids
  does not own source data
```

---

## DDL Scripts

No DDL in this feature.

```sql
-- No database tables are added or modified by database-and-search-strategy MVP.
```

---

## Migration Notes

- 不新增 Prisma migration。
- `.env.example` 新增配置项不需要数据库迁移。
- 如果后续选择 FULLTEXT fallback 优化，必须先验证生产 MySQL schema，再在单独 migration feature 中补齐 Prisma/SQL 迁移策略。
- 如果后续接入 PG/pgvector，必须作为独立 feature 定义 read model tables、同步策略和回填任务。


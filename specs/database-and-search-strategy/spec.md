# Feature Specification: Database And Search Strategy

**Workspace**: `database-and-search-strategy`  
**Created**: 2026-06-03  
**Status**: Draft  
**Input**: 用户描述: "开始吧"；上游来源为 `admin-modernization-roadmap` F6 与 `assessment.md`

> 本 spec 将 roadmap 中的 F6 独立成可执行 feature。写入本文件后，应同步更新 `specs/.active` 指向当前 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 搜索请求会在 Meilisearch、MySQL fallback、健康检查、后续 PG/pgvector read model 之间分阶段决策。 |
| `external-side-effects` | ✅ | 会写入/同步外部 Meilisearch index；未来可能连接 NAS Meilisearch、Redis、Postgres/pgvector。 |
| `artifact-handoff` | ✅ | MySQL 内容事实源会生成搜索 index document；后续 PG/pgvector read model 也会消费内容事实源。 |
| `user-visible-output` | ✅ | `/api/health`、`/api/search`、搜索结果和降级状态会直接影响用户与运维可见结果。 |
| `prior-closure-failure` | ✅ | 现状已出现 roadmap 要求与代码行为不一致：Meilisearch 被定义为 optional，但 `/api/health` 与 `/api/search` 仍会硬失败。 |

**结论**: 下游 plan 必须包含 Producer-Consumer Matrix；verify 必须启用 Evidence Gate；closeout 必须给出 Component / Workflow / User-Visible Outcome 三维 Verdict。

---

## Context Summary

当前项目已经将 MySQL + Prisma 作为业务事实源。`prisma/schema.prisma` 使用 MySQL datasource，`contents` 是核心内容表。旧 `database/schema.sql` 中存在 `FULLTEXT INDEX idx_search (title, description, content)`，但 Prisma schema 未显式建模该 FULLTEXT index，后续 fallback 方案不能假设所有环境都可靠存在该索引。

Meilisearch 当前是部分 optional：

- 写入侧 `syncContentToSearch` / `bulkSyncContentsToSearch` 捕获错误并仅记录 warning。
- 读取侧 `searchContents` 仍会抛错。
- `/api/search` 在 Meilisearch 不可达时返回 503。
- `/api/health` 将 Meilisearch 失败计入整体 unhealthy，导致全局 503。
- index 名称硬编码为 `contents`，不适合复用共享 Meilisearch 实例。

本 feature 的目标是先把数据库与搜索职责边界固定下来，修正 Meilisearch optional 的端到端语义，再为后续 Hermes、PG/pgvector、Redis、搜索 UI 打基础。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 搜索服务不可用时 Admin 仍可运行 (Priority: P1)

作为 Admin 维护者，我希望 Meilisearch 不可用时系统仍能启动、健康检查不整体失败，并且核心内容管理流程不被搜索服务阻塞。

**Why this priority**: 这是当前最直接的可靠性问题。roadmap 已要求 Meilisearch optional，但现有 `/api/health` 会因搜索服务不可用返回全局 503。

**Acceptance Scenarios**:

1. **[US1-1] 健康检查降级**
   **Given** 数据库可用、应用启动校验通过、Meilisearch 不可达  
   **When** 调用 `/api/health`  
   **Then** 响应必须表达 search degraded/disabled，而不是因为 search 单项失败将 Admin 判定为整体不可用

2. **[US1-2] 核心写入不依赖搜索**
   **Given** Meilisearch 不可达  
   **When** 内容创建、编辑、删除或周刊生产链路触发搜索索引同步  
   **Then** MySQL 写入必须成功，搜索同步失败只能被记录为可观察 warning

**Edge Cases**:

- **[US1-3] 数据库不可用**：MySQL 失败仍必须让整体 health 失败；不能因为引入 degraded 状态掩盖事实源不可用。
- **[US1-4] 启动校验失败**：应用关键配置错误仍必须让整体 health 失败。
- **[US1-5] Meilisearch 间歇性恢复**：恢复后搜索能力应自动回到 enabled/healthy，不要求重启 Admin。

### User Story 2 - 搜索请求有可预期的降级路径 (Priority: P1)

作为内容编辑者，我希望搜索服务不可用时仍能做基础内容查找，至少可以通过标题、摘要、正文、来源链接找到候选内容。

**Why this priority**: 搜索是工作台效率功能，但不应成为单点故障。fallback 目标是可用性，不追求与 Meilisearch 完全等价的相关性。

**Acceptance Scenarios**:

1. **[US2-1] Meilisearch 可用时使用 keyword index**
   **Given** Meilisearch 可达且 Admin index 已配置  
   **When** 调用 `/api/search?q=...`  
   **Then** 系统使用 Meilisearch 返回 keyword search 结果，并保留分页、过滤、排序能力的既有语义

2. **[US2-2] Meilisearch 不可用时 fallback**
   **Given** Meilisearch 不可达但 MySQL 可用  
   **When** 调用 `/api/search?q=...`  
   **Then** 系统使用 MySQL fallback 返回基础搜索结果，并在响应中标记 degraded/fallback 状态

3. **[US2-3] fallback 结果可用但不承诺等价**
   **Given** 同一查询在 Meilisearch 与 MySQL fallback 中执行  
   **When** 比较返回结果  
   **Then** fallback 只承诺基础匹配、分页和安全响应，不承诺高亮、拼写容错、复杂相关性排序与 Meilisearch 完全一致

**Edge Cases**:

- **[US2-4] 空查询**：fallback 必须有明确排序规则，避免全表无序扫描。
- **[US2-5] 复杂过滤条件**：fallback 不支持的过滤/排序能力必须被显式降级或忽略，并在响应 metadata 中说明。
- **[US2-6] 大内容表**：fallback 查询必须有分页上限和超时/性能保护。

### User Story 3 - 共享搜索基础设施不会污染 Karakeep (Priority: P1)

作为运维者，我希望如果复用 NAS 上的 `karakeep-meilisearch`，Admin 必须使用独立 index 命名空间、独立配置和明确权限，避免污染或误删 Karakeep 搜索数据。

**Why this priority**: roadmap 已指出 NAS Meilisearch 可能在 Karakeep Docker 网络内，复用会涉及网络、权限、index 隔离和运维边界。

**Acceptance Scenarios**:

1. **[US3-1] Admin index 可配置**
   **Given** 配置了 Admin 专用搜索 index 名称或前缀  
   **When** Admin 初始化或同步搜索索引  
   **Then** 系统只能写入 Admin 专用 index，不能写入通用 `contents` 或 Karakeep index

2. **[US3-2] 阻止危险默认值**
   **Given** Admin 被配置为复用共享 Meilisearch 实例  
   **When** index 名称仍为泛用 `contents` 或疑似 Karakeep index  
   **Then** 系统必须拒绝启动搜索写入能力或显式禁用 Meilisearch 写入

3. **[US3-3] 网络不可达时不阻塞 Admin**
   **Given** Admin 容器无法访问 Karakeep Docker 网络内的 Meilisearch  
   **When** Admin 启动或搜索请求执行  
   **Then** 搜索能力进入 degraded/disabled，不影响 Admin 主流程

**Edge Cases**:

- **[US3-4] API key 权限不足**：搜索初始化或写入失败必须降级并记录错误，不得破坏 MySQL 写入。
- **[US3-5] index 配置变更**：切换 index 名称必须有重建/回填路径，避免读写落到不同 index。

### User Story 4 - 数据库职责边界被固定 (Priority: P2)

作为项目维护者，我希望 MySQL、Postgres/pgvector、Redis、Meilisearch 的职责边界写清楚，避免后续 Hermes 或自动化功能盲目迁库或引入双事实源。

**Why this priority**: 这是后续 Hermes、PG/pgvector 和 Redis feature 的架构前置条件，但本轮重点仍是当前搜索降级和健康检查可靠性。

**Acceptance Scenarios**:

1. **[US4-1] MySQL 保持事实源**
   **Given** 后续 feature 需要读取内容、周刊、分类、标签、inbox 数据  
   **When** 设计数据写入路径  
   **Then** MySQL + Prisma 仍是业务事实源，Postgres/pgvector、Redis、Meilisearch 不能成为替代事实源

2. **[US4-2] PG/pgvector 是智能读模型**
   **Given** 后续 Hermes 或语义检索需要向量召回  
   **When** 写入 embeddings、偏好记忆、agent run log  
   **Then** 这些数据属于智能读模型或记忆层，不直接替代 MySQL 内容事实

3. **[US4-3] Redis 只承担基础设施状态**
   **Given** 后续 job、lock、rate-limit 或 status 需要低延迟状态  
   **When** 写入 Redis  
   **Then** Redis 数据必须可重建或可过期，不保存不可丢失业务事实

**Edge Cases**:

- **[US4-4] 未来迁主库**：本 feature 只定义触发条件和决策标准，不执行 MySQL 到 Postgres 的主库迁移。
- **[US4-5] 双写失败**：读模型/index 写入失败不得回滚已成功的 MySQL 事实写入，除非后续 plan 明确某个场景需要强一致。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须定义 `healthy`、`degraded`、`unhealthy` 的 health 语义，并明确哪些服务故障会影响整体 HTTP status。
- **FR-002**: Meilisearch 不可用不得单独导致 Admin 整体 health 返回 503。
- **FR-003**: MySQL 或应用启动校验失败仍必须让整体 health 失败。
- **FR-004**: `/api/search` 必须支持 Meilisearch 可用路径和 MySQL fallback 路径。
- **FR-005**: `/api/search` fallback 响应必须包含可机器识别的 degraded/fallback metadata。
- **FR-006**: fallback 查询必须至少覆盖 `contents.title`、`contents.description`、`contents.summary`、`contents.content`、`contents.source`、`contents.source_url` 中可安全查询的字段。
- **FR-007**: fallback 查询必须有分页上限，默认结果数和最大结果数不得超过现有 API limit 约束。
- **FR-008**: 系统必须将 Meilisearch index 名称改为可配置，并提供 Admin 专用默认值。
- **FR-009**: 当配置为复用共享 Meilisearch 实例时，系统必须拒绝使用泛用 `contents` index 作为写入目标。
- **FR-010**: 搜索索引写入失败不得阻塞 MySQL 内容写入。
- **FR-011**: 系统必须记录 Meilisearch 降级、fallback 使用、index 初始化失败等事件，便于运维定位。
- **FR-012**: spec/plan 必须记录 MySQL、Postgres/pgvector、Redis、Meilisearch 的职责边界。
- **FR-013**: spec/plan 必须明确未来从 MySQL 迁移主库到 Postgres 的触发条件，但本 feature 不执行迁库。
- **FR-014**: 若后续选择复用 NAS `karakeep-meilisearch`，必须先确认 Docker 网络访问方式、API key 权限、index 隔离和回填/备份策略。

### Non-Functional Requirements

- **NFR-001 (可用性)**: 搜索服务不可用时，内容管理、周刊编辑、inbox 晋升等核心 MySQL 流程仍可运行。
- **NFR-002 (性能)**: MySQL fallback 必须使用分页、字段选择和保守查询策略，避免无界全表扫描。
- **NFR-003 (安全)**: 文档和日志不得输出 Meilisearch master key、数据库密码或其他 secret。
- **NFR-004 (可观测性)**: health 和 search API 响应必须足以区分 Meilisearch 正常、fallback、disabled、配置错误。
- **NFR-005 (向后兼容)**: Meilisearch 可用时，现有搜索 API 的基本响应结构和调用方式应保持兼容，除非 plan 明确迁移策略。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 可用性 | Meilisearch down 不拖垮 Admin | 当前 health 503 已暴露单点故障 | health/search smoke 覆盖 Meili down 场景 | 是 |
| 一致性 | MySQL 是唯一业务事实源 | 避免 Meili/PG/Redis 形成双事实源 | plan 中职责边界与写入规则 | 是 |
| 安全 | 共享 Meili 不污染 Karakeep index | 复用 NAS 服务有误写风险 | index 命名校验与配置约束 | 是 |
| 性能 | fallback 有上限和保守查询 | 内容表增长后避免慢查询拖垮 API | 测试覆盖 limit、分页、空查询 | 是 |
| 可演进性 | 为 PG/pgvector 和 Redis 留边界 | 后续 Hermes/语义检索依赖清晰边界 | plan 中迁移触发条件和非目标 | 否 |

### Key Entities

- **MySQL Business Source Of Truth**
  - 当前 Prisma datasource。
  - 保存内容、周刊、分类、标签、inbox、配置等不可丢失业务事实。

- **Meilisearch Keyword Index**
  - 可重建的 keyword search index。
  - 不保存业务事实。
  - 必须使用 Admin 专用 index 名称或前缀。

- **Search Degradation State**
  - API/health 可见状态。
  - 至少区分 `enabled`、`fallback`、`disabled`、`misconfigured`。

- **MySQL Fallback Search**
  - Meilisearch 不可用时的基础搜索路径。
  - 优先保证可用性和安全响应，不承诺 Meilisearch 等价相关性。

- **Postgres/pgvector Read Model**
  - 后续 Hermes/语义检索使用。
  - 保存 embeddings、偏好记忆、agent run logs、建议记录等智能读模型数据。

- **Redis Runtime State**
  - 后续 job、lock、rate-limit、status 使用。
  - 数据必须可过期、可重建，不作为业务事实源。

---

## Business Metrics *(optional — 上线后度量)*

- **BM-001**: Meilisearch 不可用时，Admin health 不再因为 search 单项失败返回全局 503。
- **BM-002**: Meilisearch 不可用期间，`/api/search` fallback 请求成功率可被观测。
- **BM-003**: 搜索索引同步失败不再导致内容写入失败。

---

## Out of Scope

明确不在本次功能范围内：

- 不把 Admin 主库从 MySQL 迁移到 Postgres。
- 不实现 pgvector 语义检索。
- 不实现 Hermes agent 工作流。
- 不重建搜索 UI。
- 不删除或重构核心内容表。
- 不把 Karakeep 的 Meilisearch index 作为 Admin index 使用。
- 不要求 MySQL fallback 搜索达到 Meilisearch 的高亮、拼写容错、相关性排序能力。
- 不引入新的搜索服务替代 Meilisearch。

---

## Unclear Questions *(if applicable)*

- **Q1**: `/api/health` 在 search degraded 时应返回 HTTP 200 还是 200 + `overall: degraded`？推荐在 plan 阶段结合部署健康检查约束决定。
- **Q2**: MySQL fallback 是否使用 FULLTEXT 取决于生产 schema 是否真实存在 FULLTEXT index；若无法确认，plan 应先采用保守 `contains` 查询并记录性能边界。
- **Q3**: 是否复用 NAS `karakeep-meilisearch` 需要后续通过 NAS Docker 网络和权限检查确认；本 spec 不预设一定复用。

---

## Stage Readiness

- 下一步建议：`plan`
- 阻塞项：无阻塞性需求歧义；Q1-Q3 可在 plan 阶段通过技术探索和部署约束收口。


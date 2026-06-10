# Feature Specification: Admin Modernization Roadmap

**Workspace**: `admin-modernization-roadmap`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: 用户描述: "汇总本次要改动的内容，能接受拆成多个 feature，另外希望升级到 Next.js 16；参考 nextjs-tpl 优化功能和 UI；结合 NAS 上的 Hermes Agent、n8n、Redis、Postgres/pgvector/hermes-db MCP；周刊已去掉图片，有些功能可去掉。"

> 写入本文件后，应同步更新 `specs/.active` 指向当前 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 改造涉及 Next.js 16 升级、UI 工作台、Agent/n8n/Redis 流水线、图片功能退役、数据库读模型等多个阶段。 |
| `external-side-effects` | ✅ | 后续 feature 会调用 n8n、Hermes、Quail、Redis job、数据库写入和部署构建。 |
| `artifact-handoff` | ✅ | Hermes 生成建议供 Admin UI 审核；n8n/Redis job 产出运行状态供任务中心消费；OpenAPI 契约供 Agent/MCP 调用。 |
| `user-visible-output` | ✅ | 目标包含管理端 UI、周刊工作台、任务中心、Agent 建议面板和图片功能入口清理。 |
| `prior-closure-failure` | ✅ | 既有文档指出断更根因是内容池不足；已有 `inbox-ai-scoring` 和自动化文档存在但端到端闭环仍需继续收敛。 |

**结论**: 下游 `plan` 必须启用 Producer-Consumer Matrix；`verify` 必须有 Evidence Gate；`closeout` 必须做 Workflow Replay，并给出 Component / Workflow / User-Visible Outcome 三维 Verdict。

---

## Summary

本规格是周刊 Admin 现代化改造的 umbrella spec，不直接承诺一次性实现所有改动。它的目标是把本次讨论拆成多个可独立推进的 feature，并固定跨 feature 的边界与优先级。

核心方向：

1. 将 Admin 从“功能堆叠后台”改成“周刊生产驾驶舱”。
2. 升级到 Next.js 16，并处理官方迁移要求。
3. 参考 `~/personal/webs/nextjs-tpl` 的后台壳层、API token、OpenAPI、部署治理和 agent-friendly 入口。
4. 利用 NAS 上已有 n8n、Hermes Agent、Redis、Postgres/pgvector/hermes-db MCP，但保持 Admin/MySQL 为业务事实源。
5. 在周刊去图片后，退役图片上传、裁剪、AI 封面、截图等不再需要的功能链路。
6. 保持已有 `inbox-ai-scoring` 和 `migration-tooling-baseline` 工作区，不把它们强行合并到本 spec。

---

## Proposed Feature Split

### F0. `next16-upgrade-baseline`

**目标**: 将 Admin 从 Next 15.4.4 升级到 Next.js 16，并确保 build/typecheck/test/lint 重新可用。

**范围**:

- 升级 `next` 与 `eslint-config-next` 到 16 系列。
- 检查 Node.js 运行要求，生产部署必须满足 Node 20.9+。
- 将 `src/middleware.ts` 迁移到 Next 16 的 `proxy.ts` / `proxy` 约定，或明确保留 middleware 的条件。
- 替换 `next lint` 脚本为 ESLint CLI。
- 检查同步 Request APIs 移除带来的 App Router 类型问题，包括 `cookies`、`headers`、`draftMode`、`params`、`searchParams`。
- 运行 `next typegen` 并更新 type-check 流程。
- 验证 Turbopack 默认 build/dev 行为；以 Turbopack build 通过作为长期目标，必要时保留 `--webpack` 作为短期诊断/发布回退。
- 清理 `next.config.ts` 中 Next 16 不再支持或语义改变的配置。

**非目标**:

- 不在本 feature 中重构 UI。
- 不迁移数据库。
- 不引入 monorepo。

### F1. `admin-shell-and-weekly-workbench`

**目标**: 参考 `nextjs-tpl` 的后台壳层和结构组件，把 Admin 首页和周刊编辑改造成“本周生产驾驶舱”。

**范围**:

- 重组导航为生产线：采集、筛选、组刊、发布、复盘、设置。
- 首页展示本周周刊状态：候选内容、待评分、待晋升、已选内容、发布状态、失败任务。
- 周刊编辑页升级为主工作台：候选池、已选编排、真实预览、完整度、发布检查清单。
- 抽象 `PageIntro`、`SectionHeader`、`SurfacePanel` 等轻量布局组件，吸收 `nextjs-tpl` 的结构思想。
- 降低卡片嵌套和入口噪音，保留 shadcn/lucide 体系。
- UI 风格以 `nextjs-tpl` 为主：紧凑侧栏、深色/中性色壳层、低噪控制台风格、清晰状态色和统一 surface tokens。

**非目标**:

- 不做与周刊生产无关的模板展示页。
- 不做营销型首页。

### F2. `agent-and-automation-contracts`

**目标**: 为 n8n、Hermes Agent、Codex/Claude/MCP 提供稳定的 Admin API 契约和鉴权方式。

**范围**:

- 增加 API Token / Bearer Auth 机制，支持为 n8n、Hermes、MCP 分配独立 token。
- 定义最小 scope：`sync:run`、`score:run`、`weekly:read`、`weekly:suggest`、`weekly:publish`、`ops:read`。
- 暴露 `/api/openapi.json` 或 `/api/v1/openapi.json`。
- 增加 agent-friendly endpoint：
  - `GET /api/v1/weekly/candidates`
  - `GET /api/v1/ai/feedback/digest`
  - `POST /api/v1/weekly/suggestions`
  - `POST /api/v1/jobs/sync`
  - `POST /api/v1/jobs/score`
- 写入类接口必须支持 idempotency key、dry-run、operation log。

**非目标**:

- Hermes 不直接写生产表。
- n8n 不直接成为业务事实源。
- 本 roadmap 阶段只确认相关 feature 描述、契约边界和后续工作区拆分；不在本阶段开发 NAS 侧 n8n workflow 或 Hermes skill。

### F3. `redis-job-orchestration`

**目标**: 将长任务从 Next API Route / 进程内 cron 中逐步迁出，用 Redis job/lock/rate-limit 提升可观测性和稳定性。

**范围**:

- 定义 job 类型：sync sources、score inbox、generate weekly draft、publish Quail、Hermes suggestion refresh。
- Redis 用于队列、锁、rate limit 和任务状态缓存。
- Admin UI 增加任务中心：最近运行、失败原因、重试入口、执行耗时。
- 保留现有进程内 cron 作为过渡或 fallback。

**非目标**:

- 不要求一次性移除所有 `croner` 逻辑。
- 不要求引入复杂分布式调度平台。

### F4. `hermes-weekly-intelligence`

**目标**: 将 Hermes 接入为“有记忆的判断层”，负责偏好学习、选题建议、排序建议和复盘报告。

**范围**:

- 定义 Hermes Skill：
  - `weekly_preference_learning`
  - `weekly_issue_planner`
  - `weekly_ops_report`
- 使用 hermes-db MCP / Postgres / pgvector 保存偏好记忆、向量索引、建议记录和 agent run logs。
- Admin UI 展示 Hermes 建议，人确认后由 Admin API 写入 MySQL。
- 明确 MySQL 仍为业务事实源；Postgres/hermes-db 是智能读模型和记忆层。

**非目标**:

- 不迁移主业务库到 Postgres。
- 不让 Hermes 自动发布或直接改生产周刊。
- 本 roadmap 阶段只确认 Hermes 相关 feature 描述；具体 skill、MCP 调用和 NAS 部署改造留到独立 feature 后续开发。

### F5. `image-feature-retirement`

**目标**: 周刊去图片后，分阶段退役图片相关 UI、API、依赖和字段读取。

**范围**:

- 隐藏或删除周刊图片、封面、截图、AI 图片生成入口。
- 移除或停用：
  - `/api/ai/image`
  - `/api/upload/image`
  - inbox crop image
  - `ScreenshotPasteUploader`
  - `image-cropper`
  - 周刊预览中的 `image_url` / `cover` 渲染
  - `browser-image-compression`
  - `react-image-crop`
  - `sharp`（若无其他用途）
- 字段先标记 legacy，确认 Admin 与 Astro 展示端均不再读取后再考虑 drop：
  - `contents.image_url`
  - `weekly_issues.cover`
  - `inbox_items.image_url`
  - `favicon_url`
- 后续确认执行 drop：上述字段不长期保留，必须在独立迁移 feature 中完成读取点清零、数据备份/快照、迁移脚本和回滚说明后删除。

**非目标**:

- 不在本 umbrella spec 中立即执行破坏性 DB drop。
- 不影响历史内容安全读取。

### F6. `database-and-search-strategy`

**目标**: 固定 MySQL、Postgres、Redis、Meilisearch 的职责边界，避免盲目迁库。

**范围**:

- MySQL + Prisma 继续作为业务事实源。
- Postgres/pgvector/hermes-db 作为智能读模型、向量库、偏好记忆和 Agent 运行记录。
- Redis 作为 job/lock/rate-limit/status。
- Meilisearch 降级为 optional keyword search backend；优先评估复用 NAS 上现有 `karakeep-meilisearch`，但不得作为 Admin 启动或健康检查的必需依赖。
- 若复用 NAS Meilisearch，Admin 必须使用独立 index 命名空间，且不得和 Karakeep index 混用。
- 若 Admin 容器不在 `karakeep-app_default` 网络内，必须通过独立 feature 选择访问方式：加入 external Docker network、为 Meilisearch 暴露受控端口，或放弃复用。
- pgvector/Postgres 覆盖语义检索和 Hermes 召回，不立即替代 Meilisearch 的关键词搜索职责。
- 输出是否迁移主库的决策标准和未来迁移触发条件。

**非目标**:

- 本轮不把 Admin 主库从 MySQL 迁移到 Postgres。
- 不把 `nextjs-tpl` 的 SQLite/Postgres 双模式迁入 Admin。

### F7. `migration-tooling-baseline`

**目标**: 延续已有工作区，将自定义迁移脚本和裸 SQL 流程收敛到标准 Prisma migrate + seed。

**关系**:

- 已存在 `specs/migration-tooling-baseline/spec.md`。
- 本 roadmap 不替代该 spec，只把它列为现代化路线中的基础治理 feature。

### F8. `inbox-ai-scoring-continuation`

**目标**: 延续已有 `inbox-ai-scoring`，保证内容池、评分、晋升是后续周刊自动化的前提。

**关系**:

- 已存在 `specs/inbox-ai-scoring/spec.md`、`plan.md`、`tasks.md`。
- 本 roadmap 不重写该 feature；后续 Hermes 和 Redis feature 应消费其输出。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 作为维护者，我能看到清晰的现代化 feature 拆分 (Priority: P1)

作为 Admin 维护者，我希望把本次讨论拆成多个可执行 feature，以便按风险和价值分阶段推进，而不是一次性大重构。

**Why this priority**: 当前需求横跨框架升级、UI、Agent、自动化、数据库、图片退役和运维，不拆分会导致计划不可执行。

**Acceptance Scenarios**:

1. **[US1-1]**
   **Given** 我打开本 spec  
   **When** 查看 Proposed Feature Split  
   **Then** 我能看到每个 feature 的目标、范围和非目标

2. **[US1-2]**
   **Given** 已有 `inbox-ai-scoring` 和 `migration-tooling-baseline` 工作区  
   **When** 查看本 roadmap  
   **Then** 它们被纳入路线，但不被本 spec 覆盖或重写

**Edge Cases**:

- **[US1-3]** 如果某个 feature 后续范围扩大，必须新建或更新自己的 `specs/<feature>/spec.md`，不能只依赖本 umbrella spec。

### User Story 2 - 作为 Next.js 工程维护者，我能安全规划 Next.js 16 升级 (Priority: P1)

作为 Next.js 工程维护者，我希望 Next.js 16 升级成为独立 feature，以便先处理框架 breaking changes，再做 UI 和自动化改造。

**Why this priority**: Next.js 16 会影响构建、lint、proxy/middleware、Turbopack、Request APIs 和部署 Node 版本。

**Acceptance Scenarios**:

1. **[US2-1]**
   **Given** Admin 当前是 Next 15.4.4  
   **When** 执行 F0  
   **Then** `pnpm build`、`pnpm type-check`、`pnpm test` 和新的 lint 命令必须通过

2. **[US2-2]**
   **Given** 当前存在 `src/middleware.ts`  
   **When** 升级到 Next.js 16  
   **Then** 必须处理 `middleware` 到 `proxy` 的迁移或明确保留 middleware 的理由

**Edge Cases**:

- **[US2-3]** 若 Turbopack build 与当前 server external packages 或 alias 不兼容，必须提供 `--webpack` 回退策略并记录风险。

### User Story 3 - 作为周刊运营者，我能用驾驶舱完成每周生产 (Priority: P1)

作为周刊运营者，我希望 Admin 首页和周刊编辑页围绕“本周生产状态”组织，以便快速知道还缺什么、哪里失败、下一步该做什么。

**Why this priority**: 当前平台入口偏工具堆叠，不能直接回答本周周刊是否能发布。

**Acceptance Scenarios**:

1. **[US3-1]**
   **Given** 我进入 Admin 首页  
   **When** 查看本周状态  
   **Then** 能看到候选内容、待评分、待晋升、已选内容、发布状态和失败任务

2. **[US3-2]**
   **Given** 我进入周刊工作台  
   **When** 调整本期内容  
   **Then** 能在同一页面完成候选筛选、排序、预览和发布前检查

**Edge Cases**:

- **[US3-3]** 如果内容池不足，驾驶舱必须提示根因是同步、评分、晋升还是人工未确认。

### User Story 4 - 作为自动化维护者，我能让 n8n/Hermes 安全接入 Admin (Priority: P1)

作为自动化维护者，我希望 n8n、Hermes、MCP 使用受控 API 和 token 接入，以便自动化可观测、可撤销、可审计。

**Why this priority**: NAS 已有 n8n、Hermes、Redis、Postgres，必须明确边界后再接入。

**Acceptance Scenarios**:

1. **[US4-1]**
   **Given** n8n 需要触发同步或评分  
   **When** 使用 API token 调用 Admin  
   **Then** Admin 能按 scope 鉴权并记录 operation log

2. **[US4-2]**
   **Given** Hermes 生成周刊建议  
   **When** Admin 收到建议  
   **Then** 建议只作为待确认输入展示，不直接修改生产周刊

**Edge Cases**:

- **[US4-3]** 如果 Hermes 或 n8n 重复调用写入接口，Admin 必须通过 idempotency key 防止重复写入。

### User Story 5 - 作为维护者，我能逐步退役图片功能而不破坏历史内容 (Priority: P2)

作为维护者，我希望去掉周刊图片后能安全清理相关功能，以便降低代码和依赖复杂度。

**Why this priority**: 当前图片相关功能分散在上传、裁剪、RSS 抽取、占位图、预览、AI 图片生成等多个链路。

**Acceptance Scenarios**:

1. **[US5-1]**
   **Given** 周刊展示不再使用图片  
   **When** 打开 Admin 周刊相关页面  
   **Then** 不应再出现封面、截图、AI 图片生成、图片裁剪等入口

2. **[US5-2]**
   **Given** 历史内容仍有图片字段  
   **When** 读取历史内容  
   **Then** 不应因字段存在或图片 URL 无效导致页面错误

**Edge Cases**:

- **[US5-3]** 数据库字段删除必须延后到确认 Admin 与 Astro 展示端均不再读取后执行。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须将本次现代化拆分为多个独立 feature，并为每个 feature 明确目标、范围、非目标和依赖。
- **FR-002**: `next16-upgrade-baseline` 必须作为独立 feature，不与 UI 重构或 Agent 接入混在同一次交付中。
- **FR-003**: Admin 必须保持 MySQL + Prisma 为业务事实源，除非后续单独 feature 明确批准迁库。
- **FR-004**: Postgres/pgvector/hermes-db 必须被定义为智能读模型、向量库和 Agent 记忆层，而不是默认替代 MySQL。
- **FR-005**: Redis 必须被定义为 job queue、lock、rate limit 和 job status 层，而不是业务事实源。
- **FR-006**: n8n 必须通过 Admin API 编排任务，不直接写入核心业务表。
- **FR-007**: Hermes 必须通过 Skill / MCP / API 消费数据并生成建议，不直接发布或修改生产周刊。
- **FR-008**: Admin UI 必须围绕周刊生产线重组，而不是继续只保留平铺功能菜单。
- **FR-009**: 图片功能退役必须先隐藏入口、停用链路，再移除依赖，最后才考虑删除字段。
- **FR-010**: Agent/n8n 写入类接口必须支持 token scope、dry-run、idempotency key 和 operation log。
- **FR-011**: OpenAPI 或等价 API 契约必须供 Agent/MCP/n8n 使用。
- **FR-012**: 已存在的 `inbox-ai-scoring` 和 `migration-tooling-baseline` spec 必须作为依赖纳入路线，而不是重复定义。
- **FR-013**: Meilisearch 不得阻塞 Admin 启动或整体健康状态；连接失败只能让搜索能力进入 degraded/disabled 状态。
- **FR-014**: 若复用 NAS 上 Karakeep 的 Meilisearch 实例，Admin 必须使用独立 index，并明确 Docker 网络/API key/权限配置。

### Non-Functional Requirements

- **NFR-001**: Next.js 16 升级后生产环境必须运行在 Node.js 20.9+。
- **NFR-002**: 现代化改造必须支持分阶段发布，每个 feature 都能独立验证和回滚。
- **NFR-003**: UI 改造必须优先服务重复操作效率和信息扫描，不引入营销式首页。
- **NFR-004**: 外部自动化必须可审计，任何写入都能追溯到调用方、scope、请求参数和结果。
- **NFR-005**: 删除功能必须不破坏历史内容读取和现有展示端。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 可演进性 | 每个 feature 独立 spec/plan/tasks | 避免大爆炸重构 | 每个执行 feature 有独立工作区 | 是 |
| 一致性 | MySQL 为事实源，PG/Redis/Hermes 不越界 | 防止多事实源冲突 | plan 中给出 Producer-Consumer Matrix | 是 |
| 可观测性 | 自动化任务可查、可重试、可定位失败 | 解决断更和长任务不可见问题 | 任务中心和 operation logs 验收 | 是 |
| 安全 | Agent/n8n token scope 可控 | 外部自动化会触发写入 | token scope 和审计验证 | 是 |
| 用户体验 | 首页能回答“本周能否发布” | 平铺菜单不能支撑运营决策 | UI 验收截图或手动流程 replay | 是 |

### Key Entities

- **Admin Business Source**: 当前 MySQL + Prisma 中的核心业务数据，包括 `inbox_items`、`contents`、`weekly_issues`、`weekly_content_items`、`operation_logs`。
- **Automation Token**: 给 n8n、Hermes、MCP 使用的 Bearer token，带 scope、过期、撤销和审计。
- **Job**: Redis/worker 处理的同步、评分、生成、发布、建议刷新任务。
- **Hermes Suggestion**: Hermes 对候选内容的入选、剔除、排序、分组和理由建议。
- **Smart Read Model**: Postgres/pgvector/hermes-db 中的向量、偏好、建议和 Agent 运行记录。
- **Legacy Image Fields**: 暂时保留但逐步退役的图片字段和链路。

---

## Business Metrics *(optional — 上线后度量)*

- **BM-001**: 每周人工组刊时间从当前多入口操作降低到 0.5-1 小时以内。
- **BM-002**: 连续 4 周周刊不断更，且每周驾驶舱能提前暴露内容池不足。
- **BM-003**: 自动化任务失败能在 5 分钟内被任务中心或告警发现。
- **BM-004**: 图片功能退役后相关依赖减少，构建体积和维护面下降。

---

## Out of Scope

- 本 umbrella spec 不直接实现任何代码。
- 本轮不把 Admin 主库从 MySQL 迁移到 Postgres。
- 本轮不把 Admin 改成 `nextjs-tpl` 那样的 monorepo。
- 本轮不允许 Hermes 或 n8n 直接写核心业务表作为事实源。
- 本轮不自动发布周刊，发布仍需人工确认或明确的发布 API。
- 本轮不立即 drop 图片字段。
- 本轮不重写 Astro 展示端，只定义 Admin 与展示端的兼容边界。

---

## Clarified Decisions

- **Next.js 16 build 策略**: 长期目标是 Turbopack build/dev 通过，因为 Next.js 16 默认走 Turbopack；`next build --webpack` 可以保留为短期诊断/发布回退，但不能作为最终完成标准。
- **n8n / Hermes 范围**: 本 roadmap 先确认 feature 描述和契约边界；NAS 侧 n8n workflow、Hermes skill、MCP 调用和部署改造后续进入独立 feature 再开发。
- **UI 风格**: 以 `~/personal/webs/nextjs-tpl` 为主要参考，采用其紧凑后台壳层、深色/中性色控制台基调和 surface/token 组织方式，再按周刊生产业务调整信息结构。
- **图片字段**: 图片相关字段后续会 drop；当前 roadmap 只规定退役顺序，具体 drop 放入独立迁移 feature。
- **Meilisearch 搜索策略**: NAS 已有 `karakeep-meilisearch`，但该容器当前未映射宿主端口，仅在 Karakeep Docker 网络内可用。因此 Admin 不再本地单独修 Meilisearch；短期将 Meilisearch 设为 optional backend，并在后续 feature 中评估是否通过 external Docker network 复用 NAS 实例。PG/pgvector 继续承担 Hermes 智能检索和语义召回。

---

## Stage Readiness

- 当前阶段：`closeout complete`
- 下一步建议：无新的主线 feature；后续只从 deferred follow-up 中选择独立 feature 重新 `specify`，或由用户提出新需求。
- 阻塞项：无。主线执行 feature 均已有独立验收记录；最终状态见 [acceptance.md](acceptance.md)。

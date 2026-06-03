# Tasks: Database And Search Strategy

**Workspace**: `database-and-search-strategy` | **Date**: 2026-06-03  
**Input**: `specs/database-and-search-strategy/spec.md` + `plan.md`  
**Prerequisites**: spec.md, plan.md, data-model.md

---

## 执行原则

- 先建立可测试边界，再改行为。
- 先改配置和纯服务逻辑，再改 route 与 health。
- Meilisearch optional 是端到端目标：写入、读取、health、配置、文档都要闭环。
- 不做主库迁移、不接入 PG/pgvector、不解决 NAS Docker 网络接入。

---

## Phase 1: 测试支架与现状保护

**目标**: 在修改行为前建立 focused tests，锁定当前 route/service 边界。

- [x] T001 [Setup] 确认 Vitest 对 Next route、Prisma mock、Meilisearch mock 的可用测试模式
  - scope: `src/tests/setup.ts`, existing `*.test.ts`, Vitest config
  - maps_to: Verification Strategy
  - verify: 找到可复用 mock 模式；若没有，记录本 feature 采用的 mock 方式

- [x] T002 [Setup] 为 `src/lib/search.ts` 建立 focused unit test 文件
  - scope: `src/lib/search.test.ts` 或同目录既有测试命名模式
  - maps_to: ADR-002 / ADR-003 / 可用性 / 安全
  - verify: 测试文件可被 `pnpm test` 发现；先覆盖配置默认值和危险 index 校验

- [x] T003 [Setup] 为 `/api/health` 建立 route-level focused test
  - scope: `src/app/api/health/route.test.ts` 或既有 route test 约定
  - maps_to: US1 / FR-001 / FR-002 / FR-003 / ADR-001
  - verify: 能 mock `prisma.$queryRaw`、`client.health`、startup 初始化状态

- [x] T004 [Setup] 为 `/api/search` 建立 route-level focused test
  - scope: `src/app/api/search/route.test.ts`, `src/lib/search.ts`
  - maps_to: US2 / FR-004 / FR-005
  - verify: 能 mock search service 成功、fallback、validation error 三类路径

---

## Phase 2: 搜索配置与 index 命名

**目标**: 去掉硬编码 `contents` index，建立 Admin 专用 index 和共享实例防误写规则。

- [x] T005 [US3] 新增集中搜索配置读取与校验
  - scope: `src/lib/search.ts`
  - maps_to: US3 / FR-008 / FR-009 / ADR-003 / 安全
  - verify: 单测覆盖默认 `weekly_admin_contents`、自定义 `MEILISEARCH_CONTENT_INDEX`、共享实例禁止 `contents`

- [x] T006 [US3] 将所有 Meilisearch index 调用改为使用配置后的 index name
  - scope: `setupContentIndex`, `syncContentToSearch`, `removeContentFromSearch`, `bulkSyncContentsToSearch`, `searchContents`, `getSearchSuggestions`, `getIndexStats`, `clearSearchIndex`
  - maps_to: US3-1 / FR-008 / ADR-003
  - verify: 单测或 mock 断言 `client.index()` 使用配置值，不再使用硬编码 `contents`

- [x] T007 [US3] 对 misconfigured search config 做安全降级
  - scope: `src/lib/search.ts`
  - maps_to: US3-2 / FR-009 / NFR-003 / Search Degradation State
  - verify: 共享实例 + 危险 index 时不执行 Meili 写入；读请求走 fallback 或 disabled metadata；日志不包含 secrets

---

## Phase 3: Search service 与 MySQL fallback

**目标**: 让 `/api/search` 在 Meilisearch 不可用时返回可用 fallback，而不是 503。

- [x] T008 [US2] 拆分 Meilisearch 搜索路径为内部函数
  - scope: `src/lib/search.ts`
  - maps_to: ADR-002 / ADR-003
  - verify: Meili 成功路径仍返回现有 `SearchResult` 字段；新增 `meta.mode = "meilisearch"`

- [x] T009 [US2] 实现 MySQL fallback 查询函数
  - scope: `src/lib/search.ts`, `src/lib/db`
  - maps_to: US2-2 / US2-3 / FR-004 / FR-006 / FR-007 / ADR-002 / 性能
  - verify: 单测覆盖 query OR 字段、空查询排序、limit cap、基础 filters、unsupported sort/filter metadata

- [x] T010 [US2] 实现 `searchContentsWithFallback`
  - scope: `src/lib/search.ts`
  - maps_to: US2 / FR-004 / FR-005 / NFR-004 / Search Degradation State
  - verify: mock Meili success => mode `meilisearch`；mock connection/auth/index failure => mode `fallback`；非 recoverable validation error 仍抛出

- [x] T011 [US2] 更新 `/api/search` GET 使用结构化 search service
  - scope: `src/app/api/search/route.ts`
  - maps_to: US2 / FR-004 / FR-005 / ADR-002
  - verify: Meili down 测试返回 HTTP 200、`success: true`、fallback metadata；参数错误仍 400

- [x] T012 [US2] 更新 `/api/search` POST 使用结构化 search service
  - scope: `src/app/api/search/route.ts`
  - maps_to: US2 / FR-004 / FR-005 / ADR-002
  - verify: POST fallback 行为与 GET 一致；错误状态与 GET 一致

- [x] T013 [US2] 保持 suggestions 的轻量降级行为
  - scope: `getSearchSuggestions`, `/api/search?action=suggestions`
  - maps_to: US2 / plan note
  - verify: Meili down 时 suggestions 返回空数组或成功空结果，不导致 route 500/503

---

## Phase 4: Health degraded 语义

**目标**: `/api/health` 区分关键依赖失败和 optional search 降级。

- [x] T014 [US1] 扩展 health 类型到 `healthy | degraded | unhealthy`
  - scope: `src/app/api/health/route.ts`
  - maps_to: US1 / FR-001 / ADR-001
  - verify: TypeScript 类型覆盖 `HealthStatus.status` 与 `overall`

- [x] T015 [US1] 调整 search health 失败逻辑为 degraded
  - scope: `src/app/api/health/route.ts`
  - maps_to: US1-1 / FR-002 / ADR-001 / 可用性
  - verify: Meili down + DB/startup OK => HTTP 200、`overall: degraded`、`services.search.status: degraded`

- [x] T016 [US1] 保持 MySQL/startup 关键失败为 unhealthy
  - scope: `src/app/api/health/route.ts`
  - maps_to: US1-3 / US1-4 / FR-003
  - verify: DB failure 或 startup failure => HTTP 503、`overall: unhealthy`

- [x] T017 [US1] 更新 health 日志字段表达 degraded
  - scope: `src/app/api/health/route.ts`, logger payload
  - maps_to: FR-011 / NFR-004
  - verify: 日志 status 与响应 overall 一致；错误信息不包含 secrets

---

## Phase 5: 环境文档与运维边界

**目标**: 配置项、共享实例风险和数据库职责边界在文档中可追踪。

- [x] T018 [US3] 更新 `.env.example` 的 Meilisearch 配置
  - scope: `.env.example`
  - maps_to: FR-008 / FR-009 / NFR-003
  - verify: 包含 `MEILISEARCH_CONTENT_INDEX="weekly_admin_contents"` 和共享实例说明；不包含真实 key

- [x] T019 [US3] 更新部署/NAS 文档中的 Meilisearch optional 说明
  - scope: `docs/nas-deployment.md` 或更合适的部署文档
  - maps_to: US3 / FR-014 / ADR-004
  - verify: 文档说明 Meili 不阻塞 Admin health、共享实例必须独立 index、NAS 网络接入不在本 feature 内

- [x] T020 [US4] 在 plan/spec 或项目文档中保留数据库职责边界引用
  - scope: `specs/database-and-search-strategy/plan.md`, `data-model.md`, optional docs
  - maps_to: US4 / FR-012 / FR-013 / ADR-005
  - verify: 后续 PG/pgvector、Redis、Meili 均被描述为读模型/基础设施，不是事实源

---

## Phase 6: 验证与收口

**目标**: 用 fresh evidence 证明 Component、Workflow、User-Visible Outcome 都满足 spec。

- [x] T021 [Verify] 运行 focused tests
  - scope: changed test files
  - maps_to: Evidence Gate
  - verify: `pnpm test <focused files or patterns>` 通过

- [x] T022 [Verify] 运行类型检查
  - scope: whole repo
  - maps_to: NFR-005 / architecture drift
  - verify: `pnpm type-check` 通过

- [x] T023 [Verify] 运行 lint
  - scope: whole repo or changed files according to project tooling
  - maps_to: baseline quality
  - verify: `pnpm lint` 通过或记录既有非相关失败

- [x] T024 [Verify] 手动或 automated smoke 覆盖 search degraded workflow
  - scope: `/api/search`, `/api/health`
  - maps_to: US1 / US2 / prior-closure-failure
  - verify: Meili unavailable 时 `/api/health` 非 503、`/api/search` fallback 成功

- [x] T025 [Closeout Prep] 准备 acceptance evidence
  - scope: `specs/database-and-search-strategy/acceptance.md` later
  - maps_to: Component / Workflow / User-Visible Outcome verdict
  - verify: 记录测试命令、关键响应样例、未解决残余风险

---

## 依赖与顺序

- T001-T004 是测试支架，必须先做，避免后续行为变化无保护。
- T005-T007 是配置基础，必须早于所有 Meili index 行为修改。
- T008-T010 是 search service 核心，必须早于 T011-T013 route 改造。
- T014-T017 可与 Phase 3 相对独立，但最终 smoke 必须一起验证。
- T018-T020 可在实现后并行补齐，但必须早于 verify/closeout。
- T021-T025 是最终收口，不应跳过。

关键路径：

```text
T001-T004 -> T005-T007 -> T008-T010 -> T011-T013 -> T021-T025
                         -> T014-T017 -----------^
```

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 搜索服务不可用时 Admin 仍可运行 | T003, T014, T015, T016, T017, T024 |
| US2 搜索请求有可预期的降级路径 | T004, T008, T009, T010, T011, T012, T013, T024 |
| US3 共享搜索基础设施不会污染 Karakeep | T005, T006, T007, T018, T019 |
| US4 数据库职责边界被固定 | T020, T025 |
| FR-001 ~ FR-003 health 语义 | T014, T015, T016 |
| FR-004 ~ FR-007 search fallback | T008, T009, T010, T011, T012 |
| FR-008 ~ FR-009 index 配置与防误写 | T005, T006, T007, T018 |
| FR-010 写入不被搜索阻塞 | T006, T007, T024 |
| FR-011 可观测性 | T010, T017, T024 |
| FR-012 ~ FR-014 数据库/运维边界 | T019, T020, T025 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 Health degraded | T014, T015, T016 | T003, T024 |
| ADR-002 Prisma contains fallback | T009, T010 | T002, T004, T021 |
| ADR-003 Meili index 命名 | T005, T006, T007 | T002, T018 |
| ADR-004 NAS Meili 复用只预留配置 | T007, T019 | T024, T025 |
| ADR-005 PG/pgvector 边界 | T020 | T025 |
| 可用性 | T010, T015 | T021, T024 |
| 一致性 | T006, T007, T020 | T024, T025 |
| 安全 | T005, T007, T018 | T002, T023 |
| 性能 | T009 | T002, T021 |
| 可观测性 | T010, T017 | T024, T025 |

---

## Notes

- 本任务清单不包含 PG/pgvector、Redis 或 NAS Docker network 接入实现。
- 如果实现阶段发现 Prisma `contains` 在 MySQL provider 上不支持当前字段组合，应回到 plan 调整 fallback 查询策略，不能临时改成无界 raw SQL。
- 如果 `/api/search` 现有 UI 消费方不能接受新增 metadata，保持 metadata 可选并不破坏旧字段。
- 如果现有测试框架不适合 route-level tests，可以用 service-level tests 加最小 route smoke 替代，但必须保留 Evidence Gate。

---

## Stage Readiness

- 推荐下一步：`execute-plan`
- 阻塞项：无。任务数量较多且跨 search/health/docs/tests，建议先进入 `execute-plan` 控制节奏，再实现。

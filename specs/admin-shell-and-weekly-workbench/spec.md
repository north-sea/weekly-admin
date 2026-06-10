# Feature Specification: Admin Shell and Weekly Workbench

**Workspace**: `admin-shell-and-weekly-workbench`
**Created**: 2026-06-06
**Status**: Draft
**Input**: 用户描述: "$sdd specify admin-shell-and-weekly-workbench,似乎要重新 spec 了"

> 写入本文件后，应同步更新 `specs/.active` 指向当前 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 工作台覆盖采集、筛选、组刊、建议确认、发布检查、发布/复盘状态等多阶段周刊生产线。 |
| `external-side-effects` | ✅ | 发布动作可能触发 Quail 发布/投递；同步、评分、建议、apply 等操作会写入业务数据或 automation run 记录。 |
| `artifact-handoff` | ✅ | scoring/search/automation contracts 产出的候选、建议、运行记录和发布结果会被 Admin UI 消费，人工确认后写回周刊。 |
| `user-visible-output` | ✅ | 交付目标是后台壳层、首页驾驶舱和周刊工作台等用户可见 UI。 |
| `prior-closure-failure` | ✅ | roadmap 记录过内容池不足、端到端闭环未通、旧图片 surface 和 legacy weekly 操作噪音，需要在本 feature 中避免再次只完成组件不完成生产闭环。 |

**结论**: 下游 `plan` 必须启用 Producer-Consumer Matrix；`verify` 必须提供 Evidence Gate；`closeout` 必须做 Workflow Replay，并给出 Component / Workflow / User-Visible Outcome 三维 Verdict。

---

## Context

`admin-modernization-roadmap` 的最新结论是：`image-feature-retirement` 已完成，下一步是重写 `admin-shell-and-weekly-workbench`。新规格必须按“无图片周刊生产驾驶舱”推进，不能继续围绕封面、主图、裁剪或 AI 图片生成设计。

当前系统已经具备若干可消费基础：

- `src/components/layout/AppSidebar.tsx` 和 `src/components/layout/MenuConfig.tsx` 提供现有后台壳层与导航。
- `src/app/(dashboard)/dashboard/page.tsx` 当前是通用统计仪表板，尚未表达本周生产状态。
- `src/app/(dashboard)/weekly/page.tsx` 当前承载周刊列表和若干旧自动化按钮，包括 `auto-create`、`auto-link`、`backfill`。
- `src/app/(dashboard)/weekly/editor/[id]/page.tsx` 与 `src/components/weekly/WeeklyEditor.tsx` 当前是传统编辑页，依赖 `/api/weekly/*` 获取可选内容、已选内容和预览。
- `/api/v1/weekly/candidates`、`/api/v1/weekly/suggestions`、`/api/v1/weekly/suggestions/{id}/apply`、`/api/v1/weekly/publish`、`/api/v1/jobs/sync`、`/api/v1/jobs/score` 和 `automation_runs` 已作为自动化契约存在。
- `/api/search` 已支持 fallback 搜索，不应让 Meilisearch 可用性阻塞工作台核心路径。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 作为周刊维护者，我能从首页判断本周生产是否卡住 (Priority: P1)

作为周刊维护者，我希望登录后第一屏看到本周周刊的生产状态，以便优先处理候选不足、待评分、待晋升、待组刊、待发布或失败任务，而不是先阅读通用统计报表。

**Why this priority**: 周刊断更和闭环失败的核心风险不是缺少统计，而是维护者无法快速判断本周生产线的下一步动作。

**Acceptance Scenarios**:

1. **[US1-1] 本周状态总览**
   **Given** 我进入 Admin 首页
   **When** 系统存在本周或最近一期周刊
   **Then** 首页必须展示该期的期号、日期范围、状态、候选数量、已选数量、完整度、发布状态和最近失败/运行中的自动化任务

2. **[US1-2] 下一步动作**
   **Given** 本周周刊存在候选不足、未评分、未应用建议或未发布等状态
   **When** 我查看首页
   **Then** 页面必须给出一个明确的主要下一步入口，并能跳转到对应工作台区域或触发对应确认流程

3. **[US1-3] 空状态**
   **Given** 当前没有本周周刊
   **When** 我进入首页
   **Then** 页面必须提供创建本周周刊的入口，并说明创建后进入工作台继续处理

**Edge Cases**:

- **[US1-4]** 自动化状态接口不可用时，首页仍能展示周刊基础信息，并把任务状态标为暂不可用，而不是整页失败。
- **[US1-5]** 搜索后端降级时，首页不得依赖 Meilisearch 健康状态决定是否可用。

### User Story 2 - 作为维护者，我能按生产线理解后台导航 (Priority: P1)

作为周刊维护者，我希望后台导航按“采集、筛选、组刊、发布、复盘、设置”组织，以便按生产流程进入功能，而不是在资源类型菜单中猜入口。

**Why this priority**: 新工作台要降低入口噪音；导航语义必须服务周刊生产，而不是继续保留功能堆叠后台的心智负担。

**Acceptance Scenarios**:

1. **[US2-1] 生产线导航**
   **Given** 我打开任意后台页面
   **When** 查看侧边栏或主导航
   **Then** 主要入口必须按周刊生产线组织，并能覆盖收件箱/数据源、筛选评分、周刊工作台、发布、复盘和设置

2. **[US2-2] 当前状态感知**
   **Given** 我处于周刊工作台、收件箱、发布或复盘页面
   **When** 查看导航
   **Then** 当前阶段必须有清晰 active 状态，且移动端/窄屏下仍可访问完整导航

3. **[US2-3] Legacy 入口降噪**
   **Given** 旧页面仍存在
   **When** 它们不是本阶段主流程入口
   **Then** 导航不得把旧图片、截图、封面、AI 图片或过时自动化入口作为主入口呈现

**Edge Cases**:

- **[US2-4]** 若某旧页面因兼容仍保留，必须通过次级入口或详情页访问，不能抢占主生产线导航。

### User Story 3 - 作为编辑者，我能在一个工作台完成候选筛选、建议确认和编排 (Priority: P1)

作为周刊编辑者，我希望周刊编辑页成为主工作台，集中呈现候选池、AI/automation 建议、已选编排、完整度和真实预览，以便不用在周刊列表、内容库、旧编辑器和发布页之间来回切换。

**Why this priority**: 这是本 feature 的核心用户价值；只有工作台能消费已完成的 scoring/search/contracts 并形成真正人工确认面。

**Acceptance Scenarios**:

1. **[US3-1] 候选池**
   **Given** 本周已有 ready/published 候选内容
   **When** 我打开周刊工作台
   **Then** 候选池必须展示标题、摘要、来源、链接、评分信号、创建时间和是否已入刊，并支持搜索/筛选/刷新

2. **[US3-2] 建议预览**
   **Given** `/api/v1/weekly/suggestions` 返回建议
   **When** 我请求生成或刷新建议
   **Then** 工作台必须以预览方式展示建议分组、推荐条目、理由和影响范围，不能在用户确认前直接写入周刊

3. **[US3-3] 应用建议**
   **Given** 我确认一组建议
   **When** 执行应用操作
   **Then** 系统必须展示将新增/跳过/替换的内容数量，并在成功后刷新已选编排、完整度和运行状态

4. **[US3-4] 手动编排**
   **Given** 候选池中有可用内容
   **When** 我手动添加、移除、重排、设置 section 或 featured 状态
   **Then** 已选编排和预览必须保持一致，保存失败时必须给出可恢复错误

5. **[US3-5] 无图片预览**
   **Given** 内容或历史字段仍可能包含 `image_url`、`cover`、`favicon_url`
   **When** 工作台展示候选、已选或预览
   **Then** 主 UI 不得渲染封面/主图/裁剪入口；允许保留来源 favicon 的技术读取但不得作为周刊生产要素

**Edge Cases**:

- **[US3-6]** 候选为空时，工作台必须指向采集/评分下一步，而不是只显示空列表。
- **[US3-7]** 建议接口失败时，手动编排仍可继续。
- **[US3-8]** 内容已被其他周刊关联时，工作台必须展示冲突原因并阻止重复入刊。

### User Story 4 - 作为发布负责人，我能在发布前完成检查并看到外部副作用 (Priority: P1)

作为发布负责人，我希望在工作台中看到发布检查清单和发布结果，以便确认标题、描述、内容数量、预览和 Quail 状态都满足条件后再触发外部发布。

**Why this priority**: 发布是外部副作用；本 feature 不能只提供“发布”按钮，必须让用户看到风险和证据。

**Acceptance Scenarios**:

1. **[US4-1] 发布检查清单**
   **Given** 周刊处于草稿状态
   **When** 我查看发布区域
   **Then** 系统必须展示标题、日期范围、内容数量、完整度、预览状态、Quail 发布状态和未解决错误

2. **[US4-2] 发布确认**
   **Given** 发布检查清单通过
   **When** 我点击发布
   **Then** 系统必须要求确认，并明确说明会通过可追踪发布契约触发 Quail 外部发布/投递

3. **[US4-3] 发布结果**
   **Given** 发布请求成功或失败
   **When** 操作结束
   **Then** 页面必须展示 run id、状态、外部引用（如 Quail slug/post id，如有）、错误原因和重试/查看日志入口

**Edge Cases**:

- **[US4-4]** 已发布周刊再次发布时，必须展示 force republish 语义或禁止重复发布。
- **[US4-5]** Quail 失败时不得把页面误标为完全成功。

### User Story 5 - 作为维护者，我能追踪自动化运行和失败原因 (Priority: P2)

作为维护者，我希望在首页和工作台看到同步、评分、建议、应用和发布的最近运行状态，以便定位哪一步失败，而不是只在操作日志中翻表格。

**Why this priority**: `automation_runs` 已存在，但当前用户可见面不足；工作台需要把运行证据转成可操作状态。

**Acceptance Scenarios**:

1. **[US5-1] 最近运行状态**
   **Given** 存在 sync、score、weekly candidates/suggest/apply/publish 运行记录
   **When** 我查看首页或工作台
   **Then** 页面必须展示最近运行的 workflow、step、status、started/finished 时间、错误摘要和目标对象

2. **[US5-2] 失败恢复**
   **Given** 最近运行失败或 partial_success
   **When** 我查看状态
   **Then** 页面必须提供查看详情或重试入口，并以 `automation_runs` 作为运行状态事实源

3. **[US5-3] 运行中状态**
   **Given** 有运行中任务
   **When** 我刷新页面
   **Then** UI 必须展示运行中状态，不得误显示为成功或空状态

**Edge Cases**:

- **[US5-4]** 如果运行记录被清理或不存在，页面必须显示“暂无运行记录”，而不是报错。

### User Story 6 - 作为移动端或小屏用户，我能完成核心检查和轻量处理 (Priority: P2)

作为维护者，我希望在窄屏设备上仍能查看本周状态、确认建议和发布检查，以便临时处理周刊生产状态。

**Why this priority**: 工作台主场景是桌面，但状态判断和确认操作不能在移动端完全不可用。

**Acceptance Scenarios**:

1. **[US6-1] 响应式工作台**
   **Given** 我使用移动端或窄屏
   **When** 打开首页和周刊工作台
   **Then** 页面必须降级为可滚动、无重叠的单列/分段布局，核心状态和主操作可访问

2. **[US6-2] 文本不溢出**
   **Given** 标题、来源、错误信息或按钮文案较长
   **When** 在移动端查看
   **Then** 文本不得遮挡其他控件或溢出容器

**Edge Cases**:

- **[US6-3]** 拖拽或复杂编排如不适合移动端，必须提供上移/下移或其他非拖拽替代方式。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须将 Admin 首页从通用统计仪表板改为本周周刊生产驾驶舱，突出周刊状态、候选/已选数量、完整度、发布状态和失败任务。
- **FR-002**: 系统必须将主导航重组为周刊生产线语义：采集、筛选、组刊、发布、复盘、设置；具体命名可在 plan 阶段按现有路由约束微调。
- **FR-003**: 系统必须提供一个周刊主工作台，集中呈现候选池、已选编排、建议预览、真实预览、完整度和发布检查清单。
- **FR-004**: 工作台必须消费已存在的 scoring/search/automation contract 输出；不得重新定义一套绕过 Admin API 的业务事实源。
- **FR-005**: 候选池必须展示评分信号，至少包括 `original_score`、`summary_score` 或综合 score；若某项没有评分，必须有明确的未评分状态。
- **FR-006**: 工作台必须支持手动添加、移除、重排、设置 section 和 featured，并保证保存后预览与已选编排一致。
- **FR-007**: 工作台必须支持建议生成/刷新和建议应用的人工确认面；建议在确认前不得自动写入周刊。
- **FR-008**: 发布区域必须提供发布检查清单，并在触发外部副作用前展示确认；发布动作必须使用可追踪的 automation publish 语义，而不是旧的 fire-and-forget 状态更新。
- **FR-009**: 首页和工作台必须展示自动化最近运行状态或明确的不可用/暂无记录状态；运行状态以既有 `automation_runs` 为事实源。
- **FR-010**: UI 必须完全去图片化：不得新增或恢复封面、主图、截图、裁剪、AI 图片生成入口。
- **FR-011**: 旧周刊列表中高噪音自动化按钮必须降噪；本周生产相关动作应迁移到驾驶舱或工作台上下文中。
- **FR-012**: 搜索必须允许 fallback；Meilisearch 不可用时，核心候选筛选和工作台浏览不能整页失败。
- **FR-013**: 错误状态必须可操作：候选加载失败、建议失败、应用失败、保存失败、发布失败分别给出明确原因和下一步。
- **FR-014**: 工作台必须适配桌面和移动端，避免文本、按钮、列表和预览互相遮挡。
- **FR-015**: 本 feature 不得新增 schema change；允许新增 cookie-authenticated UI 读取/操作 API 来消费既有服务和 `automation_runs`，但如 plan 发现必须新增状态字段，必须先显式回到 plan 并判断是否拆到 `redis-job-orchestration` 或独立 feature。

### Non-Functional Requirements

- **NFR-001**: 首页首屏应优先加载本周关键状态；非关键统计、历史列表和日志详情可延后加载。
- **NFR-002**: 工作台交互必须避免大面积 layout shift；候选池、已选编排、预览和检查区应有稳定尺寸或响应式约束。
- **NFR-003**: 外部副作用操作必须可追踪，用户可见结果至少包含状态、错误摘要和可定位 run/log 的引用。
- **NFR-004**: UI 语言应偏操作台和生产状态，不使用营销型首页、装饰性 hero 或无关说明文案。
- **NFR-005**: 关键路径必须有测试覆盖，至少覆盖 dashboard/workbench 状态渲染、建议确认流程、发布检查门禁和无图片 UI 回归。

### Quality Attributes *(architecture-relevant)*

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 可用性 | 维护者一屏判断本周下一步 | 解决断更和闭环失败风险 | 首页/工作台截图或 E2E 证明关键状态可见 | 是 |
| 一致性 | UI 状态与 API/DB 事实一致 | 避免建议/发布误操作 | 保存、apply、publish 后刷新结果一致 | 是 |
| 可追踪性 | 自动化操作可定位 run/log | 外部副作用需要证据 | run id/log 状态在 UI 可见 | 是 |
| 可演进性 | 工作台消费契约，不绕过事实源 | 后续 Redis/Hermes 要接同一边界 | Producer-Consumer Matrix 覆盖 | 是 |
| 响应式 | 桌面高效，移动端核心可用 | 临时处理场景需要小屏可查 | Playwright 或截图验证无重叠 | 否 |

### Key Entities *(if applicable)*

- **Weekly Issue**: 周刊期号，包含标题、描述、日期范围、状态、总内容数、字数、阅读时间、Quail 发布状态。
- **Weekly Candidate**: 可入刊内容，来自 `contents` 和 `/api/v1/weekly/candidates`，包含标题、摘要、来源、评分、创建时间和入刊状态。
- **Weekly Suggestion**: AI/automation 产出的建议分组和条目，必须经用户确认后应用。
- **Weekly Content Item**: 已选入周刊的内容项，包含排序、section、featured。
- **Automation Run**: 自动化运行证据，包含 workflow、step、status、target、idempotency key、错误和结果摘要。
- **Search Result**: 工作台搜索/筛选候选的结果，允许 Meilisearch 或 MySQL fallback。

---

## Clarification Decisions

### CD-001: Browser UI API Boundary

**Decision**: 浏览器端工作台不得直接调用 `/api/v1/*` automation Bearer contract。用户态 UI 必须走 cookie-authenticated Admin UI API 或页面内服务调用边界，再复用现有 service/automation 语义。

**Reason**: `/api/v1/*` 是为 n8n、Hermes、MCP 等外部自动化调用者设计的 Bearer token 契约。把 automation token 暴露到浏览器会破坏 token 边界，也会把 human session 和 automation caller 语义混在一起。

**Plan Impact**: `plan.md` 需要定义 UI wrapper 的 API 面，例如候选、建议、apply、publish、runs 读取，或明确复用现有 cookie-auth `/api/weekly/*` 的地方。

### CD-002: Automation Run Status Source

**Decision**: 首页和工作台的运行状态以既有 `automation_runs` 表为事实源；`operation_logs` 只作为审计/历史辅助，不作为 automation 状态主来源。

**Reason**: 现有 `runAutomationRoute` 写入 `automation_runs`。`operation_logs` 镜像不是所有 automation route 的默认行为，无法可靠表示 running、failed、partial_success 和 idempotent replay。

**Plan Impact**: 本 feature 允许新增只读 cookie-auth UI API 读取 `automation_runs`，不需要 schema change；状态查询、筛选和展示范围需在 plan 中限定。

### CD-003: Publish Semantics

**Decision**: 工作台发布必须使用可追踪的 automation publish 语义，最终触发 Quail 发布/投递时应产生 run id、status、externalRef 和错误摘要。旧 `/api/weekly/[id]` 的 status 更新 + 异步 Quail fire-and-forget 不再作为新工作台主发布路径。

**Reason**: 发布是外部副作用；旧路径无法在 UI 中可靠展示 Quail 结果、失败原因和重试证据。

**Plan Impact**: `plan.md` 需要定义 human UI 如何调用 publish wrapper、如何生成 idempotency key、如何处理 already published / force republish / deliver 选项。

### CD-004: Completeness Threshold

**Decision**: 本阶段沿用当前 `CompletenessIndicator` 的 10-15 篇阈值：少于 10 篇视为不足，10-15 篇视为可发布区间，超过 15 篇提示过载或需要裁剪。

**Reason**: 现有 UI 已使用 10/15，且本 feature 目标是重塑工作台，不扩大到周刊策略配置。

**Plan Impact**: 若后续需要配置化阈值，应拆到设置或周刊策略 feature；本阶段只把阈值作为 UI/checklist 规则。

### CD-005: Legacy Weekly Automation Entrypoints

**Decision**: 旧 `/weekly/generate`、`/api/weekly/auto-link`、`/api/weekly/backfill` 不作为新主流程入口。建议生成和本周关联能力迁入工作台上下文；历史回填保留为周刊列表或工具区的次级/谨慎操作。

**Reason**: 旧入口是造成周刊列表高噪音的主要来源，也不完全匹配已完成的 `/api/v1` automation contract。

**Plan Impact**: `plan.md` 需要列出哪些按钮迁移、隐藏、保留为次级工具，以及如何避免破坏历史回填能力。

---

## Out of Scope *(if applicable)*

- 不恢复或新增任何图片相关生产能力，包括封面、主图、截图、裁剪、AI 图片生成和图片上传。
- 不在本 feature 中 drop legacy image 字段；字段 drop 属于后续 migration feature。
- 不新增 Redis job/lock/status 编排；该能力属于 `redis-job-orchestration`。
- 不接入 Hermes 记忆、pgvector 召回或 Hermes skill；该能力属于 `hermes-weekly-intelligence`。
- 不重写 automation token、scope、OpenAPI 或 idempotency 契约；本 feature 只消费既有契约。
- 不把 Admin 事实源迁出 MySQL/Prisma。
- 不做营销型首页、模板展示页或与周刊生产无关的视觉重设计。
- 不处理 deferred `security-and-runtime-hardening`，包括 token 管理 UI、secret rotation、审计面板等。

---

## Known Risks *(if applicable)*

- 新增 UI wrapper 可能与既有 `/api/weekly/*` legacy route 有重叠；plan 阶段必须明确哪些保留、哪些替换，避免双入口语义漂移。
- 发布路径切到可追踪 automation 语义后，需要处理 human session 与 automation caller 元数据的映射；不能泄露 automation token 到浏览器。
- 若 `automation_runs` 查询范围过宽，首页可能变慢；plan 阶段必须限制最近运行数量、workflow/target 筛选和加载优先级。
- 历史回填仍是高风险批量操作；本 feature 只降噪入口，不改变其业务规则。

---

## Stage Readiness

- 下一步建议：`plan`
- 阻塞项（如有）：无。Bearer/UI API 边界、automation_runs 展示来源、发布外部副作用范围、完整度阈值和 legacy 入口处理已在 Clarification Decisions 中固定。

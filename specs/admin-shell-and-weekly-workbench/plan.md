# Implementation Plan: Admin Shell and Weekly Workbench

**Workspace**: `admin-shell-and-weekly-workbench` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/admin-shell-and-weekly-workbench/spec.md`

---

## Summary

本计划把 Admin 从资源型后台改成无图片周刊生产驾驶舱。推荐方案是保留现有 Next.js App Router 单体结构，新增 cookie-authenticated UI/BFF wrapper 来消费既有 weekly、scoring、search、automation 服务和 `automation_runs`，不暴露 automation token 到浏览器，不新增 schema。

候选方案讨论已跳过：`clarify` 阶段已经固定关键边界，当前只有一个合理方向，即 UI wrapper + 既有服务复用；直接调用 `/api/v1/*` Bearer contract 或重建状态模型都与 spec 冲突。

---

## Architecture Overview

本 feature 是成长期的单体内 BFF/workbench 改造，不引入 Redis、Hermes 或新存储。核心目标是把已存在的产物串成用户可见闭环。

```text
Browser UI
  |
  | cookie auth
  v
Next.js App Router pages
  |-- /dashboard                    本周生产驾驶舱
  |-- /weekly                       周刊列表 + 次级历史工具
  |-- /weekly/editor/[id]           周刊主工作台
  |
  v
Cookie-auth UI API wrappers
  |-- dashboard summary             weekly issue + candidates + selected + runs
  |-- workbench candidates          wraps getWeeklyCandidates / search fallback
  |-- workbench suggest             wraps organizeWeekly
  |-- workbench apply               wraps applyWeeklySuggestion
  |-- workbench publish             wraps quailService.publishWeekly with run tracking
  |-- automation runs read          reads automation_runs
  |
  v
Existing domain services and DB
  |-- MySQL/Prisma: weekly_issues, contents, weekly_content_items, automation_runs
  |-- /api/search fallback service
  |-- Quail publish service
```

外部 automation `/api/v1/*` 继续服务 n8n/Hermes/MCP。浏览器 UI 不直接使用 automation token；UI wrapper 只复用相同服务、校验和运行记录语义。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| Backend for Frontend / UI API wrapper | https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/backend-for-frontend.mdx | 用 Route Handler 作为浏览器 UI 的 server-side API 边界，聚合服务、隐藏 token、输出页面需要的数据形状 | 不拆成独立服务，不引入微服务网关 | 成长期 |
| Next.js App Router Route Handlers | https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/03-file-conventions/route.mdx | 支持 GET/POST/PUT 等 HTTP 方法，`NextRequest` 可访问 URL、cookies、headers 和 body；适合现有 `src/app/api/*/route.ts` 结构 | 不解决业务领域边界，需要本 plan 限定 wrapper 职责 | 成长期 |
| Human-in-the-loop workflow | UNVERIFIED | 候选、建议、应用、发布都通过人工确认面闭环 | 不做全自动 agent 发布，不接 Hermes 记忆 | 成长期 |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| Karakeep/RSS/manual sync | `inbox_items` / promoted `contents` | Dashboard summary / weekly workbench candidates | 首页候选数量变化；工作台候选池展示 ready/published weekly contents |
| AI scoring | `contents.original_score`, `contents.summary_score`, `inbox_items.ai_score` | Candidate cards / sorting / completeness hints | 候选池展示评分信号；未评分内容有明确状态 |
| Search fallback service | Search result list | Candidate filter/search UI | Meilisearch 不可用时仍能按 MySQL fallback 搜索候选 |
| `getWeeklyCandidates` | Candidate DTO | Workbench candidate panel | 候选池展示 title、summary、source、score、created_at、linked state |
| `organizeWeekly` | Suggestion preview | Suggestion review panel | 用户看到建议条目、section、featured、reason；确认前不写入 |
| `applyWeeklySuggestion` | Applied/skipped result | Selected contents panel / completeness / run state | 应用后已选列表和完整度刷新；冲突/跳过原因可见 |
| Manual editor save | `weekly_content_items` order/section/featured | Preview / publish checklist | 保存后预览与已选编排一致 |
| Publish wrapper | Publish result with run id/status/externalRef | Publish checklist / recent runs | UI 展示 Quail slug/post id 或错误摘要 |
| `automation_runs` | Recent run records | Dashboard and workbench run timeline | 首页/工作台展示 workflow、step、status、target、started/finished、error |

**孤儿 artifact 处理**: 无。历史 `operation_logs` 不作为本 feature 的 automation 状态主 artifact，仅保留为审计辅助。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 可用性 | 维护者首页一屏判断下一步 | Dashboard summary 优先加载本周 issue、候选、已选、runs；非关键统计降级 | 页面截图/E2E 证明关键状态可见 |
| 一致性 | UI 与 DB/API 事实一致 | apply/save/publish 后统一刷新 issue、selected、runs；不维护客户端影子状态 | 单测 + 交互测试验证结果刷新 |
| 可追踪性 | 外部发布和自动化动作可定位 | publish/suggest/apply wrapper 产出或关联 run id/status | API 测试断言 run id/status；UI 展示 |
| 安全性 | automation token 不进浏览器 | 浏览器只用 cookie-auth wrapper；`/api/v1/*` 保持外部 token 边界 | 代码审查和测试确认无 token 注入 |
| 响应式 | 桌面高效，小屏可完成核心检查 | 工作台桌面多栏，小屏分段单列；提供非拖拽重排替代 | Playwright/screenshot 检查无重叠 |

---

## Capacity / Scale Notes

- **规模假设**: 单人或小团队维护；每周候选通常几十到数百，周刊已选约 10-15 篇，automation recent runs 查询控制在最近 20-50 条。
- **读写特征**: 首页和候选池读多写少；suggest/apply/save/publish 是低频写；发布是外部副作用。
- **失败代价**: 候选/建议慢会影响编辑效率；apply/save 错会造成入刊错误；publish 错会造成外部投递失败或重复发布；runs 不准会误导排障。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 UI wrapper 边界 | 浏览器不能暴露 automation token | A: 直接调用 `/api/v1/*`; B: cookie-auth UI wrapper; C: 重写 automation contract | 选择 B | 需要新增少量 UI API wrapper，维护双入口语义 | Next.js Route Handlers docs |
| ADR-002 runs 状态来源 | operation_logs 不能可靠表示 automation 状态 | A: 读 operation_logs; B: 读 automation_runs; C: 新表 | 选择 B | 需要新增只读查询 API，限制查询范围 | 当前代码 / UNVERIFIED |
| ADR-003 发布路径 | 旧发布 fire-and-forget 无法追踪 Quail 结果 | A: 旧 `/api/weekly/[id]`; B: wrapper 直接写 run; C: wrapper 服务端委托 `/api/v1/weekly/publish` | 选择 C | 需要服务端配置 `ADMIN_UI_AUTOMATION_TOKEN` 或 `CRON_API_TOKEN`，并要求 UI 提供 idempotency key | 当前代码 / automation contracts docs |
| ADR-004 UI 改造策略 | 现有 weekly editor 可复用部分组件但结构不适合驾驶舱 | A: 一次性全删重写; B: 分层替换页面和组件; C: 只改样式 | 选择 B | 需要明确 legacy 组件退役顺序 | UNVERIFIED |

---

## Key Design Decisions

### Decision 1: Cookie-auth UI wrapper over direct automation calls

- **背景**: `/api/v1/*` 依赖 automation Bearer token 和 scope，面向外部调用者；浏览器 UI 已有 `authMiddleware` cookie/JWT 体系。
- **选项**:
  - A: 浏览器直接调用 `/api/v1/*`，需要把 automation token 交给前端，安全边界错误。
  - B: 新增 cookie-auth UI wrapper，内部复用 service 和 automation 语义，符合现有 App Router route handler 结构。
- **结论**: 选择 B。
- **影响**: 需要新增少量 `/api/weekly/workbench/*` 或类似路径；实现时必须避免复制业务逻辑，优先调用现有 service。
- **来源**: Next.js Route Handlers official docs；`src/lib/auth-middleware.ts`；`src/lib/automation/auth.ts`。

### Decision 2: No schema changes in this feature

- **背景**: Spec 明确不新增 schema；`automation_runs`、`weekly_issues`、`weekly_content_items`、`contents` 已覆盖本阶段状态。
- **选项**:
  - A: 新增 dashboard/workbench 状态表，增加迁移和后续维护成本。
  - B: 只读/聚合既有数据。
- **结论**: 选择 B。
- **影响**: Dashboard summary 需要从多个表聚合；长期 job 状态增强留给 `redis-job-orchestration`。
- **来源**: `prisma/schema.prisma`；spec CD-002。

### Decision 3: Publish must be tracked

- **背景**: 旧 `/api/weekly/[id]` 发布会异步触发 Quail，失败不会进入用户可见结果。
- **选项**:
  - A: 保留旧路径作为主发布。
  - B: wrapper 内直接写 `automation_runs`，但当前 `automation_runs.token_id` 是必填 automation token 外键，会诱导 fake token。
  - C: wrapper 先做 human cookie auth，再在服务端用 `ADMIN_UI_AUTOMATION_TOKEN` 或 `CRON_API_TOKEN` 委托现有 `/api/v1/weekly/publish`。
- **结论**: 选择 C。
- **影响**: 浏览器不接触 automation token；发布仍产生正式 `automation_runs`。生产环境必须配置具备 `weekly:publish` scope 的 automation token。UI wrapper 必须要求 `Idempotency-Key`，不能为外部副作用生成随机 key。
- **来源**: `src/app/api/weekly/[id]/route.ts`；`src/app/api/v1/weekly/publish/route.ts`；`src/lib/automation/run.ts`；`docs/automation-contracts.md`。

### Decision 4: Workbench layout is workflow-first, not card-dashboard-first

- **背景**: 当前 dashboard 是统计卡片，weekly editor 是三栏列表；新需求是生产线工作台。
- **选项**:
  - A: 只替换颜色和标题。
  - B: 重新组织信息架构：状态栏、候选、建议、已选、预览、发布检查。
- **结论**: 选择 B。
- **影响**: 需要抽出轻量 layout primitives 和 workbench-specific components；避免嵌套卡片和图片 surface。
- **来源**: spec User Stories；UI 设计约束。

---

## Module Design

### Module: Navigation and Shell

**职责**: 把后台壳层从资源导航调整为生产线导航。

**改动概述**:

- 更新 `src/components/layout/MenuConfig.tsx` 的主入口语义和排序。
- 保留 `AppSidebar` 的折叠、active、移动端能力，不重写布局基础。
- 导航建议映射：
  - 采集：`/inbox`、`/sources`
  - 筛选：`/inbox` 或 scoring 状态入口
  - 组刊：`/weekly`、`/weekly/editor/[id]`
  - 发布：`/publish` 或工作台发布区
  - 复盘：`/analytics`、`/operation-logs`
  - 设置：`/settings/*`

**注意事项**:

- 不新增图片、封面、截图入口。
- 旧页面可以保留访问，但不作为主生产线入口。

### Module: Dashboard Summary

**职责**: 首页展示本周周刊生产状态和下一步动作。

**改动概述**:

- 替换 `src/app/(dashboard)/dashboard/page.tsx` 的通用统计主视图。
- 新增 summary UI API，例如 `GET /api/weekly/workbench/summary?weekOffset=0`。
- Summary 聚合：
  - current/latest weekly issue
  - selected count / completeness
  - candidate count
  - unscored or pending scoring hints
  - publish/quail status
  - recent automation runs

**关键接口 / 行为**:

```text
GET /api/weekly/workbench/summary
  auth: cookie/JWT
  returns:
    issue
    completeness { selected, min: 10, max: 15, state }
    candidates { total, unscored }
    publish { status, quailPostId, quailPostSlug, error }
    runs { recent[] }
    nextAction
```

**注意事项**:

- 首页不能因为 runs 或 search 失败整页失败；基础 issue 状态优先。
- `nextAction` 只表达下一步建议，不自动执行高风险动作。

### Module: Workbench UI

**职责**: 周刊编辑页成为候选、建议、编排、预览、发布检查的一体化工作台。

**改动概述**:

- 重构 `src/app/(dashboard)/weekly/editor/[id]/page.tsx` 和 `src/components/weekly/WeeklyEditor.tsx`。
- 可拆组件：
  - `WeeklyWorkbench`
  - `WorkbenchStatusBar`
  - `CandidatePanel`
  - `SuggestionPanel`
  - `SelectedIssueOutline`
  - `PublishChecklist`
  - `AutomationRunTimeline`
- 复用或改造：
  - `AvailableContentsList`
  - `SelectedContentsList`
  - `WeeklyPreview`
  - `CompletenessIndicator`

**关键接口 / 行为**:

```text
Workbench load:
  GET issue detail
  GET selected contents
  GET candidates
  GET recent runs

Suggest:
  POST suggest wrapper
  show preview only

Apply:
  POST apply wrapper
  refresh selected + completeness + runs

Manual edit:
  PUT /api/weekly/[id]/contents or wrapper
  refresh preview

Publish:
  POST publish wrapper
  show run status + externalRef/error
```

**注意事项**:

- 不恢复 drag-only 交互；移动端需要上移/下移等替代。
- 候选卡片不得渲染 image/cover；favicon 只能作为来源辅助且不参与周刊生产语义。

### Module: UI API Wrappers

**职责**: 提供浏览器可调用的 cookie-auth API，并复用现有 domain services。

**改动概述**:

建议路径可在实现阶段微调，但应集中在一个清晰命名空间，例如：

```text
src/app/api/weekly/workbench/summary/route.ts
src/app/api/weekly/workbench/candidates/route.ts
src/app/api/weekly/workbench/[id]/suggest/route.ts
src/app/api/weekly/workbench/[id]/apply/route.ts
src/app/api/weekly/workbench/[id]/publish/route.ts
src/app/api/weekly/workbench/runs/route.ts
```

**关键接口 / 行为**:

- 所有 wrapper 先执行 `authMiddleware(request)`。
- `candidates` 复用 `getWeeklyCandidates` 或 search fallback。
- `suggest` 复用 `organizeWeekly`，返回 preview。
- `apply` 复用 `applyWeeklySuggestion`。
- `publish` 服务端委托 `/api/v1/weekly/publish`，并返回 automation envelope 中的 run evidence。
- `runs` 查询 `automation_runs`，限制 workflow、target、limit。

**注意事项**:

- 不调用外部 `/api/v1/*` HTTP endpoint 来“绕一圈”；优先直接调用同一服务函数。
- Publish wrapper 不直接调用 `withAutomationRun`，避免 fake token；它通过服务端 automation token 委托现有 automation publish route。

### Module: Weekly List Legacy Tooling

**职责**: 降低旧自动化按钮噪音，保留历史回填能力。

**改动概述**:

- `/weekly` 保留周刊列表、创建入口和历史工具入口。
- `AI 组织`、本周关联等主流程动作迁入 workbench。
- 历史回填保留在“更多/工具/历史回填”区域，保留确认文案和风险提示。

**注意事项**:

- 不破坏历史回填 API。
- 主流程入口应引导用户进工作台，而不是在列表页批量执行。

---

## Data Model

不需要新增 `data-model.md`。本 feature 不新增实体、状态字段、关系或迁移；只读取和组合既有：

- `weekly_issues`
- `weekly_content_items`
- `contents`
- `automation_runs`

如果实现阶段发现必须新增字段或表，应回到 `plan` 重新评估，并优先判断是否拆到 `redis-job-orchestration`。

---

## Project Structure

```text
src/app/(dashboard)/dashboard/page.tsx
src/app/(dashboard)/weekly/page.tsx
src/app/(dashboard)/weekly/editor/[id]/page.tsx
src/components/layout/MenuConfig.tsx
src/components/weekly/
  WeeklyWorkbench.tsx
  WorkbenchStatusBar.tsx
  CandidatePanel.tsx
  SuggestionPanel.tsx
  SelectedIssueOutline.tsx
  PublishChecklist.tsx
  AutomationRunTimeline.tsx
src/app/api/weekly/workbench/
  summary/route.ts
  candidates/route.ts
  [id]/suggest/route.ts
  [id]/apply/route.ts
  [id]/publish/route.ts
  runs/route.ts
src/lib/services/
  weekly-workbench.ts
```

结构是建议，不要求完全照抄；实现阶段应优先服从现有代码边界和可测试性。

---

## Risks and Tradeoffs

- UI wrapper 与 legacy `/api/weekly/*` 可能语义重叠。实现时必须明确每条路径的消费者，避免同一动作两套不同结果。
- Human-triggered publish 依赖服务端 automation token 配置。不得把 automation token 注入浏览器；缺失时必须返回明确配置错误。
- `automation_runs` 查询可能拖慢首页。必须限制 limit、workflow、target，并允许 runs 区域独立失败。
- 工作台改造容易变成大型 UI 重写。应按壳层/summary/API/workbench/publish 分阶段落地，每步都有可见验收。
- 候选、suggest、apply、manual edit 多个来源会产生状态漂移。每次写操作后必须刷新统一事实源。
- 历史回填是高风险批量操作，本 feature 只做入口降噪，不改变业务规则。

---

## Evolution Path

- **MVP**: Cookie-auth wrapper + dashboard summary + workbench 核心闭环；不新增 DB；不接 Redis/Hermes。
- **成长期**: 当 runs 数量、任务耗时和失败恢复需求上升时，进入 `redis-job-orchestration`，把执行控制层迁入 Redis job/status。
- **成熟期**: 当人工建议确认稳定后，进入 `hermes-weekly-intelligence`，让 Hermes 通过既有 contract 产出建议，但仍由 Admin UI 人工确认。

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。本阶段不引入 Redis/Hermes/新库。
- 是否引用了外部模式但没有适配检查：否。BFF 只作为现有 App Router route handlers 的组织方式。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。新增 wrapper 和 UI 状态必须记录在本 plan；不新增持久状态。
- 是否继续保留图片 surface：否。任何封面、主图、裁剪、AI 图片入口都不属于本 feature。
- 是否只改 UI 不打通闭环：否。Producer-Consumer Matrix 要求 candidates/suggest/apply/publish/runs 都有消费证据。

---

## Verification Strategy

- **Static**:
  - `pnpm lint`
  - `pnpm type-check`
- **Unit/API**:
  - UI wrapper route tests：auth、validation、error、success。
  - service tests：summary aggregation、runs filtering、publish wrapper result。
  - no-image regression：候选/预览/工作台不渲染 legacy image production controls。
- **Component/UI**:
  - Dashboard summary renders issue/candidates/runs/nextAction.
  - Workbench renders candidate/suggestion/selected/preview/checklist.
  - Suggest preview does not write until apply.
  - Apply/save refreshes selected list and completeness.
  - Publish checklist blocks unsafe publish and displays run evidence.
- **Workflow Replay**:
  1. 创建或定位本周周刊。
  2. 查看首页 summary 和下一步动作。
  3. 进入工作台，加载候选。
  4. 生成建议，确认前不写入。
  5. 应用建议，刷新已选和完整度。
  6. 手动调整 section/featured/order。
  7. 预览无图片。
  8. 发布检查通过后触发发布，看到 run id/status/externalRef 或错误。
- **Responsive Evidence**:
  - 桌面和移动端截图/Playwright 检查无文本重叠、按钮溢出或不可达核心操作。

---

## Stage Readiness

- 是否需要 `data-model.md`：不需要。没有新增实体、状态字段、关系或存储变化。
- 下一步建议：`tasks`
- 阻塞项（如有）：无。方案已固定 UI wrapper、automation_runs、publish tracking、legacy 入口和验证路径。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 本文件 |
| data-model.md | 不需要 | 无 schema / entity / relationship 变化 |
| tasks.md | 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | 后续阶段生成 | 用于最终验收结论 |

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| Route Handlers / BFF wrapper | https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/03-file-conventions/route.mdx | Next.js 16.1.6 official docs via Context7 |
| Backend for Frontend guide | https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/backend-for-frontend.mdx | Next.js official docs via Context7 |
| UI wrapper over automation Bearer | UNVERIFIED | 基于当前代码边界和安全推断 |
| Human-in-the-loop workflow | UNVERIFIED | 产品流程参考，不作为外部规范 |

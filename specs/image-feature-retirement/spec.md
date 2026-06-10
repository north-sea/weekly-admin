# Feature Specification: Image Feature Retirement

**Workspace**: `image-feature-retirement`
**Created**: 2026-06-06
**Status**: Draft
**Input**: 用户描述: "`$sdd specify image-feature-retirement`"

> 写入本文件后，应同步更新 `specs/.active` 指向当前 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 需要先退役 Admin UI/API/写入路径，再确认下游展示端读取点，最后才进入字段 drop 或迁移 feature。 |
| `external-side-effects` | ✅ | 当前图片上传会写入外部图床或开发环境 `public/uploads`，AI 图片会调用外部模型 API；退役目标是停止这些副作用入口。 |
| `artifact-handoff` | ✅ | `contents.image_url`、`weekly_issues.cover`、`inbox_items.image_url` 等字段是同步、编辑、预览、发布和展示之间交接的 legacy artifact。 |
| `user-visible-output` | ✅ | 周刊编辑器、内容编辑器、inbox、周刊预览、内容列表和发布内容中的图片入口/渲染均会被用户直接感知。 |
| `prior-closure-failure` | ✅ | 上游路线图明确记录图片退役需在新 workbench 前完成，且 Next 16 baseline 特意排除图片删除，说明存在跨 feature 闭环风险。 |

**结论**: 下游阶段必须启用 Producer-Consumer Matrix、Evidence Gate、Workflow Replay 和三维 Verdict。Plan 阶段需要列出每个 legacy 图片 producer/consumer；Verify/Closeout 阶段需要提供 UI、API、构建依赖和发布输出层面的证据。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 退役 Admin 图片入口与写入路径 (Priority: P1)

作为周刊后台编辑者，我希望周刊和内容生产流程不再暴露上传、裁剪、AI 生成或手动维护图片的入口，以便新的后台工作台建立在无图片的产品模型上。

**Why this priority**: 上游 `admin-modernization-roadmap` 已将本 feature 放在 `admin-shell-and-weekly-workbench` 之前；若图片入口继续存在，新工作台会继承 legacy UI 噪音和外部副作用。

**Acceptance Scenarios**:

1. **US1-1 周刊编辑不再维护封面**
   **Given** 编辑者打开周刊编辑页面
   **When** 创建、编辑、预览或保存周刊
   **Then** 页面不提供封面上传、封面 AI 生成、封面 URL 输入或封面预览作为核心流程的一部分

2. **US1-2 内容编辑不再上传主图**
   **Given** 编辑者创建或编辑内容
   **When** 使用内容表单、截图粘贴区域或结构化预览相关流程
   **Then** 系统不再提供图片上传/裁剪入口，也不会因为缺少主图阻断保存

3. **US1-3 Inbox 不再裁剪图片**
   **Given** inbox item 包含历史 `image_url` 或 `image_status`
   **When** 用户在 inbox 列表中处理、展开或 promote 该 item
   **Then** 图片裁剪入口不可见，promote 流程不再写入新的图片字段

**Edge Cases**:

- **US1-4** 历史记录中已有图片 URL 时，Admin 可以继续加载列表和详情，不因字段存在或图片远端失效而报错。
- **US1-5** 用户访问已退役图片 API 时，系统必须返回明确的退役/不可用响应或 404，不应继续执行外部上传、AI 图片生成或本地文件写入。
- **US1-6** 开发环境中已有 `public/uploads` 文件时，本 feature 不负责删除历史文件，但不得再通过 Admin 常规路径写入新文件。

### User Story 2 - 保持无图片周刊发布结果稳定 (Priority: P1)

作为发布者，我希望图片退役后周刊仍能组织、预览和发布，以便图片清理不会破坏当前周刊生产主流程。

**Why this priority**: 周刊生产和发布仍是核心业务路径；图片退役必须降低复杂度，而不是引入发布回归。

**Acceptance Scenarios**:

1. **US2-1 周刊预览无图片依赖**
   **Given** 周刊包含若干内容条目，其中部分内容历史上有 `image_url`
   **When** 打开周刊预览或分享页
   **Then** 预览以文本、标题、摘要、分类、标签和链接为核心，不渲染内容主图或封面图片

2. **US2-2 发布内容不再注入图片 Markdown**
   **Given** 周刊发布到 Quail 或同类发布出口
   **When** 生成发布 payload
   **Then** 发布正文不再因为 `content.image_url` 自动插入 `![title](image_url)` 片段，且不得把图片 URL 作为 `cover_image` 传入发布出口

3. **US2-3 API 合约兼容现有无图调用**
   **Given** 现有自动化和 UI 调用周刊/内容 API
   **When** 请求体不包含 `cover`、`image_url` 或图片相关字段
   **Then** API 正常处理；图片字段不再是必填或隐性成功条件

**Edge Cases**:

- **US2-4** 下游 Astro 展示端 `/Users/yqg/personal/weekly/weekly` 目前使用默认 cover 模板；`weekly.cover` 即使被代码读取，也不是图片 URL 视觉依赖。因此 Admin 侧可以退役图片 cover 语义；字段 drop 前只需清掉展示端对该列的技术读取。
- **US2-5** 若历史周刊仍在外部渠道展示旧图片，本 feature 不负责回写或清理外部已发布内容。

### User Story 3 - 标记并隔离 legacy 图片字段 (Priority: P2)

作为维护者，我希望图片字段从活跃业务模型中退役，并为后续数据库删除留下清晰边界，以便未来 schema 迁移可以安全执行。

**Why this priority**: `contents.image_url`、`weekly_issues.cover`、`inbox_items.image_url` 等字段仍存在于 Prisma schema 和多处类型/API 中；直接 drop 风险高，但继续作为活跃字段会拖累后续功能。

**Acceptance Scenarios**:

1. **US3-1 活跃写入路径清零**
   **Given** 用户通过 Admin 同步、编辑、promote、周刊保存或发布流程产生新数据
   **When** 图片退役 feature 完成后运行这些流程
   **Then** 系统不再新增或更新 legacy 图片字段，除非为历史兼容进行只读透传且在代码中标记为 legacy

2. **US3-2 字段删除后置**
   **Given** Prisma schema 仍包含 legacy 图片字段
   **When** 本 feature 进入实现计划
   **Then** 字段 drop 必须后置到读取点清零、数据快照/备份、迁移脚本和回滚说明明确之后；不得新增 `database/*.sql` 作为 schema 变更入口

3. **US3-3 依赖退役可验证**
   **Given** `browser-image-compression`、`react-image-crop`、`sharp` 当前仍在依赖列表中
   **When** 所有相关引用都移除或确认无其他用途
   **Then** 对应依赖应从 package manifest 和 lockfile 中移除，或在 plan 中记录保留原因

**Edge Cases**:

- **US3-4** `favicon_url` 属于来源标识而非内容主图；本 feature 不主动移除 favicon 展示或采集，但 plan 需要避免把它列入图片副作用清理。
- **US3-5** RSS/Karakeep 同步仍可能提供 image metadata；退役后系统应忽略或只读保留这些字段，不应让同步失败。
- **US3-6** AI 配置中 `image_model` 和 `weekly_cover` prompt 目前只服务图片生成/封面配置面；本 feature 应从用户可见配置与 `/api/ai/config` 响应中退役其活跃用途，但数据库字段与 prompt seed 可暂留到字段迁移阶段统一处理。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须从 Admin 常规用户路径中移除或停用周刊封面、内容主图、截图粘贴上传、inbox 图片裁剪和 AI 图片生成入口。
- **FR-002**: 系统必须停止 `/api/upload/image`、`/api/ai/image`、`/api/inbox/[id]/crop-image` 等图片副作用 API 的实际上传、生成、裁剪或本地写入行为。
- **FR-003**: 系统必须保证周刊组织、预览、分享和发布在没有图片字段的情况下仍能成功完成。
- **FR-004**: 系统必须停止新数据写入 legacy 图片字段，包括但不限于 `contents.image_url`、`contents.image_source`、`contents.image_width`、`contents.image_height`、`inbox_items.image_url` 和 `inbox_items.image_status`。
- **FR-004A**: `weekly_issues.cover` 必须从图片 URL 语义中退役；展示端已使用默认 cover 模板，不应再把该字段视为图片视觉依赖。若要 drop 字段，必须先清掉 Admin 与 Astro 对该列的技术读取。
- **FR-005**: 系统必须将历史图片字段视为 legacy，只允许为了兼容旧数据进行只读处理，且不得让这些字段影响新流程的完成条件。
- **FR-006**: 系统必须移除已经无引用的图片专用组件、服务和依赖，或在后续 plan 中记录明确保留原因。
- **FR-007**: 若执行数据库字段删除，系统必须使用 Prisma Migrate 生成 `prisma/migrations/` 迁移，并提供数据快照/备份与回滚说明。
- **FR-008**: 系统必须更新健康检查、配置校验或运行时配置中对 `IMAGE_UPLOAD_URL` / `IMAGE_UPLOAD_TOKEN` 的暴露与提示，避免退役功能继续显示为需要配置的能力。
- **FR-009**: 系统必须保留非图片核心媒体/内容能力，例如 Markdown 文本、链接、分类、标签、摘要、评分和发布元数据。

### Non-Functional Requirements *(if applicable)*

- **NFR-001**: 退役后 `pnpm lint`、`pnpm type-check`、`pnpm test` 和 `pnpm build` 必须通过。
- **NFR-002**: 退役后的 Admin 页面不得因为历史图片 URL 失效产生阻塞式错误；最多允许非阻塞兼容展示或完全忽略。
- **NFR-003**: 退役必须减少外部副作用面；常规 Admin 操作不得调用图床、图片模型或本地上传写入。
- **NFR-004**: 数据库变更必须遵守本仓库 migration baseline：使用 Prisma Migrate，不新增 `database/*.sql` 作为 schema 变更入口。

### Quality Attributes *(if architecture-relevant)*

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 一致性 | UI、API、同步、发布对图片退役语义一致 | 防止入口删了但后台仍写图片字段 | Producer-Consumer Matrix 覆盖所有图片字段 producer/consumer | 是 |
| 可回滚性 | 字段 drop 前有快照和回滚说明 | 图片字段涉及历史数据和外部展示端 | plan 明确 drop 是否本 feature 执行及迁移回滚路径 | 是 |
| 可用性 | 周刊主流程无图片也可完成 | 退役不能破坏核心生产链路 | 周刊编辑、预览、发布验证通过 | 是 |
| 成本 | 移除无用依赖和外部调用 | 降低构建、部署和运行复杂度 | package 依赖清理或保留理由 | 否 |
| 可演进性 | 新 workbench 不再承载 legacy 图片模型 | 本 feature 是后台现代化前置条件 | Closeout 证明 active 图片入口清零 | 是 |

### Key Entities *(if applicable)*

- **Content**: 当前 Prisma `contents` 中包含 `image_url`、`image_source`、`image_width`、`image_height`、`screenshot_api` 等 legacy 图片字段；本 feature 目标是停止活跃写入和用户路径依赖。
- **Weekly Issue**: 当前 `weekly_issues.cover` 在 Admin API 中仍按 URL 校验，但展示端实际使用默认 cover 模板；本 feature 目标是消除图片 URL 语义，并将字段删除降级为后续技术读取清理。
- **Inbox Item**: 当前 `inbox_items.image_url`、`image_status` 支持来源图片和裁剪状态，`favicon_url` 支持来源标识；本 feature 目标是移除裁剪和主图处理路径，favicon 不作为图片功能退役目标。
- **Image Side-effect API**: `/api/upload/image`、`/api/ai/image`、`/api/inbox/[id]/crop-image` 等会上传、生成、裁剪或写入图片；本 feature 目标是停止这些副作用。

---

## Out of Scope *(if applicable)*

- 不重做 `admin-shell-and-weekly-workbench` 的新 UI 信息架构；本 feature 只清理图片 legacy surface。
- 不迁移主业务数据库，也不改变搜索、评分、自动化 token 或发布鉴权的核心契约。
- 不清理外部图床、Quail 或历史发布渠道中已经存在的图片资源。
- 不删除历史 `public/uploads` 文件，除非后续 plan 明确验证它们只由退役图片功能产生且无其他用途。
- 不改变 Markdown 正文中用户手写的图片语法，除非该图片由已退役的自动注入路径生成。

---

## Clarification Decisions

- **CD-001 Astro 展示端边界**: `/Users/yqg/personal/weekly/weekly` 是当前 Astro 展示端。用户确认展示端目前使用默认 cover；本地证据也显示 `parseCover()` 在 `cover` 为空或无法解析时会生成 default 模板。结论：`weekly_issues.cover` 不再是展示端视觉依赖，可以从图片退役角度清理 Admin 图片 URL 入口；字段 drop 前仍需清掉展示端 SQL/type/component 对 `cover` 列的技术读取。
- **CD-002 favicon 范围**: `favicon_url` 从 Karakeep/RSS 来源写入，主要用于来源识别；它不触发上传、裁剪或 AI 图片副作用。结论：favicon 不属于本 feature 的主动退役对象，只需在 Producer-Consumer Matrix 中与主图字段分开。
- **CD-003 AI 图片配置范围**: `image_model`、`weekly_cover` prompt 和 `/api/ai/image` 当前服务图片/封面生成。结论：本 feature 应停用用户可见图片生成能力和 `/api/ai/image`，并从配置响应/UI 中移除活跃 image model/weekly_cover surface；数据库字段和历史 prompt 记录暂留，后续 schema 迁移统一处理。
- **CD-004 数据库 drop 边界**: 字段 drop 不作为首个实现动作。当前 feature 完成条件是 Admin 活跃入口、副作用 API、写入路径和发布输出清零；字段 drop 只能在 Admin 与 Astro 对相关列的技术读取清零、快照/备份和 Prisma Migrate migration 准备后执行。若无法在本轮完成跨仓读取清理，则 drop 进入后续 migration slice。

---

## Stage Readiness

- 下一步建议：`plan`
- 阻塞项（如有）：无阻塞 plan 的歧义；字段 drop 和 Astro 展示端读取清理需在 plan 中作为后置阶段和风险控制处理。

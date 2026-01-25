# Progress - Design & Interaction Optimization

## 2026-01-24

- 建立优化计划：`task_plan_design_optimization.md`
- 提取设计系统与优化要点：`findings_design_optimization.md`
- 初步定位关键落点文件：`src/app/globals.css`、`src/components/layout/AppSidebar.tsx`、`src/app/(dashboard)/content/list/page.tsx`、`src/app/login/page.tsx`、`src/app/(dashboard)/settings/layout.tsx`
- Phase 0（Baseline & Inventory）开始：
  - 已列出核心页面与路由映射（见 `findings_design_optimization.md`）
  - 已梳理全局布局组成与 layout 相关组件
  - 已确认 UI primitives（`src/components/ui/*`）覆盖 Toast/Skeleton/Dialog 等基础能力
  - 记录了 2 个需要确认/统一的风险点（token 收敛、`/settings/users` 链接）
- Phase 0（Baseline & Inventory）v1 完成：
  - 补齐交互态缺口对照（focus/hover/selected/empty/error 等）与优先级草案（见 `findings_design_optimization.md`）
- Phase 1（Foundation）开始：
  - focus ring token 收敛（`src/app/globals.css`：`--ring/--sidebar-ring`）
  - UI primitives 从硬编码 slate 切换为 token（`src/components/ui/{button,input,select,card,table}.tsx`）
- Phase 1（Foundation）v1 完成：
  - 可复用交互态 class 约定（`src/app/globals.css`：`.ui-focus-ring*` / `.ui-hover-muted` / `.ui-pressable`）
  - 空/错状态组件（`src/components/ui/empty-state.tsx`、`src/components/ui/error-state.tsx`）
  - LoadingSpinner 样式收敛（`src/components/ui/LoadingSpinner.tsx`）
- Phase 2（Global Layout）开始：
  - Layout token 化：`src/components/layout/ProLayoutWrapper.tsx`、`src/components/layout/SiteHeader.tsx`
  - Header 设置入口对齐：`src/components/layout/HeaderActions.tsx`
  - Sidebar 交互态与可发现性增强：`src/components/layout/AppSidebar.tsx`（active 指示条、hover/icon 联动、收起态 tooltip、用户区可点击）
  - Settings tabs token 化 + focus-visible：`src/app/(dashboard)/settings/layout.tsx`
- Phase 2（Global Layout）v1 完成：Sidebar/Settings 目标项已落地（见 `task_plan_design_optimization.md`）
- Phase 3（Key Pages）v1 完成：
  - Content List：响应式筛选、刷新按钮、错误/空状态统一、表格行可点击且避免误触（`src/app/(dashboard)/content/list/page.tsx`）
  - Dashboard：LoadingSpinner + ErrorState、栅格响应式、刷新按钮、QuickActions hover/布局优化（`src/app/(dashboard)/dashboard/page.tsx`、`src/components/dashboard/quick-actions.tsx`）
  - Login：token 化细节、反馈消息加图标、忘记密码 toast、辅助链接 focus-visible（`src/app/login/page.tsx`）
- Phase 4（Common Components & Patterns）v1 完成：
  - Button：新增 `loading/loadingText` + `aria-busy/aria-disabled` 规范（`src/components/ui/button.tsx`），并在 Login/RSS/Weekly Generator 落地使用。
  - Dialog：DialogContent token 化与 focus-visible 统一（`src/components/ui/dialog.tsx`）。
  - Confirm：新增 `ConfirmDialog` 统一危险操作确认，并移除 `window.confirm`（`src/components/ui/confirm-dialog.tsx`；应用到 Content List / RSS / Settings(Tags/Categories) / Weekly Generator）。
  - Toast：新增 `success/warning` 变体与 Toaster 自动图标；destructive 风格更克制（`src/components/ui/toast.tsx`、`src/components/ui/toaster.tsx`）。
  - Form：新增 `FormMessage` 统一表单提示/错误样式，并在 Login 先行替换（`src/components/ui/form-message.tsx`、`src/app/login/page.tsx`）。
- Phase 5（Responsive）v1 完成：
  - 移动端侧边栏：桌面 Sidebar 在 `< md` 隐藏，Header 增加 Sheet 抽屉导航（`src/components/layout/ProLayoutWrapper.tsx`、`src/components/layout/SiteHeader.tsx`、`src/components/layout/AppSidebar.tsx`）。
  - Header 响应式：Breadcrumbs 小屏收敛为当前页标题；HeaderActions 在小屏隐藏“快速入口/体验优化中”，头像按钮收敛为图标（`src/components/layout/SiteHeader.tsx`、`src/components/layout/HeaderActions.tsx`）。
  - 关键页面栅格/按钮组适配：Dashboard/Analytics/Content List/Operation Logs header 与筛选区在小屏自动换行；WeeklyGenerator 从 3 列改为移动端单列（`src/app/(dashboard)/*`、`src/components/weekly/WeeklyGenerator.tsx`）。
  - Login：从双栏改为小屏单栏（隐藏左侧品牌区），表单区增加移动端 padding（`src/app/login/page.tsx`）。
  - Layout padding 收敛：移除少数页面的内层 `p-8`，统一由 Layout 提供基础 padding（`src/components/layout/ProLayoutWrapper.tsx` + 相关页面）。
- Phase 6（Performance）v1 完成：
  - 搜索输入防抖：Content List 与 Tags 查询输入改为 300ms debounce，减少频繁请求（`src/app/(dashboard)/content/list/page.tsx`、`src/app/(dashboard)/settings/tags/page.tsx`）。
  - 图片：预览/列表图片增加 `loading="lazy"`/`decoding="async"`（`src/components/weekly/HoverImagePreview.tsx`、`src/components/weekly/WeeklyIssueLayout.tsx`、`src/components/weekly/WeeklyPreview.tsx`、`src/components/drafts/draft-card.tsx`、`src/app/(dashboard)/weekly/editor/[id]/page.tsx`）。
  - 长列表评估：核心列表均分页（默认 20 条/页），暂不引入虚拟滚动（记录在 `task_plan_design_optimization.md`）。

- Phase 7（Accessibility）v1 进展：
  - Content List：表格行支持键盘聚焦与 Enter/Space 打开（`src/app/(dashboard)/content/list/page.tsx`）。
  - 周刊编辑：封面上传区改为可聚焦按钮；关键 icon-only 按钮补齐 aria-label（`src/app/(dashboard)/weekly/editor/[id]/page.tsx`、`src/components/weekly/WeeklyEditor.tsx`、`src/components/weekly/SelectedContentsList.tsx`）。
  - Drafts：列表/筛选关键 icon-only 按钮补齐 aria-label（`src/components/drafts/draft-grid.tsx`、`src/components/drafts/draft-filters-new.tsx`）。

### Lint Notes

- `pnpm lint` 当前仍会失败：仓库内已有多处 `@typescript-eslint/no-explicit-any` 与未使用变量等问题（与本次 Phase 3 改动无直接关联）。
- 运行 lint 时出现 “Found multiple lockfiles” 提示，`pnpm` 选择了上级目录的 `package-lock.json`，需要确认本机目录结构/锁文件策略。
- `pnpm type-check` 当前仍会失败：存在既有 TS 报错（例如 `react-markdown` 类型、部分 API 返回类型不一致等）；本轮修改文件未出现在错误列表中。

## Decision Log

- 从 Phase 0 开始：先完成页面/组件清单与交互态缺口对照，再进入各阶段实现，确保全站一致性。

### Next

- Phase 7：对比度抽样 + 关键弹窗/菜单键盘回归；随后进入 Verification Checklist。

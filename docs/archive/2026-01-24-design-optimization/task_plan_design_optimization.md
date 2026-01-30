# Weekly Admin - Design & Interaction Optimization Plan

## Goal

基于 `DESIGN.md` 与 `DESIGN_OPTIMIZATION.md`，对全站样式与交互进行一次系统性优化：更一致、更可用（桌面优先）、更可访问（WCAG AA）、更高效（减少操作成本）。

## Inputs (Source of Truth)

- `DESIGN.md`：设计系统（色板/字体/组件/布局/动效/无障碍）
- `DESIGN_OPTIMIZATION.md`：问题清单与建议实现（侧边栏/列表/仪表盘/登录/通用组件/响应式/性能/无障碍/实施分期）

## Scope

- 覆盖主要页面与通用组件：Sidebar、Dashboard、Content List、Login、Settings、Weekly 编辑相关页面与弹窗/表单/表格等。
- 以 Tailwind + shadcn/ui 现有体系为基础做统一与补齐，尽量避免引入新依赖/新工具。

## Non-Goals

- 不做业务逻辑重构；不做与 UI/UX 无关的重构。
- 不做大范围视觉“换肤”；保持 Slate 企业后台风格。

## Definition of Done

- 关键交互态（hover/active/focus/disabled/loading/empty/error）在主要页面一致、清晰、不过度突兀。
- 侧边栏与导航（含收起态）可用性提升（可发现、可聚焦、可键盘导航）。
- 列表/表格：行 hover 与选择态可辨识，操作按钮可发现，分页/批量操作有明确反馈。
- 表单与对话框：错误/成功反馈一致；危险操作有确认；焦点管理正确。
- 基本无障碍：可键盘操作、ARIA 标签补齐、对比度达标（目标 ≥ 4.5:1）。

## Tracking Files

- 发现与决策记录：`findings_design_optimization.md`
- 进度与验证记录：`progress_design_optimization.md`

## Execution Strategy

- 从 Phase 0 开始（建立基线与缺口对照），避免“边改边猜”导致的样式碎片化与交互态不一致。
- 仅在已完成 Phase 0 的前提下，后续各 Phase 可使用对应的 “Phase 0-lite” 作为局部复核模板（确保新增页面不偏离基线）。

---

## Phase 0 - Baseline & Inventory (0.5–1 day)

- [x] 列出核心用户路径与页面清单（Dashboard / Content / Weekly / RSS / Settings / Login）v1。
- [x] 组件清单：布局（Sidebar/Header）、表格、表单、弹窗、Toast、Skeleton、Empty State v1。
- [x] 建立“交互态”对照表（hover/active/focus/disabled/loading/empty/error）v1，并标注缺口。
- [x] 明确优先级（P0：导航/列表/表单；P1：性能/动效；P2：高级交互如快捷键/拖拽等）v1。

## Phase 1 - Foundation (1–2 days)

目标：把“设计系统”落到可复用的基础层，减少页面各自为政。

- [x] 复核并对齐全局 token（`src/app/globals.css`）与 `DESIGN.md`（focus ring token 先落地）。
- [x] 统一 focus ring 规则（focus-visible 优先）：先在 UI primitives 中落地（`ring-ring`；输入类控件使用更克制的 `ring-1`）。
- [x] 定义可复用的交互态 class 约定（按钮/行/导航项/图标按钮）v1（`.ui-focus-ring*` / `.ui-hover-muted` / `.ui-pressable`）。
- [x] 通用空状态/错误状态/加载态模式统一 v1（新增 `EmptyState`/`ErrorState`；`LoadingSpinner` 收敛为 token 风格）。

## Phase 2 - Global Layout (1–2 days)

目标：优化整体框架的交互效率与一致性（侧边栏/顶栏/设置页布局）。

- [x] Sidebar（`src/components/layout/AppSidebar.tsx`）
  - [x] 活跃态指示更克制（左侧 2px 指示条）。
  - [x] hover/active 状态更明显（含图标颜色联动）。
  - [x] 收起态增加 Tooltip（可发现性）与键盘可达性（focus-visible）。
  - [x] 用户信息区域可交互（hover/focus + 可点击跳转的明确反馈）。
- [x] Settings layout（`src/app/(dashboard)/settings/layout.tsx`）
  - [x] Tab 导航 hover/active/focus 统一；小屏布局不拥挤。

## Phase 3 - Key Pages (2–3 days)

目标：先打通高频页面的体验闭环。

- [x] Content List（`src/app/(dashboard)/content/list/page.tsx`）
  - [x] 表格行 hover/选中态更易扫描；整行可点击时避免误触（checkbox/操作列 stopPropagation）。
  - [x] 操作按钮（更多菜单/图标）补齐 cursor + hover + focus（复用 Button focus-visible）。
  - [x] 筛选区在窄屏下自动换行（响应式 grid）。
  - [x] 分页 disabled 状态清晰；刷新/加载时反馈明确（刷新按钮 + loading spin）。
  - [x] Empty state 与 error state 统一模板（`EmptyState`/`ErrorState`）。
- [x] Dashboard（`src/app/(dashboard)/dashboard/page.tsx`）
  - [x] 统计卡片 hover（`StatCard` 已支持 hover shadow）。
  - [x] Loading/Error/Quick actions 体验收敛（LoadingSpinner + ErrorState + QuickActions 栅格/hover）。
- [x] Login（`src/app/login/page.tsx`）
  - [x] 输入框 focus/error 状态更明显；反馈消息带图标/层次。
  - [x] 复选框/辅助链接 hover + focus-visible（复用 `.ui-focus-ring-sm`）。

## Phase 4 - Common Components & Patterns (1–2 days)

- [x] Button：加载态（`loading`/`loadingText`）统一；禁用态与 `aria-busy`/`aria-disabled` 规范化（v1）。
- [x] Form：错误信息排版统一（新增 `FormMessage` v1；实时校验/字符计数按需后续补齐）。
- [x] Dialog：确认对话框统一（新增 `ConfirmDialog` v1；替换 `window.confirm`）；DialogContent token 化与 focus-visible 统一（v1）。
- [x] Toast：成功/失败/警告视觉规范统一（新增 `success/warning`；Toaster 自动图标；destructive 风格更克制）v1。

## Phase 5 - Responsive (0.5–1 day)

- [x] 断点策略落到关键页面：筛选区、表格、侧边栏（移动端抽屉/隐藏策略）v1。

## Phase 6 - Performance (0.5–1 day)

- [x] 图片：预览/列表图片增加 `loading="lazy"`/`decoding="async"`（后续再评估 `next/image` 与占位策略）v1。
- [x] 长列表：当前核心列表均分页（默认 20 条/页），暂不引入虚拟滚动；如后续出现无限滚动或单页 >200 行再评估。
- [x] 搜索：防抖输入（Content List / Tags）v1。

## Phase 7 - Accessibility (1 day)

- [x] 键盘导航（v1）：Content List 行可聚焦 + Enter/Space 打开；封面上传区可聚焦操作。
- [x] ARIA（v1）：补齐关键 icon-only 按钮 aria-label（Weekly Editor / Selected Contents / Drafts 等）。
- [ ] 对比度：抽样检查主要页面（目标 ≥ 4.5:1）。

---

## Verification Checklist

- [ ] 关键页面手动回归：Sidebar / Content List / Dashboard / Login / Settings。
- [ ] 交互态抽样：hover/focus/disabled/loading/empty/error。
- [ ] Dark mode 抽样（如项目已启用 `.dark`）。
- [ ] `pnpm lint` / `pnpm type-check`（若仓库已有既存报错，记录在 `progress_design_optimization.md`）。

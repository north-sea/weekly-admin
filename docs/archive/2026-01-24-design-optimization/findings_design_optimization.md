# Findings - Design & Interaction Optimization

## Source Summary (2026-01-24)

### From `DESIGN.md`

- 主题基调：Slate 冷灰、专业沉稳；桌面优先（1024px+）。
- 设计原则：层级清晰、交互反馈即时、Light/Dark 双主题。
- 关键 token（已在 `src/app/globals.css` 以 CSS variables 形式存在）：
  - Light: `--background: 210 40% 98%`, `--foreground: 222 47% 11%`, `--border: 214 32% 91%` 等
  - Dark: `--background: 222 47% 10%`, `--card: 222 47% 12%`, `--border: 217 27% 20%` 等
- 组件与动效：`duration-200`，按钮按压 `active:scale-[0.98]`；表格与表单的交互态需统一。
- 无障碍：focus 可见、键盘导航、对比度达标（目标 WCAG AA）。

### From `DESIGN_OPTIMIZATION.md`

#### Global
- Sidebar：hover 不明显、active 边框突兀、收起态缺 tooltip、用户区缺交互反馈。
- Content List：表格 hover 弱、操作按钮缺 cursor、筛选区小屏拥挤、分页禁用态不明显、批量操作提示不突出。
- Dashboard：卡片缺 hover、加载态不够优雅、快速操作缺层次、时间范围选择器不够突出。
- Login：focus 不明显、错误提示样式需优化、复选框缺反馈、忘记密码交互需兜底提示。

#### Components / Patterns
- Button：加载态、成功态反馈示例。
- Form：实时校验/字符计数示例。
- Dialog：确认删除对话框示例 + 动画 + 焦点管理建议。
- Toast：成功/失败 toast 视觉规范建议。

#### Non-functional
- Responsive：断点策略 + 移动端 Sidebar 抽屉建议。
- Performance：图片优化、长列表虚拟滚动、防抖搜索。
- A11y：快捷键示例、ARIA 标签、focus 管理。

## Initial Codebase Notes

- Tailwind v4 + shadcn/ui：全局 token 已集中在 `src/app/globals.css`。
- Sidebar 实现：`src/components/layout/AppSidebar.tsx`（当前 active 使用 `border border-slate-200`，可按优化方案收敛为更克制的指示）。
- Dashboard 页面：`src/app/(dashboard)/dashboard/page.tsx`
- Settings 已切换为 Tab 导航：`src/app/(dashboard)/settings/layout.tsx`。

## Phase 0 - Baseline Inventory (2026-01-24)

### Core Pages (route → file)

- `/login` → `src/app/login/page.tsx`
- `/dashboard` → `src/app/(dashboard)/dashboard/page.tsx`
- `/content/list` → `src/app/(dashboard)/content/list/page.tsx`
- `/content/drafts` → `src/app/(dashboard)/content/drafts/page.tsx`
- `/weekly` → `src/app/(dashboard)/weekly/page.tsx`
- `/weekly/generate` → `src/app/(dashboard)/weekly/generate/page.tsx`
- `/rss` → `src/app/(dashboard)/rss/page.tsx`
- `/analytics` → `src/app/(dashboard)/analytics/page.tsx`
- `/search` → `src/app/(dashboard)/search/page.tsx`
- `/publish` → `src/app/(dashboard)/publish/page.tsx`
- `/operation-logs` → `src/app/(dashboard)/operation-logs/page.tsx`
- `/settings/*` → `src/app/(dashboard)/settings/layout.tsx`
  - `/settings/categories` → `src/app/(dashboard)/settings/categories/page.tsx`
  - `/settings/tags` → `src/app/(dashboard)/settings/tags/page.tsx`
  - `/settings/ai` → `src/app/(dashboard)/settings/ai/page.tsx`

### Global Layout Composition

- App wrapper → `src/app/layout.tsx`（引入 `src/app/globals.css`）
- Dashboard group layout → `src/app/(dashboard)/layout.tsx` → `src/components/layout/ProLayoutWrapper.tsx`
- Pro layout → `src/components/layout/ProLayoutWrapper.tsx`
  - Sidebar → `src/components/layout/AppSidebar.tsx`
  - Header → `src/components/layout/SiteHeader.tsx`
    - Header actions → `src/components/layout/HeaderActions.tsx`

### UI Primitives (shadcn/ui)

目录：`src/components/ui/`

- 基础：`button.tsx`、`input.tsx`、`textarea.tsx`、`label.tsx`、`badge.tsx`、`card.tsx`、`separator.tsx`
- 浮层：`dialog.tsx`、`dropdown-menu.tsx`、`sheet.tsx`、`tooltip.tsx`
- 数据：`table.tsx`、`tabs.tsx`、`select.tsx`、`checkbox.tsx`、`switch.tsx`
- 反馈：`toast.tsx`、`toaster.tsx`、`use-toast.ts`
- 载入：`skeleton.tsx`、`LoadingSpinner.tsx`

### Domain Components (by folder)

- Layout：`src/components/layout/*`（Sidebar/Header/Wrapper）
- Dashboard：`src/components/dashboard/*`（统计卡片、最近活动、快捷入口等）
- Content：`src/components/content/*`（编辑器、预览、上传等）
- Weekly：`src/components/weekly/*`（编辑器、生成器、列表等）
- Tags：`src/components/tags/*`（合并向导、清理对话框、统计卡片等）
- Categories：`src/components/categories/*`（树、合并向导等）

### Interaction/State Patterns (current usage)

- Toast：大量页面/组件通过 `useToast()` 使用（例如周刊编辑器、内容编辑器、标签/分类向导等）。
- Skeleton：Dashboard、Content List、Settings、Search、Charts 等多处使用 `Skeleton`。
- Empty / Error / Retry：文案风格不完全统一（“暂无xxx”“数据加载失败”“重试”均存在），存在散落的页面级实现。

### Interaction State Baseline (primitives)

- `Button`（`src/components/ui/button.tsx`）
  - 自带：`focus-visible:ring-2 ring-ring ring-offset-2`、`disabled:opacity-50`、`active:scale-[0.98]`、`duration-200`
  - 注意：`outline` 变体包含 `bg-background/50 backdrop-blur-sm`（设计上可接受，但需要全站一致性考量）
- `Input`（`src/components/ui/input.tsx`）
  - 自带：`focus-visible:ring-2 ring-ring ring-offset-2`，disabled 状态有 `cursor-not-allowed`
  - 说明：已切换为 token（`border-input bg-background` / `placeholder:text-muted-foreground`），与全局 `globals.css` 对齐

### Noted Inconsistencies / Potential Risks

- token vs hardcoded：布局层大量使用 `bg-slate-* / text-slate-* / border-slate-*`，而设计系统更倾向 token（`bg-background` 等）；后续“全站一致性”需要决定是否逐步向 token 收敛。
- Settings 快速入口：Header 快捷链接已对齐为 `href: '/settings/categories'`（`src/components/layout/HeaderActions.tsx`）。
- Sidebar 导航项：已补齐 `focus-visible`（通过 `.ui-focus-ring`/`.ui-focus-ring-sm`）；后续可继续完善收起态的分组/子菜单可发现性。

## Phase 1 - Foundation Decisions (draft)

- Focus ring token：`src/app/globals.css` 中 `--ring/--sidebar-ring` 收敛为 Slate 风格的可读值（light≈slate-400，dark≈更亮的 slate），用于全站 `ring-ring`。
- UI primitives 收敛到 token：`src/components/ui/{button,input,select,card,table}.tsx` 去除硬编码 `slate-*`，统一使用 `border-input/border-border/bg-background/text-foreground/bg-muted` 等。
- 交互态 class 约定（全局可复用）：`src/app/globals.css` 增加 `.ui-focus-ring` / `.ui-focus-ring-sm` / `.ui-hover-muted` / `.ui-pressable`。
- 空/错状态组件：新增 `src/components/ui/empty-state.tsx`、`src/components/ui/error-state.tsx`（后续逐步替换散落实现）。

## Phase 0 - Interaction State Gap Matrix (baseline)

| Area | Current Implementation | Gaps vs DESIGN / OPTIMIZATION |
|---|---|---|
| Sidebar nav item | 原生 `<button>`：hover 有背景色；active 使用 `border border-slate-200`（`src/components/layout/AppSidebar.tsx`） | 缺 `focus-visible` ring；active 指示偏“框起来”而非克制指示；收起态无 Tooltip |
| Header quick links | 使用 `Button`（ghost）+ Link（`src/components/layout/HeaderActions.tsx`） | 基础 focus/active 已由 `Button` 覆盖；需确认信息密度与可点击性（桌面优先 OK） |
| Header avatar trigger | `Button` + border + shadow（`src/components/layout/HeaderActions.tsx`） | focus/hover 已有；与 Sidebar 用户区交互不一致（Sidebar 仍是静态展示） |
| Tables | `TableRow` 默认 `hover:bg-slate-50`，border 多处硬编码 `border-slate-200`（`src/components/ui/table.tsx`） | 与 token（`border-border`/`bg-muted`）并行；hover/selected 反馈较弱，未达到“更易扫描”的目标 |
| Inputs | `Input` 自带 focus ring（`src/components/ui/input.tsx`） | 仍为硬编码 slate 边框/背景；如果要全站 token 化，需要迁移策略 |
| Pagination buttons | 使用 `Button` outline + `disabled`（`src/app/(dashboard)/content/list/page.tsx`） | disabled 反馈 OK；outline 变体带 `backdrop-blur`（是否需要统一） |
| Empty/Error/Retry | 多处各自实现（`rg` 结果中 “暂无/重试/数据加载失败” 散落） | 缺统一组件/文案与视觉模板；容易风格分裂 |

## Phase 0 - Priorities (draft)

- P0（先做）：
  - token vs hardcoded 的收敛策略（至少先统一：layout + table + sidebar 三处）
  - 可见焦点（`focus-visible`）补齐：Sidebar/Settings tabs 等非 `Button` 体系控件
  - Empty/Error/Retry 统一模板（先覆盖 Dashboard / Content List / Weekly editor 的常见场景）
- P1（后做）：
  - hover/selected 的“更易扫描”（表格行、导航项）的微动效/阴影增强（遵循 `duration-200`）
  - Tooltip/快捷键等增强（等 P0 稳定后再加）

## Phase 6–7 Notes (2026-01-24)

### Performance

- 长列表：核心列表均分页（默认 20 条/页），现阶段不引入虚拟滚动；若后续出现无限滚动或单页 >200 行再评估（避免引入额外依赖与复杂度）。

### Accessibility

- icon-only 按钮：统一补齐 `aria-label`（或 `sr-only` 文案）避免屏幕阅读器“无名称控件”。
- 可交互容器：避免用 `<div>` 承载核心点击操作（如上传区域）；优先改为 `<button type="button">`，天然可聚焦/可键盘触发。
- 可点击列表行：若使用 `TableRow`/容器整行点击跳转，补齐 `tabIndex={0}` + `Enter/Space` 触发，并提供 `focus-visible` 可见焦点样式。

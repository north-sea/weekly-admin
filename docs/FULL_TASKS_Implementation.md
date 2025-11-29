# 🛠️ Full Implementation Tasks: Weekly Admin Refactor

本任务清单移除了移动端适配任务，专注于桌面端体验。

## Phase 1: 基础架构 (Infrastructure)

* [ ] **1.1 初始化**:
    * 运行: `npx shadcn@latest init`
    * **配置选择**:
        * Style: **Default**
        * Base Color: **Slate**
        * CSS Variables: **Yes**
        * **Radius**: **0.3rem** (对应 `rounded` / Small) -- *关键修改*
    * 安装组件: `npx shadcn@latest add button sheet card separator breadcrumb avatar dropdown-menu scroll-area tooltip badge input skeleton collapsible popover dialog form label command table`
    * 安装依赖: `npm install lucide-react clsx tailwind-merge`

* [x] **1.2 Sidebar Logic (Desktop Only)**:
    * 实现 `SidebarProvider`: 仅需管理 `isCollapsed` 状态，移除 `isMobileOpen`。
    * 实现 `AppSidebar`:
        * 移除 `<Sheet>` 移动端抽屉代码。
        * 仅保留 `<aside>` 标签，宽度在 `w-[250px]` 和 `w-[60px]` 之间切换。
    * 样式修正: 确保侧边栏有右侧边框 (`border-r`)。

* [x] **1.3 Header Logic**:
    * 实现 `SiteHeader`:
        * 移除左侧的 Menu Toggle Button (汉堡菜单)。
        * 保留 Breadcrumb 和右侧 Actions。

* [x] **1.4 全局样式微调**:
    * 在 `globals.css` 中确认 `.card` 或类似类名包含 `shadow-sm`。
    * 确认全局圆角变量 `--radius` 设置较小 (0.3rem / 0.25rem)。

## Phase 2: 登录与仪表盘
* [x] **2.1 登录页**:
    * 布局: 左右分栏 (左侧深色 Slate 渐变，右侧白色卡片)。
    * 卡片样式: `rounded shadow-lg` (登录框稍微加重阴影)。
* [x] **2.2 Dashboard**:
    * 卡片组件: `StatsCard` 需添加 `shadow-sm` 类。
    * Grid: 强制 `grid-cols-4` (不再需要 `grid-cols-1` 适配)。

## Phase 3: 内容管理系统
* [ ] **3.1 草稿箱 (/content/drafts)**:
    * 表格: 使用 Shadcn `Table` 组件。
    * **交互**: 鼠标悬停行时，背景变色 (`hover:bg-slate-50`)。
    * 弹窗: `DraftPreviewDialog` 固定最大宽度，移除全屏适配代码。
* [ ] **3.2 编辑页 (/content/[id])**:
    * 布局: Flex Row。
        * Left: `w-[300px]` border-r.
        * Center: `flex-1`.
        * Right: `w-[350px]` border-l (不再隐藏)。
    * 组件: `ScreenshotPasteUploader` 样式为 `border-2 border-dashed border-slate-200 rounded`.

## Phase 4: 周刊系统
* [x] **4.1 周刊编辑器**:
    * 三列布局: 使用 `grid grid-cols-12 gap-6`。
    * 每一列都包裹在 `<div className="rounded border bg-card text-card-foreground shadow-sm h-full">` 中。
* [ ] **4.2 拖拽排序**:
    * 确保拖拽时的 item 样式有明显的 `shadow-md` 浮起效果，以区分静止状态的 `shadow-sm`。

## Phase 5: 数据与设置
* [ ] **5.1 搜索页**: 结果卡片统一使用 `rounded shadow-sm`。
* [ ] **5.2 设置页**:
    * 侧边栏: 简单的垂直导航列表。
    * 右侧内容: 包裹在 Card 中。

## Phase 6: 清理与优化
* [ ] **6.1 代码清理**: 搜索并删除代码中所有 `lg:hidden`, `md:block` 等响应式前缀，简化 class 逻辑。
* [ ] **6.2 滚动条美化**: 为 `ScrollArea` 和全局滚动条添加 Slate 风格的细滚动条样式。

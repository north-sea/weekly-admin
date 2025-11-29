# 📑 Full PRD: Weekly CMS Admin Refactor (Desktop Only / Slate Theme)

## 1. 项目概述 (Overview)
**目标**：将 Next.js Weekly CMS 全站重构为 `satnaing/shadcn-admin` 风格。
**适用设备**：**Desktop Only** (仅适配桌面端，最小宽度 1024px+)。
**核心原则**：
* **视觉风格**：**Slate (冷灰)** 主题。
* **圆角策略**：使用 **`rounded`** (标准小圆角, 4px/6px)，风格更严谨、商务。
* **阴影策略**：**微阴影 (`shadow-sm`)**，卡片带有一层极淡的阴影以区分层级，不再仅依靠边框。

## 2. 全局规范 (Global Specs)

### 2.1 视觉系统 (Visual System)
* **Color Palette (Slate Theme)**:
    * **Base**: Slate (Tailwind colors `slate-50` to `slate-950`).
    * **Primary**: `bg-slate-900` (Light Mode) / `bg-slate-50` (Dark Mode).
    * **Background**: `bg-slate-50/50` (App 背景), `bg-white` (卡片背景).
* **Shape & Depth**:
    * **Card**: `rounded border border-slate-200 bg-card text-card-foreground shadow-sm`.
    * **Interactive**: 按钮和输入框使用 `rounded`。
    * **Dropdown/Popover**: `shadow-md` (中等阴影) + `border`.

### 2.2 App Shell (应用外壳)
* **Sidebar (Left)**:
    * **交互**: 固定宽 `250px`，支持折叠至 `60px` (Icon mode)。**无移动端抽屉**。
    * **样式**: `bg-slate-900` (深色侧边栏) 或 `bg-white` (浅色侧边栏) 皆可，建议浅色带右侧 Border。
    * **内容**: Logo, 导航菜单 (Dashboard, Content, Weekly, Data, Settings), 底部 User Profile。
* **Header (Top)**:
    * **高度**: `h-14` (56px).
    * **左侧**: 面包屑 (`Breadcrumb`)。**无移动端菜单触发器**。
    * **右侧**: 全局搜索 (`Cmd+K`), 通知中心, 用户下拉菜单。
* **Main Area**:
    * Padding: 统一 `p-6`。

---

## 3. 核心业务页面 (Core Pages)

### 3.1 仪表盘 (Dashboard)
* **路由**: `/dashboard`
* **顶部**: 欢迎语 + 日期范围选择器 + 导出按钮。
* **布局**: 固定 Grid 布局 (4 Cols)。
* **统计卡片**: `Card` + `shadow-sm` + `rounded`。
* **最近活动**: 列表高度固定，内部滚动。

### 3.2 草稿管理 (Drafts)
* **路由**: `/content/drafts`
* **顶部**: "同步 Karakeep" 按钮。
* **表格**:
    * **样式**: 表头带微背景色 (`bg-slate-50`)，行高紧凑。
    * **列**: Checkbox, Title (w/ Favicon), Status (Outline Badge), Priority, Actions.
* **弹窗 (DraftPreviewDialog)**:
    * 宽度: `max-w-4xl` (大弹窗)。
    * 布局: 左侧 Markdown 预览，右侧 AI 建议栏。

### 3.3 内容编辑页 (Content Editor)
* **路由**: `/content/[id]`
* **布局**: 三栏式 (Left Sidebar | Editor | Right Preview)。
    * **Left (Metadata)**: `w-[300px]` 固定宽。
    * **Center (Editor)**: `flex-1`。
    * **Right (Preview)**: `w-[350px]` 固定宽，**始终显示，无需切换移动端视图**。
* **组件**:
    * `ScreenshotPasteUploader`: 带有虚线边框 (`border-dashed`) 和圆角 (`rounded`)。

---

## 4. 周刊业务页面 (Weekly)

### 4.1 周刊编辑器 (Weekly Editor)
* **路由**: `/weekly/editor/[id]`
* **布局**: 三列穿梭框 (Grid Cols-12)。
    * **左列 (Pool)**: `col-span-3`。
    * **中列 (Builder)**: `col-span-5`。
    * **右列 (Preview)**: `col-span-4`。
* **样式**: 每个列都是一个独立的 `Card` 容器，带有 `shadow-sm`。

### 4.2 周刊预览与分享
* **路由**: `/weekly/preview/[id]`
* **组件**: `WeeklyIssueLayout`。
    * 容器宽度: `max-w-[800px]` 居中。
    * 样式: 模拟邮件样式，白色背景，`shadow` 浮起效果。

---

## 5. 系统设置 (Settings)

### 5.1 设置页布局
* **路由**: `/settings/*`
* **布局**: 左右结构。
    * 左侧: 侧边导航菜单 (`w-64`)。
    * 右侧: 具体设置表单区域 (`Card` 容器)。

### 5.2 AI 设置
* **功能**: API Key 输入框支持 "显示/隐藏" 切换。
* **圆角**: 所有 Input 和 Button 统一使用 `rounded`。

## 6. 关键状态 UI
* **Loading**: `Skeleton` (圆角匹配，`rounded`)。
* **Empty**: 统一 `EmptyState` 组件。
# Design System: Weekly Admin CMS
**项目类型:** 周刊内容管理系统
**技术栈:** Next.js 15 + shadcn/ui + Tailwind CSS 4

## 1. Visual Theme & Atmosphere

**专业、简洁、高效的桌面管理界面**

Weekly Admin 采用现代化的企业级管理后台设计语言,以 **Slate 冷灰色调** 为主题基调,营造出专业、沉稳、高效的工作氛围。整体设计追求 **信息密度与视觉舒适度的平衡**,适合长时间内容管理工作。

设计哲学:
- **桌面优先**: 针对 1024px+ 宽屏优化,充分利用横向空间
- **信息层次清晰**: 通过微妙的阴影和边框区分内容层级
- **交互反馈即时**: 所有可交互元素都有明确的 hover/active 状态
- **双主题支持**: 完整的 Light/Dark 模式切换能力

视觉密度: **中等偏紧凑** - 适合数据密集型管理界面,同时保持足够的呼吸感。

## 2. Color Palette & Roles

### Light Mode (默认)

**背景层次:**
- **主背景 - 柔和灰蓝** `hsl(210, 40%, 98%)` (#F7F9FB)
  用于页面主背景,营造清爽的工作环境

- **卡片背景 - 纯白** `hsl(0, 0%, 100%)` (#FFFFFF)
  用于内容卡片、表单容器、对话框,提供最高对比度

- **次级背景 - 浅灰蓝** `hsl(210, 40%, 96%)` (#F1F5F9)
  用于次要按钮、侧边栏 accent 状态

- **静音背景 - 冷灰** `hsl(214, 32%, 91%)` (#E2E8F0)
  用于禁用状态、表格 hover、输入框边框

**文字层次:**
- **主文字 - 深蓝灰** `hsl(222, 47%, 11%)` (#0F172A)
  用于标题、正文、主要信息

- **次要文字 - 中灰** `hsl(215, 16%, 47%)` (#64748B)
  用于描述文字、辅助信息、占位符

**功能色:**
- **主色调 - 深蓝灰** `hsl(222, 47%, 11%)` (#0F172A)
  用于主要按钮、链接、选中状态,传达专业与权威

- **强调色 - 冷灰蓝** `hsl(214, 32%, 91%)` (#E2E8F0)
  用于 hover 状态、focus ring

- **危险色 - 鲜红** `hsl(0, 72%, 51%)` (#DC2626)
  用于删除按钮、错误提示、警告信息

**边框与分隔:**
- **边框色 - 浅冷灰** `hsl(214, 32%, 91%)` (#E2E8F0)
  用于卡片边框、表格分隔线、输入框描边

### Dark Mode

**背景层次:**
- **主背景 - 深蓝灰** `hsl(222, 47%, 10%)` (#0F1419)
  深色模式主背景,减少眼睛疲劳

- **卡片背景 - 稍亮蓝灰** `hsl(222, 47%, 12%)` (#1A1F2E)
  内容卡片背景,与主背景形成微妙层次

- **次级背景 - 中蓝灰** `hsl(217, 33%, 17%)` (#1E293B)
  次要按钮、侧边栏 accent

- **静音背景 - 深冷灰** `hsl(217, 27%, 20%)` (#2D3748)
  边框、输入框、分隔线

**文字层次:**
- **主文字 - 柔和白** `hsl(210, 40%, 98%)` (#F7F9FB)
  主要文字,避免纯白刺眼

- **次要文字 - 浅灰** `hsl(215, 20%, 80%)` (#CBD5E1)
  辅助信息、描述文字

## 3. Typography Rules

**字体家族:**
- **主字体**: Geist Sans - 现代几何无衬线字体,清晰易读
- **等宽字体**: Geist Mono - 用于代码、数据展示
- **后备字体**: Arial, Helvetica, sans-serif

**字重层次:**
- **标题 (Headings)**: `font-semibold` (600) - 用于页面标题、卡片标题
- **正文 (Body)**: `font-medium` (500) - 用于按钮、标签、表格表头
- **普通文本**: `font-normal` (400) - 用于正文、描述、表格内容

**字号系统:**
- **大标题**: `text-3xl` (30px) - 页面主标题
- **卡片标题**: `text-2xl` (24px) - 卡片、区块标题
- **小标题**: `text-lg` (18px) - 子标题
- **正文**: `text-base` (16px) - 默认正文
- **小字**: `text-sm` (14px) - 表格、表单标签、辅助信息
- **极小字**: `text-xs` (12px) - 徽章、时间戳

**行高与间距:**
- 标题: `leading-tight` (1.25) - 紧凑有力
- 正文: `leading-normal` (1.5) - 舒适阅读
- 字间距: `tracking-tight` - 标题使用,增强紧凑感

## 4. Component Stylings

### Buttons (按钮)

**形状**: 标准圆角 `rounded` (4px),现代而不过分圆润

**变体:**

1. **Primary (主要按钮)**
   - 背景: 深蓝灰 (#0F172A)
   - 文字: 柔和白 (#F7F9FB)
   - 阴影: `shadow-sm` 静态,`shadow-md` hover
   - 交互: hover 时背景变为 90% 透明度,按下时缩放至 98%
   - 用途: 主要操作 (保存、提交、创建)

2. **Destructive (危险按钮)**
   - 背景: 鲜红 (#DC2626)
   - 文字: 柔和白
   - 阴影: 同 Primary
   - 用途: 删除、清空等不可逆操作

3. **Outline (轮廓按钮)**
   - 背景: 半透明白 (50% opacity) + 毛玻璃效果 `backdrop-blur-sm`
   - 边框: 输入框边框色
   - 阴影: `shadow-sm` 静态,`shadow` hover
   - 用途: 次要操作 (取消、返回)

4. **Secondary (次要按钮)**
   - 背景: 浅灰蓝 (#F1F5F9 light / #1E293B dark)
   - 文字: 主文字色
   - 阴影: `shadow-sm` 静态,`shadow` hover
   - 用途: 辅助操作

5. **Ghost (幽灵按钮)**
   - 背景: 透明,hover 时显示 50% accent 色
   - 无阴影
   - 用途: 图标按钮、工具栏按钮

**尺寸:**
- Default: `h-10` (40px) + `px-4` 水平内边距
- Small: `h-9` (36px) + `px-3`
- Large: `h-11` (44px) + `px-8`
- Icon: `h-10 w-10` 正方形

**动画**: 所有按钮使用 `transition-all duration-200` 平滑过渡,按下时 `active:scale-[0.98]` 微缩放反馈

### Cards (卡片)

**形状**: 中等圆角 `rounded-md` (6px),柔和而专业

**结构:**
- 背景: 卡片背景色 (白色 light / #1A1F2E dark)
- 边框: 1px 实线,边框色 (#E2E8F0 light / #2D3748 dark)
- 阴影: `shadow-sm` - 微妙的提升感
- 过渡: `transition-shadow duration-200` - hover 时可增强阴影

**内部间距:**
- Header: `p-6` (24px) 全方向
- Content: `p-6 pt-0` - 顶部无内边距,与 header 自然衔接
- Footer: `p-6 pt-0` - 同 Content

**标题样式:**
- CardTitle: `text-2xl font-semibold leading-none tracking-tight`
- CardDescription: `text-sm text-muted-foreground` - 次要文字色

**用途**: 仪表板统计卡片、内容列表容器、表单容器、设置面板

### Tables (表格)

**整体风格**: 简洁、高密度、易扫描

**结构:**
- 容器: `overflow-x-auto` 支持横向滚动
- 表格: `w-full` 全宽,`text-sm` 小字号提高信息密度

**表头 (TableHead):**
- 高度: `h-10` (40px)
- 内边距: `px-2` 紧凑
- 文字: `font-medium` 中等字重,主文字色
- 边框: 底部 1px 边框

**表格行 (TableRow):**
- 边框: 底部 1px 边框,最后一行无边框
- Hover: `hover:bg-muted/50` - 50% 静音背景色
- 选中: `data-[state=selected]:bg-muted` - 完整静音背景色
- 过渡: `transition-colors` 平滑颜色变化

**单元格 (TableCell):**
- 内边距: `p-2` (8px) 紧凑
- 对齐: `align-middle` 垂直居中
- 文字: `whitespace-nowrap` 防止换行,保持整洁

**表尾 (TableFooter):**
- 背景: `bg-muted/50` 半透明静音色
- 边框: 顶部 1px 边框
- 文字: `font-medium` 中等字重

**用途**: 内容列表、用户管理、操作日志、数据展示

### Forms (表单)

**输入框 (Input):**
- 高度: `h-10` (40px) 与按钮对齐
- 圆角: `rounded` (4px)
- 边框: 1px 输入框边框色
- 背景: 输入框背景色 (浅冷灰 light / 深冷灰 dark)
- Focus: `ring-2 ring-offset-2` - 2px 聚焦环,主色调

**文本域 (Textarea):**
- 最小高度: `min-h-[80px]`
- 其他样式同 Input
- 支持垂直调整大小

**标签 (Label):**
- 字号: `text-sm` (14px)
- 字重: `font-medium` (500)
- 颜色: 主文字色
- 间距: 与输入框间隔 `space-y-2` (8px)

**选择框 (Select):**
- 样式同 Input
- 右侧下拉箭头图标
- 下拉菜单: 卡片样式,`shadow-md` 阴影

**复选框/单选框:**
- 尺寸: `h-4 w-4` (16px)
- 圆角: 复选框 `rounded-sm` (2px),单选框 `rounded-full`
- 选中: 主色调背景 + 白色勾选标记

**开关 (Switch):**
- 宽度: `w-11` (44px),高度: `h-6` (24px)
- 圆角: `rounded-full` 胶囊形
- 滑块: 圆形,平滑过渡动画

### Badges (徽章)

**形状**: 小圆角 `rounded` (4px),紧凑设计

**变体:**
- Default: 次级背景色 + 主文字色
- Secondary: 静音背景色 + 次要文字色
- Destructive: 危险色背景 + 白色文字
- Outline: 透明背景 + 边框

**尺寸**: `text-xs` (12px) + `px-2.5 py-0.5` 内边距

**用途**: 状态标签 (已发布/草稿)、分类标签、数量徽章

### Dialogs & Modals (对话框)

**遮罩**: 半透明黑色 `bg-black/50` 背景模糊

**对话框容器:**
- 背景: 卡片背景色
- 圆角: `rounded-lg` (8px) 较大圆角
- 阴影: `shadow-lg` 强阴影,强调层级
- 最大宽度: `max-w-lg` (512px) 适中尺寸
- 动画: 淡入 + 缩放进入

**标题**: `text-lg font-semibold` 大号半粗体

**用途**: 确认操作、表单弹窗、详情查看

### Sidebar (侧边栏)

**宽度**: 固定宽度,通常 240-280px

**背景**: 侧边栏背景色 (白色 light / #1A1F2E dark)

**导航项:**
- 默认: 透明背景
- Hover: 侧边栏 accent 背景色
- Active: 侧边栏 accent 背景色 + 主色调文字 + 左侧 2px 指示条

**分组**: 使用 `text-xs` 小号文字 + `text-muted-foreground` 次要色作为分组标题

## 5. Layout Principles

### 空间系统

**基础间距单位**: 使用 Tailwind 的 4px 基础单位

**常用间距:**
- 极小: `space-y-1` / `gap-1` (4px) - 紧密相关元素
- 小: `space-y-2` / `gap-2` (8px) - 表单标签与输入框
- 中: `space-y-4` / `gap-4` (16px) - 表单字段之间
- 大: `space-y-6` / `gap-6` (24px) - 页面区块之间
- 极大: `space-y-8` / `gap-8` (32px) - 主要区块分隔

**页面边距:**
- 主内容区: `p-8` (32px) 全方向内边距
- 卡片内部: `p-6` (24px)
- 表格单元格: `p-2` (8px) 紧凑

### 网格系统

**仪表板布局:**
- 使用 CSS Grid: `grid grid-cols-4 gap-4` - 4 列等宽网格
- 统计卡片: 每个占 1 列
- 图表区域: 可跨多列 `col-span-2` / `col-span-3`

**内容列表:**
- 单列布局为主
- 使用 Flexbox 处理行内元素对齐

**响应式:**
- 桌面优先,最小支持 1024px
- 使用 `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` 响应式网格

### 层级与深度

**Z-index 层级:**
1. 基础内容: z-0
2. 固定侧边栏: z-10
3. 固定头部: z-20
4. 下拉菜单: z-30
5. 对话框遮罩: z-40
6. 对话框内容: z-50
7. Toast 通知: z-60

**阴影层级:**
- 平面元素: 无阴影
- 卡片/按钮: `shadow-sm` - 微妙提升
- Hover 状态: `shadow` / `shadow-md` - 增强提升感
- 对话框: `shadow-lg` - 明显浮起
- 下拉菜单: `shadow-md` - 中等浮起

### 动画原则

**过渡时长:**
- 快速: `duration-100` (100ms) - 微交互
- 标准: `duration-200` (200ms) - 大部分交互
- 慢速: `duration-300` (300ms) - 复杂动画

**缓动函数:**
- 默认: `ease-in-out` - 平滑自然
- 进入: `ease-out` - 快速开始,缓慢结束
- 退出: `ease-in` - 缓慢开始,快速结束

**动画类型:**
- 颜色变化: `transition-colors`
- 阴影变化: `transition-shadow`
- 全属性: `transition-all` (谨慎使用)
- 按钮按下: `active:scale-[0.98]` 微缩放

### 滚动条样式

**宽度**: 10px (宽度和高度)

**轨道**: 50% 透明度的静音背景色

**滑块:**
- 背景: 50% 透明度的次要文字色
- 圆角: `rounded-full` 完全圆角
- 边框: 2px 主背景色边框,与轨道分离
- Hover: 70% 透明度,增强可见性

## 6. Iconography (图标系统)

**图标库**: Lucide React - 简洁、一致的线性图标

**尺寸规范:**
- 小图标: `h-4 w-4` (16px) - 按钮内图标、表格图标
- 标准图标: `h-5 w-5` (20px) - 导航图标、表单图标
- 大图标: `h-6 w-6` (24px) - 页面标题图标

**颜色**: 继承父元素文字颜色,保持一致性

**用途:**
- 导航菜单: 每个菜单项左侧图标
- 按钮: 文字左侧图标,间距 `mr-2`
- 状态指示: 成功/错误/警告图标
- 操作按钮: 编辑/删除/查看图标按钮

## 7. Data Visualization (数据可视化)

**图表颜色:**
- Chart 1: `hsl(12, 76%, 61%)` (#E76F51) 暖橙色
- Chart 2: `hsl(173, 58%, 39%)` (#2A9D8F) 青绿色
- Chart 3: `hsl(197, 37%, 24%)` (#264653) 深蓝色
- Chart 4: `hsl(43, 74%, 66%)` (#F4A261) 金黄色
- Chart 5: `hsl(27, 87%, 67%)` (#E76F51) 珊瑚橙

**图表风格:**
- 线条粗细: 2px
- 圆角: 柔和圆角
- 网格线: 浅色虚线
- 工具提示: 卡片样式,`shadow-md` 阴影

## 8. Accessibility (无障碍)

**对比度**: 所有文字与背景对比度 ≥ 4.5:1 (WCAG AA 标准)

**焦点指示**: 所有可交互元素都有明确的 `focus-visible:ring-2` 焦点环

**键盘导航**: 支持 Tab 键导航,逻辑顺序清晰

**屏幕阅读器**: 使用语义化 HTML,提供 `aria-label` 标签

**颜色独立**: 不仅依赖颜色传达信息,配合图标和文字

## 9. Best Practices (最佳实践)

### 内容密度
- 表格使用 `text-sm` 和紧凑内边距提高信息密度
- 卡片使用充足内边距保持呼吸感
- 避免过度留白,充分利用桌面空间

### 一致性
- 所有按钮高度统一为 40px (h-10)
- 所有输入框高度统一为 40px
- 圆角统一使用 4px (rounded) 或 6px (rounded-md)
- 间距使用 4 的倍数 (4px, 8px, 16px, 24px, 32px)

### 性能
- 使用 `transition-colors` 而非 `transition-all` 提高性能
- 避免过度使用 `backdrop-blur`,仅在必要时使用
- 图标使用 SVG 格式,支持缩放

### 响应式
- 桌面优先设计,最小支持 1024px
- 使用 Tailwind 响应式前缀 (md:, lg:, xl:)
- 表格支持横向滚动处理溢出内容

---

**设计系统版本**: 1.0
**最后更新**: 2026-01-24
**维护者**: Weekly Admin Team

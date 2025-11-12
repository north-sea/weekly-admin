# Weekly 系统 - 设计系统 / Design System

**版本**: v1.0  
**最后更新**: 2025年1月  
**适用范围**: Weekly 内容管理系统 Web 端

---

## 1. 品牌基调

- **定位**: 专业、可信赖、效率导向
- **品牌关键词**: Modern, Calm, Focused
- **参考主题**: tweakcn `claude`

---

## 2. 色彩系统

### 2.1 主色(Primary)

| 用途 | 色值 | 说明 |
|------|------|------|
| 主按钮、链接、选中状态 | `--primary: hsl(232 95% 68%)` | 受 claude theme 启发的紫蓝色 |
| 主按钮文字 | `--primary-foreground: hsl(218 94% 12%)` | 深色文字,确保对比 |

### 2.2 辅助色(Secondary)

| 用途 | 色值 | 说明 |
|------|------|------|
| 次级按钮、导航背景 | `--secondary: hsl(215 20% 65%)` | 冷灰蓝色,柔和过渡 |
| 次级文字 | `--secondary-foreground: hsl(217 33% 17%)` | 深灰文字 |

### 2.3 强调色(Accent)

| 用途 | 色值 | 说明 |
|------|------|------|
| 标签、重点提示 | `--accent: hsl(189 93% 42%)` | 明亮的青绿色,注入活力 |
| 强调文字 | `--accent-foreground: hsl(210 40% 98%)` | 浅色文字 |

### 2.4 反馈色(Feedback)

| 类型 | 颜色 | 色值 |
|------|------|------|
| 成功(Success) | 绿色 | `#22C55E` |
| 警告(Warning) | 黄色 | `#FACC15` |
| 错误(Error) | 红色 | `--destructive: hsl(0 84% 60%)` |

### 2.5 背景与边框

| 名称 | 色值 | 用途 |
|------|------|------|
| 背景 | `--background: hsl(216 33% 98%)` | 页面背景 |
| 卡片背景 | `--card: hsl(0 0% 100%)` | 卡片、对话框 |
| 边框 | `--border: hsl(214 20% 88%)` | 边框、分割线 |
| 输入框背景 | `--input: hsl(214 20% 88%)` | 输入框背景 |

### 2.6 暗色模式

- 背景: `--background: hsl(233 35% 10%)`
- 文字: `--foreground: hsl(210 40% 98%)`
- 卡片: `--card: hsl(231 38% 15%)`
- 主色: `--primary: hsl(232 94% 72%)`

---

## 3. 排版系统

### 3.1 字体

- **主字体**: `"SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif`
- **代码字体**: `"JetBrains Mono", "Fira Code", monospace`

### 3.2 字号体系

| 类型 | Tailwind 类 | 像素值 | 用途 |
|------|-------------|--------|------|
| Display | `text-4xl` | 36px | 页面主标题,如仪表板标题 |
| Title | `text-2xl` | 24px | 区块标题,如卡片标题 |
| Subtitle | `text-xl` | 20px | 副标题 |
| Body | `text-base` | 16px | 正文文本 |
| Caption | `text-sm` | 14px | 辅助说明 |
| Micro | `text-xs` | 12px | 标签、表格头 |

行高统一使用 `leading-6` (24px) 作为正文标准,标题根据需求调整。

### 3.3 字重

- **Regular (400)**: 普通文本
- **Medium (500)**: 标签、次级强调
- **Semibold (600)**: 标题、副标题

---

## 4. 间距系统

基于 **8px** 网格。

| Token | 数值 | 用途 |
|-------|------|------|
| `space-1` | 4px | 小间距,如图标与文字间距 |
| `space-2` | 8px | 元素之间的最小间距 |
| `space-3` | 12px | 表单项内间距 |
| `space-4` | 16px | 卡片内容间距 |
| `space-5` | 20px | 卡片与卡片之间 |
| `space-6` | 24px | 区块之间 |
| `space-8` | 32px | 页面主体与边距 |
| `space-10` | 40px | 页面大间距 |

---

## 5. 圆角与阴影

### 5.1 圆角

- 大圆角: `--radius = 0.8rem (~12.8px)` → 卡片、对话框
- 中圆角: `calc(var(--radius) - 2px)` → 按钮、输入框
- 小圆角: `calc(var(--radius) - 4px)` → 标签、徽章

### 5.2 阴影

- 卡片: `shadow-[0_12px_32px_-12px_rgba(15,23,42,0.25)]`
- 浮层: `shadow-[0_20px_50px_-15px_rgba(15,23,42,0.35)]`
- 按钮悬浮: `shadow-[0_8px_20px_-12px_rgba(79,70,229,0.45)]`

---

## 6. 布局规范

### 6.1 页面布局

- 页面最大宽度: `1280px`
- 顶部导航高度: `64px`
- 左侧侧边栏宽度: `240px`
- 内容区域: `calc(100% - 240px)`
- 响应式断点:
  - `lg`: 1024px (桌面)
  - `md`: 768px (平板)
  - `sm`: 640px (手机)

### 6.2 三栏布局 (周刊编辑器)

| 栏位 | 宽度 | 内容 |
|------|------|------|
| 左栏 | 25%-30% | 内容池、筛选 |
| 中栏 | 40%-45% | 周刊结构 |
| 右栏 | 25%-30% | 实时预览 |

---

## 7. 组件规范

### 7.1 按钮 (Button)

| 变体 | 用途 | 交互 |
|------|------|------|
| `default` | 主动操作 | 悬浮颜色加深,阴影增强 |
| `secondary` | 次要操作 | 悬浮背景变浅 |
| `outline` | 低强调,用于筛选 | 悬浮边框加深 |
| `ghost` | 图标按钮,无背景 | 悬浮背景浅灰 |
| `destructive` | 危险操作 | 悬浮颜色加深,需确认 |

### 7.2 输入组件 (Input, Textarea, Select)

- 默认高度: `h-10`
- 内边距: `px-3`
- 字体: `text-sm`
- 聚焦态: 边框颜色变为主色,阴影 `shadow-[0_0_0_4px_rgba(79,70,229,0.15)]`

### 7.3 表单布局

- 使用 12 列网格
- 常用布局:
  - 单列: `grid-cols-1`
  - 双列: `grid-cols-2 gap-6`
  - 三列: `grid-cols-3 gap-6`
- 表单组: `<div className="space-y-4">...</div>`

### 7.4 卡片 (Card)

- 结构:
  ```tsx
  <Card>
    <CardHeader>
      <CardTitle>标题</CardTitle>
      <CardDescription>说明</CardDescription>
    </CardHeader>
    <CardContent>
      {/* 内容 */}
    </CardContent>
    <CardFooter>
      {/* 操作 */}
    </CardFooter>
  </Card>
  ```
- 内边距:
  - Header: `p-6 pb-2`
  - Content: `p-6 pt-0`
  - Footer: `p-6 pt-0`

### 7.5 表格 (Data Table)

- 使用 shadcn `Table` + TanStack Table 数据层
- 样式:
  - 头部: `bg-muted/60 text-xs font-medium`
  - 行: `hover:bg-muted/50`
  - 单元格: `py-3 text-sm`
- 支持多选: `<Checkbox>` + `DataTableRowActions`

### 7.6 标签 (Badge)

| 变体 | 用途 |
|------|------|
| `default` | 状态标签(草稿/已发布/归档) |
| `secondary` | 分类标签 |
| `outline` | 标签云 |
| `destructive` | 错误状态 |

### 7.7 模态框 (Dialog)

- 动画: 淡入淡出 + 缩放
- 默认宽度: `max-w-2xl`
- header: `space-y-1`
- body: `py-4`
- footer: `flex justify-end gap-2`

---

## 8. 图表规范

- 图表背景: 卡片内,背景色 `--card`
- 图表标题: `text-sm font-medium text-muted-foreground`
- 图例: 可放在顶部或右侧
- 颜色方案: 使用主色系的不同透明度
  - Primary: `#6366F1`
  - Secondary: `#8B5CF6`
  - Accent: `#14B8A6`

---

## 9. 图标规范

- 图标库: `lucide-react`
- 图标尺寸: 16px (文本内), 20px (按钮), 24px (卡片标题)
- 颜色: 默认 `currentColor`, 根据上下文变化

---

## 10. 动效规范

- 按钮悬浮: `transition-all duration-200`
- 模态框: `fade-in-0 zoom-in-95`
- 页面切换: 使用 Framer Motion `Fade` 或 `Slide`
- 拖拽: 提供拖拽反馈阴影和缩放

---

## 11. 可访问性

- 所有交互元素必须有 `aria-label`
- 键盘导航顺序合理
- 颜色对比度 >= 4.5:1
- 动画提供减少选项(尊重系统 `prefers-reduced-motion`)
- 表单控件使用 `Label` 明确关联

---

## 12. 插图和图片

- 登录页背景: 可使用渐变或轻量抽象插图
- 内容预览: 图片宽度 100%,圆角 12px
- 头像: 使用 `Avatar` 组件,默认首字母

---

## 13. 内容规范

### 13.1 文案语气

- 专业但友好
- 简洁明了
- 使用动词开头的按钮文案: "创建周刊", "同步草稿"
- 错误提示具体: "保存失败,请检查网络连接"

### 13.2 表单提示

- 必填字段: 添加红色 `*`
- 错误提示: 文字 `text-sm text-destructive`
- 帮助文案: `text-xs text-muted-foreground`

---

## 14. 示例组件库

建议为关键组件建立 Storybook 或文档页面,便于查阅和复用。

- `/docs/storybook/login.md`
- `/docs/storybook/content-editor.md`
- `/docs/storybook/draft-card.md`

---

## 15. 更新记录

| 日期 | 更新内容 | 维护人 |
|------|----------|--------|
| 2025-01 | 创建设计系统初稿 | Agent |

---

> **说明**: 本设计系统会随着项目迭代持续更新。请所有设计、前端成员在提交 PR 前检查是否符合规范,如需调整请先讨论并更新此文档。

# Weekly 系统重构 - 技术架构说明

**版本**: v2.0  
**最后更新**: 2025年1月  
**维护人**: 前端团队

---

## 1. 总览

- **框架**: Next.js 15 + React 19 + TypeScript
- **状态管理**: Zustand + React Query (保持,视业务调整)
- **UI 库**: 全量迁移到 shadcn/ui + Radix UI 底层
- **主题**: tweakcn claude theme (品牌色 + 暗色模式)
- **样式体系**: Tailwind CSS + `cn()` 工具函数
- **图标**: lucide-react

---

## 2. 迁移策略

### 2.1 组件迁移路线图

| 阶段 | 页面/模块 | 说明 |
|------|-----------|------|
| P0 | `/login` | 独立页面,无全局依赖,确定基础样式体系 |
| P1 | 内容编辑器、预览器 | 核心业务,早迁移便于兼容数据格式 |
| P2 | 草稿管理、周刊编辑器 | 复杂交互,依赖 shadcn 组件完全迁移 |
| P3 | 仪表板、洞察、设置 | Live data dashboard,迁移后配合图表组件 |
| P4 | 操作日志、搜索 | 剩余页面,统一风格和交互 |

### 2.2 组件替换清单

| AntD 组件 | 替换方案 |
|-----------|-----------|
| `Form` + `Input` | shadcn `Form`, `Input`, `Textarea`, `Checkbox`, `Switch` |
| `Button` | shadcn `Button` (variant: default, outline, ghost) |
| `Card` | shadcn `Card` |
| `Table` | shadcn `Table` + TanStack Table 数据层 |
| `Modal` | Radix `Dialog` + shadcn 封装 |
| `Drawer` | Radix `Sheet` |
| `Tabs` | shadcn `Tabs` |
| `Select` | shadcn `Select` |
| `Dropdown` | shadcn `DropdownMenu` |
| `Tooltip` | shadcn `Tooltip` |
| `Menu` | 自定义导航 + Radix `NavigationMenu` |
| `Notification`/`Message` | shadcn `Toast` + `useToast` Hook |
| `Spin` | 自定义 `Loader` 组件 |
| `Avatar`, `Tag` | shadcn `Avatar`, `Badge` |

### 2.3 样式与主题

#### 2.3.1 claude theme 配置

```ts
// tailwind.config.ts
import { withTV } from 'tailwind-variants/transformer';
import { fontFamily } from 'tailwindcss/defaultTheme';

export default withTV({
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"SF Pro Display"', ...fontFamily.sans],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
});
```

#### 2.3.2 全局样式

- `src/app/globals.css`
  - 导入 tweakcn claude theme 变量
  - 定义暗色模式颜色
  - 重置样式

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 216 33% 98%;
  --foreground: 217 33% 17%;
  --card: 0 0% 100%;
  --card-foreground: 217 33% 17%;
  --popover: 0 0% 100%;
  --popover-foreground: 217 33% 17%;
  --primary: 232 95% 68%; // Claude 主题主色
  --primary-foreground: 218 94% 12%;
  --secondary: 215 20% 65%;
  --secondary-foreground: 217 33% 17%;
  --muted: 214 20% 85%;
  --muted-foreground: 217 20% 45%;
  --accent: 189 93% 42%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;
  --border: 214 20% 88%;
  --input: 214 20% 88%;
  --ring: 232 95% 68%;
  --radius: 0.8rem;
}

.dark {
  --background: 233 35% 10%;
  --foreground: 210 40% 98%;
  --card: 231 38% 15%;
  --card-foreground: 210 40% 98%;
  --popover: 231 38% 15%;
  --popover-foreground: 210 40% 98%;
  --primary: 232 94% 72%;
  --primary-foreground: 217 33% 17%;
  --secondary: 226 29% 24%;
  --secondary-foreground: 210 40% 98%;
  --muted: 226 29% 24%;
  --muted-foreground: 215 20% 65%;
  --accent: 189 93% 48%;
  --accent-foreground: 217 33% 17%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;
  --border: 226 29% 24%;
  --input: 226 29% 24%;
  --ring: 232 94% 72%;
}
```

---

## 3. 前端架构

### 3.1 目录结构调整

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── drafts/
│   │   ├── content/
│   │   ├── weekly/
│   │   ├── insights/
│   │   └── settings/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/          # shadcn 生成的基础组件
│   ├── shared/      # 跨页面复用组件
│   ├── charts/      # 图表组件
│   └── editors/     # 编辑器相关组件
├── lib/
│   ├── utils/
│   │   └── format-adapter.ts
│   ├── services/
│   │   ├── content.ts
│   │   ├── weekly.ts
│   │   └── operation-log.ts
│   ├── middleware/
│   └── api-client/
├── stores/
└── types/
```

### 3.2 状态管理策略

- **Zustand**: 保留,用于用户信息、全局 UI 状态(如当前周刊编辑状态)
- **React Query**: 数据获取与缓存
- **Server Actions** (Next.js 15特性,可选): 用于简单的表单提交

### 3.3 代码规范

- 使用 `@/lib/utils` 下的 `cn` 函数 (className merge)
- 使用 `use client` 指令仅在必要时添加
- 尽量使用 Server Components,必要时使用 Client Components
- 组件命名采用 PascalCase
- 文件命名采用 kebab-case

---

## 4. 数据兼容层

### 4.1 ContentFormatAdapter

详见 [MAIN_PRD.md](./MAIN_PRD.md#content-format-compat) 中的示例实现。

主要职责:
1. 检测内容格式 (Markdown vs JSON)
2. 转换 Markdown → 结构化数据
3. 将结构化数据转回 Markdown (用于导出)
4. 提供统一的渲染接口

### 4.2 编辑器组件设计

```tsx
import { useMemo } from 'react';
import { ContentFormatAdapter } from '@/lib/utils/format-adapter';
import { EditorState, useContentEditorStore } from '@/stores/content-editor';
import { MarkdownEditor } from '@/components/editors/markdown-editor';
import { StructuredEditor } from '@/components/editors/structured-editor';
import { ContentPreview } from '@/components/content/content-preview';

export function ContentEditorContainer({ content }: { content: string }) {
  const format = useMemo(() => ContentFormatAdapter.detectFormat(content), [content]);
  const { setFormat } = useContentEditorStore();

  useEffect(() => {
    setFormat(format);
  }, [format, setFormat]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        {format === 'json' ? (
          <StructuredEditor initialValue={ContentFormatAdapter.toStructured(content)} />
        ) : (
          <MarkdownEditor defaultValue={content} />
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <ContentPreview content={content} />
      </section>
    </div>
  );
}
```

### 4.3 预览渲染

- Markdown 渲染: `react-markdown` + `rehype-highlight`
- JSON 内容: 自定义渲染器,根据 `sections` 渲染

---

## 5. 操作日志修复

### 5.1 问题分析

- `resource_id` 类型不兼容: Prisma schema 使用 `Int`,导致 content 的 `BigInt` 无法保存
- 部分 API 未调用 `OperationLogService`
- 日志详情缺少对比信息,难以排查

### 5.2 改进方案

1. **数据层修复**
   - Prisma schema 调整 `resource_id` 为 `String`
   - 服务层兼容 BigInt 转换

```ts
export class OperationLogService {
  static async logOperation(...) {
    const normalizedResourceId = resourceId ? String(resourceId) : undefined;

    await prisma.operation_logs.create({
      data: {
        user_id: userId,
        operation_type: operationType,
        resource_type: resourceType,
        resource_id: normalizedResourceId,
        operation_details: operationDetails ? JSON.stringify(operationDetails) : undefined,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  }
}
```

2. **统一记录入口**
   - 在 `src/lib/services` 各业务方法中,操作成功后调用 `OperationLogger`
   - 对外暴露 Hook `useOperationLogger`

3. **日志结构增强**
   - `operation_details`: `{ before, after, diff, context }`
   - 增加 `request_id` 支持 (可选)

### 5.3 查询与展示优化

- 前端使用 shadcn `DataTable`
- 支持 JSON 反序列化,格式化展示
- 支持按 resource_type 和操作类型筛选

---

## 6. 数据可视化

### 6.1 图表库选择

- 推荐使用 `recharts` 或 `nivo`
- 结合 shadcn 卡片展示

### 6.2 图表组件规范

- `src/components/charts/` 下创建纯函数组件
- 每个图表组件接收干净的数据 props
- 不在图表组件内部发起请求

---

## 7. 构建与性能

### 7.1 Bundle 优化

- 按需导入 shadcn 组件
- 使用动态导入懒加载重组件
- 使用 React 19 `use` + Suspense(视情况)

### 7.2 性能监控

- 利用 Next.js `next/script` 注入性能监控
- 保留现有日志/监控系统

---

## 8. 可访问性与国际化

- Radix UI 默认可访问性良好
- 仍需为自定义交互添加 `aria-*` 属性
- 长期: 规划 i18n 支持

---

## 9. 测试策略

- 单元测试: 重点覆盖数据适配器、服务层
- 组件测试: 使用 React Testing Library
- 端到端测试: Playwright (优先覆盖关键流程)

---

## 10. 依赖清单 (迁移后)

```json
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.0",
    "@radix-ui/react-toast": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.322.0",
    "tailwind-merge": "^2.2.0",
    "tailwindcss-animate": "^1.0.7",
    "tweakcn": "^1.0.0" // 待确认实际包名
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.21",
    "autoprefixer": "^10.4.14"
  }
}
```

---

## 11. 风险与回退策略

- **UI 组件迁移失败**: 保留旧组件直到新组件验证通过
- **claude theme 不兼容**: 可 fallback 到默认主题,逐步调整
- **操作日志 schema 变更**: 提前备份数据,验证迁移脚本

---

## 12. 参考文档

- [MAIN_PRD.md](./MAIN_PRD.md)
- [TASKS.md](./TASKS.md)
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

---

> 本文档为工程团队的技术蓝图,任务实施时请结合 TASKS.md。提交代码前请确保相关文档已更新。

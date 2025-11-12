# Weekly 系统重构 - 迁移指南

**版本**: v1.0  
**最后更新**: 2025年1月  
**适用对象**: 开发人员

---

## 📋 目录

1. [迁移概述](#迁移概述)
2. [环境准备](#环境准备)
3. [UI 组件迁移](#ui-组件迁移)
4. [数据库迁移](#数据库迁移)
5. [路由调整](#路由调整)
6. [测试验证](#测试验证)
7. [上线部署](#上线部署)
8. [常见问题](#常见问题)

---

## 1. 迁移概述

### 1.1 迁移目标

- ✅ UI 库从 Ant Design 迁移到 shadcn/ui
- ✅ 采用 tweakcn claude theme
- ✅ 简化工作流程
- ✅ 修复操作日志问题
- ✅ 适配新老内容格式

### 1.2 迁移范围

| 模块 | 变更程度 | 说明 |
|------|----------|------|
| 登录页 | 🔴 完全重写 | 新 UI 组件 |
| 内容编辑 | 🟡 部分重写 | 新 UI + 格式适配 |
| 内容预览 | 🟡 部分重写 | 统一渲染逻辑 |
| 草稿管理 | 🔴 完全重写 | 简化流程 |
| 周刊编辑 | 🔴 完全重写 | 三栏布局 + 拖拽 |
| 仪表板 | 🟡 部分重写 | 简化数据展示 |
| 分析页 | 🟡 部分重写 | 聚焦内容指标 |
| 设置页 | 🟢 小幅调整 | 仅 UI 组件替换 |
| 操作日志 | 🟢 小幅调整 | Schema 修复 + UI 组件替换 |

### 1.3 迁移风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 组件迁移遗漏功能 | 高 | 详细的功能清单,逐项测试 |
| 数据库迁移失败 | 高 | 备份数据,验证迁移脚本 |
| 用户习惯改变 | 中 | 提供迁移指南,保持核心流程 |
| 性能回退 | 中 | 性能测试,优化打包 |

---

## 2. 环境准备

### 2.1 开发环境要求

- Node.js >= 20.x
- pnpm >= 8.x
- MySQL >= 8.0
- Git

### 2.2 安装依赖

```bash
# 拉取最新代码
git checkout feat-shadcn-claude-migrate-simplify-weekly-fix-oplog-prd-docs-data-adapt
git pull

# 安装依赖
pnpm install

# 生成 Prisma Client
npx prisma generate
```

### 2.3 环境变量配置

确保 `.env.local` 包含以下变量:

```env
# 数据库
DATABASE_URL="mysql://user:password@localhost:3306/weekly"

# JWT
JWT_SECRET="your-secret-key"

# MeiliSearch
MEILI_HOST="http://localhost:7700"
MEILI_MASTER_KEY="your-master-key"

# 其他配置
NODE_ENV="development"
```

### 2.4 数据库备份

**重要**: 迁移前必须备份数据库!

```bash
# 备份数据库
mysqldump -u root -p weekly > backup_$(date +%Y%m%d_%H%M%S).sql

# 或使用脚本
npm run db:backup
```

---

## 3. UI 组件迁移

### 3.1 shadcn/ui 安装

#### 步骤 1: 安装核心依赖

```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-slot @radix-ui/react-toast @radix-ui/react-tabs \
  @radix-ui/react-select @radix-ui/react-checkbox @radix-ui/react-switch

pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add tailwindcss-animate
```

#### 步骤 2: 初始化 shadcn/ui

```bash
npx shadcn@latest init
```

选择以下配置:
- **Style**: default
- **Base color**: slate
- **CSS variables**: yes
- **React Server Components**: no
- **TypeScript**: yes

#### 步骤 3: 安装基础组件

```bash
npx shadcn@latest add button card input label textarea
npx shadcn@latest add select checkbox switch toast
npx shadcn@latest add dialog dropdown-menu tabs table
npx shadcn@latest add badge avatar separator
```

#### 步骤 4: 配置 claude theme

编辑 `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
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
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

编辑 `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 216 33% 98%;
    --foreground: 217 33% 17%;
    --card: 0 0% 100%;
    --card-foreground: 217 33% 17%;
    --popover: 0 0% 100%;
    --popover-foreground: 217 33% 17%;
    --primary: 232 95% 68%;
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
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### 3.2 组件替换对照表

| Ant Design | shadcn/ui | 说明 |
|------------|-----------|------|
| `<Button>` | `<Button>` | 直接替换,注意 `type` → `variant` |
| `<Input>` | `<Input>` | 需配合 `<Label>` |
| `<Form>` | `react-hook-form` + shadcn | 需重构表单逻辑 |
| `<Card>` | `<Card>` | 结构调整: `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>` |
| `<Modal>` | `<Dialog>` | 结构不同,需调整 |
| `<Table>` | `<Table>` or `@tanstack/react-table` | 简单表格用 shadcn,复杂用 TanStack |
| `<Select>` | `<Select>` | 结构不同 |
| `<Message>` | `<Toast>` + `useToast` | 需重构调用方式 |
| `<Spin>` | 自定义 `Loader` | 使用 lucide-react 图标 |

### 3.3 迁移步骤示例: 登录页

#### 原代码 (Ant Design):

```tsx
import { Form, Input, Button, Card } from 'antd';

export default function LoginPage() {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    // ...
  };

  return (
    <Card>
      <Form form={form} onFinish={onFinish}>
        <Form.Item name="username" rules={[{ required: true }]}>
          <Input placeholder="用户名" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true }]}>
          <Input.Password placeholder="密码" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            登录
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
```

#### 新代码 (shadcn/ui):

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const loginSchema = z.object({
  username: z.string().min(2, '用户名至少2个字符'),
  password: z.string().min(6, '密码至少6个字符'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      // 登录逻辑
      toast({
        title: '登录成功',
        description: '正在跳转...',
      });
    } catch (error) {
      toast({
        title: '登录失败',
        description: '用户名或密码错误',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Weekly 管理系统</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                placeholder="请输入用户名"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 4. 数据库迁移

### 4.1 操作日志表修改

#### 修改 Prisma Schema

编辑 `prisma/schema.prisma`:

```prisma
model operation_logs {
  id                Int                           @id @default(autoincrement())
  user_id           Int
  operation_type    operation_logs_operation_type
  resource_type     String                        @db.VarChar(50)
  resource_id       String?                       @db.VarChar(50) // 改为 String
  operation_details String?                       @db.Text
  ip_address        String?                       @db.VarChar(45)
  user_agent        String?                       @db.Text
  created_at        DateTime?                     @default(now()) @db.Timestamp(0)

  user users @relation(fields: [user_id], references: [id])

  @@index([operation_type], map: "idx_operation_type")
  @@index([resource_type], map: "idx_resource_type")
  @@index([user_id], map: "idx_user_id")
  @@index([resource_id], map: "idx_resource_id") // 新增
}
```

#### 生成迁移

```bash
npx prisma migrate dev --name change_operation_logs_resource_id_to_string
```

#### 验证迁移

```bash
# 查看迁移 SQL
cat prisma/migrations/<timestamp>_change_operation_logs_resource_id_to_string/migration.sql

# 应该包含:
# ALTER TABLE `operation_logs` MODIFY COLUMN `resource_id` VARCHAR(50);
# CREATE INDEX `idx_resource_id` ON `operation_logs`(`resource_id`);
```

#### 应用到生产(谨慎!)

```bash
# 先在测试环境验证
npx prisma migrate deploy --preview-feature

# 确认无误后,在生产环境执行
npx prisma migrate deploy
```

### 4.2 数据清理(可选)

如果有历史错误数据:

```sql
-- 删除 resource_id 为 NULL 且不应该为 NULL 的记录
DELETE FROM operation_logs 
WHERE resource_id IS NULL 
  AND resource_type IN ('content', 'weekly_issue', 'draft');

-- 或者修复历史数据
UPDATE operation_logs 
SET resource_id = '0' 
WHERE resource_id IS NULL 
  AND resource_type IN ('content', 'weekly_issue', 'draft');
```

---

## 5. 路由调整

### 5.1 新路由结构

```
src/app/
├── (auth)/
│   └── login/
│       └── page.tsx
├── (dashboard)/
│   ├── layout.tsx
│   ├── page.tsx              # 仪表板
│   ├── drafts/
│   │   └── page.tsx          # 草稿管理
│   ├── content/
│   │   ├── page.tsx          # 内容列表
│   │   ├── new/
│   │   │   └── page.tsx      # 新建内容
│   │   └── [id]/
│   │       └── page.tsx      # 编辑内容
│   ├── weekly/
│   │   ├── page.tsx          # 周刊列表
│   │   ├── new/
│   │   │   └── page.tsx      # 创建周刊
│   │   └── [id]/
│   │       ├── edit/
│   │       │   └── page.tsx  # 编辑周刊
│   │       └── preview/
│   │           └── page.tsx  # 预览周刊
│   ├── insights/
│   │   └── page.tsx          # 内容洞察
│   └── settings/
│       ├── page.tsx          # 个人设置
│       ├── tags/
│       │   └── page.tsx      # 标签管理
│       ├── categories/
│       │   └── page.tsx      # 分类管理
│       └── logs/
│           └── page.tsx      # 操作日志
├── layout.tsx
└── page.tsx                  # 重定向到 /dashboard
```

### 5.2 重定向配置

编辑 `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
```

或在 `next.config.ts` 添加重定向:

```typescript
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
      // 旧路由重定向
      {
        source: '/content/list',
        destination: '/content',
        permanent: false,
      },
      {
        source: '/content/editor/:id',
        destination: '/content/:id',
        permanent: false,
      },
    ];
  },
};
```

---

## 6. 测试验证

### 6.1 功能测试清单

- [ ] 登录/退出
- [ ] 草稿同步
- [ ] 草稿列表查看
- [ ] 草稿预览
- [ ] 草稿加入周刊
- [ ] 内容创建
- [ ] 内容编辑(Markdown 格式)
- [ ] 内容编辑(JSON 格式)
- [ ] 内容预览
- [ ] 内容发布
- [ ] 周刊创建
- [ ] 周刊编辑(拖拽)
- [ ] 周刊预览
- [ ] 周刊发布
- [ ] 搜索功能
- [ ] 筛选功能
- [ ] 标签管理
- [ ] 分类管理
- [ ] 操作日志查看
- [ ] 用户设置

### 6.2 浏览器兼容性测试

- [ ] Chrome (最新版)
- [ ] Firefox (最新版)
- [ ] Safari (最新版)
- [ ] Edge (最新版)
- [ ] 移动端 Safari
- [ ] 移动端 Chrome

### 6.3 响应式测试

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### 6.4 性能测试

```bash
# Lighthouse 测试
npx lighthouse http://localhost:3000 --view

# 目标分数:
# Performance: > 90
# Accessibility: > 90
# Best Practices: > 90
# SEO: > 90
```

---

## 7. 上线部署

### 7.1 部署前检查

- [ ] 所有测试通过
- [ ] 数据库已备份
- [ ] 环境变量已配置
- [ ] 依赖已更新
- [ ] 构建成功

### 7.2 构建生产版本

```bash
# 构建
pnpm build

# 检查构建输出
ls -lh .next/

# 本地测试生产版本
pnpm start
```

### 7.3 数据库迁移(生产)

```bash
# 在生产服务器执行
npx prisma migrate deploy
```

### 7.4 部署

```bash
# 根据你的部署方式
# Docker
docker build -t weekly-admin:v2 .
docker run -p 3000:3000 weekly-admin:v2

# PM2
pm2 restart weekly-admin

# 或其他部署方式
```

### 7.5 监控和回滚

```bash
# 监控日志
pm2 logs weekly-admin

# 如有问题,回滚
git revert HEAD
pnpm build
pm2 restart weekly-admin

# 或回滚数据库
mysql -u root -p weekly < backup_20250115_120000.sql
```

---

## 8. 常见问题

### Q1: shadcn 组件样式不生效?

**A**: 检查 `tailwind.config.ts` 的 `content` 配置是否包含了 `src/components/ui/**/*.{ts,tsx}`。

### Q2: 表单验证不工作?

**A**: 确保安装了 `@hookform/resolvers` 和 `zod`,并正确配置了 `zodResolver`。

### Q3: 操作日志迁移后数据丢失?

**A**: `resource_id` 从 `Int` 改为 `String`,原有数据应该会自动转换。如果有问题,检查迁移 SQL。

### Q4: 内容格式检测不准确?

**A**: 检查 `ContentFormatAdapter.detectFormat` 方法,确保 JSON.parse 错误处理正确。

### Q5: 拖拽功能不工作?

**A**: 确保安装了 `@dnd-kit/core` 和 `@dnd-kit/sortable`,并正确配置了 DndContext。

### Q6: 页面加载慢?

**A**: 检查是否有大量同步请求,使用 React Query 的 `suspense` 模式或动态导入懒加载组件。

### Q7: 暗色模式不工作?

**A**: 确保在 `tailwind.config.ts` 中设置了 `darkMode: ['class']`,并在 root 元素添加 `dark` 类。

### Q8: 部署后 API 路由 404?

**A**: 检查 `next.config.ts` 的 `basePath` 和 `assetPrefix` 配置,确保 API 路由路径正确。

---

## 9. 回退计划

如果迁移失败,按以下步骤回退:

### 9.1 代码回退

```bash
# 回退到迁移前的提交
git log --oneline
git revert <commit-hash>

# 或创建新分支
git checkout -b rollback-migration
```

### 9.2 数据库回退

```bash
# 恢复备份
mysql -u root -p weekly < backup_20250115_120000.sql

# 或回滚迁移
npx prisma migrate resolve --rolled-back <migration-name>
```

### 9.3 重新部署旧版本

```bash
# 构建旧版本
pnpm build

# 部署
pm2 restart weekly-admin
```

---

## 10. 附录

### A. 相关文档

- [MAIN_PRD.md](./MAIN_PRD.md)
- [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)
- [TASKS.md](./TASKS.md)
- [COMPLETED_TASKS.md](./COMPLETED_TASKS.md)

### B. 参考资源

- [shadcn/ui 官方文档](https://ui.shadcn.com/)
- [Radix UI 文档](https://www.radix-ui.com/)
- [React Hook Form 文档](https://react-hook-form.com/)
- [Zod 文档](https://zod.dev/)
- [Prisma 迁移文档](https://www.prisma.io/docs/concepts/components/prisma-migrate)

---

> **文档维护**: 迁移过程中遇到的问题和解决方案请及时更新到此文档。

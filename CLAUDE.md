# Weekly Admin - AI 上下文文档

## 项目概述

Weekly Admin 是一个基于 Next.js 15 的周刊内容管理系统，用于管理和发布技术周刊内容。

## 技术栈

- **框架**: Next.js 15.4.4 (App Router)
- **语言**: TypeScript 5.x
- **UI**: shadcn/ui + Radix UI + Tailwind CSS 4.x
- **数据库**: MySQL (Prisma ORM 6.x)
- **搜索**: Meilisearch
- **状态管理**: Zustand + TanStack Query v5
- **表单**: React Hook Form + Zod
- **包管理**: pnpm

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # 仪表板路由组
│   │   ├── content/        # 内容管理 (CRUD、草稿)
│   │   ├── weekly/         # 周刊管理 (编辑器、预览)
│   │   ├── search/         # 全局搜索
│   │   ├── analytics/      # 数据分析
│   │   └── settings/       # 系统设置 (分类、标签、AI)
│   ├── api/                # API 路由
│   └── login/              # 登录页面
├── components/             # React 组件
│   ├── ui/                 # shadcn/ui 基础组件
│   ├── layout/             # 布局组件 (侧边栏、头部)
│   ├── content/            # 内容相关组件
│   ├── weekly/             # 周刊相关组件
│   └── drafts/             # 草稿相关组件
├── hooks/                  # 自定义 Hooks
│   └── queries/            # React Query Hooks
├── lib/                    # 工具库
│   ├── services/           # 业务服务层
│   ├── validations/        # Zod 验证模式
│   └── middleware/         # 中间件
├── stores/                 # Zustand 状态
└── types/                  # TypeScript 类型
```

## 核心模块

### 内容管理 (`/content`)
- 内容 CRUD 操作
- Markdown/MDX 编辑器
- 截图粘贴上传
- 草稿箱 (Karakeep 同步)

### 周刊管理 (`/weekly`)
- 三栏式编辑器 (内容池 | 编辑区 | 预览区)
- 拖拽排序
- 周刊预览和发布

### 搜索 (`/search`)
- Meilisearch 全文搜索
- 高级筛选

## 数据模型

主要表:
- `contents` - 内容表
- `drafts` - 草稿表 (Karakeep 同步)
- `weekly_issues` - 周刊期数
- `weekly_content_items` - 周刊内容项
- `categories` - 分类
- `tags` - 标签
- `users` - 用户 (ADMIN/EDITOR)

## 常用命令

```bash
pnpm dev              # 开发服务器
pnpm build            # 生产构建
pnpm lint             # ESLint 检查
pnpm type-check       # 类型检查
pnpm test             # 运行测试
pnpm db:generate      # 生成 Prisma 客户端
pnpm db:pull          # 同步数据库 schema
```

## 代码规范

- 使用 2 空格缩进，单引号
- 组件文件使用 PascalCase
- Hooks 使用 `useX` 命名
- 提交前运行 `pnpm lint` 和 `pnpm type-check`
- 遵循 Conventional Commits 规范

## UI 设计规范

- **桌面优先**: 最小宽度 1024px+
- **主题**: Slate 冷灰色调
- **圆角**: 使用 `rounded` (4px/6px)
- **阴影**: 使用 `shadow-sm` 区分层级

## 关键文件

- `src/lib/db.ts` - Prisma 客户端
- `src/lib/auth-middleware.ts` - 认证中间件
- `src/lib/search.ts` - Meilisearch 集成
- `prisma/schema.prisma` - 数据库模型

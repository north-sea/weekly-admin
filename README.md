# Weekly 内容管理系统

基于 Next.js 15 的周刊内容管理系统，支持内容创建、编辑、搜索、周刊发布和 Newsletter 邮件订阅等功能。

## 主要功能

- **内容管理**: 创建、编辑、分类、标签管理
- **草稿箱**: 支持 Karakeep 同步
- **周刊编辑器**: 三栏式拖拽编辑器
- **全文搜索**: Meilisearch 集成
- **Newsletter 发布**: Quail 平台集成，支持邮件订阅

## 技术栈

- **框架**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS 4
- **数据库**: MySQL + Prisma ORM
- **搜索**: Meilisearch
- **状态管理**: Zustand + TanStack Query v5
- **Newsletter**: Quail API

---

## 快速开始

### 本地开发环境

**不需要Docker！** 本地开发直接运行Node.js应用。

#### 1. 环境准备

```bash
# 安装依赖
pnpm install

# 复制开发环境配置（用于本地开发）
cp env.development.example .env

# 编辑配置文件
vim .env
```

#### 2. 配置外部服务连接

确保以下服务正在运行：
- **MySQL数据库**：NAS服务器 (100.113.231.101:3306)
- **Meilisearch**：本地容器 (localhost:7700)

#### 3. 启动开发服务器

```bash
# 生成Prisma客户端
pnpm db:generate

# 启动开发服务器（使用Turbopack）
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 开始开发。

**📋 详细开发指南：[本地开发指南.md](本地开发指南.md)**

### Quail Newsletter 配置

要启用 Newsletter 功能，需要配置以下环境变量：

```bash
# Quail Newsletter 配置
QUAIL_API_HOST="https://api.quail.ink"    # API 基础地址
QUAIL_API_KEY="your-quail-api-key"        # API 密钥
QUAIL_CHANNEL_SLUG="your-channel-slug"    # 频道 slug
QUAIL_LIST_ID="your-list-id"              # 列表 ID（用于订阅者管理）
```

获取配置值：
1. **API Key**: [Quail Dashboard](https://quail.ink) → Profile → API Keys
2. **Channel Slug**: 频道 URL 中的 slug，如 `https://quail.ink/your-channel` 中的 `your-channel`
3. **List ID**: 在频道设置中获取

详细 API 文档：[docs/quail-api.md](docs/quail-api.md)

### 生产环境部署

使用 Docker 容器化部署。详细说明：

- [Docker 部署文档](docker/README.md)
- [快速部署指南](docker/快速部署指南.md)

---

## 常用命令

```bash
pnpm dev              # 开发服务器
pnpm build            # 生产构建
pnpm lint             # ESLint 检查
pnpm type-check       # 类型检查
pnpm db:generate      # 生成 Prisma 客户端
pnpm db:pull          # 同步数据库 schema
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # 仪表板路由组
│   │   ├── content/        # 内容管理
│   │   ├── weekly/         # 周刊管理
│   │   ├── publish/        # Newsletter 发布
│   │   └── settings/       # 系统设置
│   └── api/                # API 路由
│       └── quail/          # Quail Newsletter API
├── components/             # React 组件
├── hooks/queries/          # React Query Hooks
├── lib/services/           # 业务服务层
└── stores/                 # Zustand 状态
```

## 文档

- [Quail API 集成文档](docs/quail-api.md) - Newsletter 功能开发指南

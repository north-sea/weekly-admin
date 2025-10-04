# Weekly内容管理系统

本项目是基于Next.js的周刊内容管理系统，支持内容创建、编辑、搜索和周刊发布等功能。

## 🚀 快速开始

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

### 生产环境部署

**使用Docker容器化部署到NAS服务器。** 详细部署说明请查看：

📋 **[Docker部署文档](docker/README.md)**
📋 **[快速部署指南](docker/快速部署指南.md)**

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

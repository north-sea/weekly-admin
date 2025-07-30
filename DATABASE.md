# 数据库配置说明

## 环境配置

1. 复制环境配置文件：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入正确的数据库连接信息：
   ```env
   DATABASE_URL="mysql://username:password@host:port/database_name"
   ```

## 数据库初始化

1. 从现有数据库拉取 schema：
   ```bash
   pnpm run db:pull
   ```

2. 生成 Prisma 客户端：
   ```bash
   pnpm run db:generate
   ```

3. 运行数据库迁移（创建缺失的表）：
   ```bash
   pnpm run db:migrate
   ```

## 可用脚本

- `pnpm run db:pull` - 从数据库拉取最新的 schema
- `pnpm run db:generate` - 生成 Prisma 客户端
- `pnpm run db:migrate` - 运行数据库迁移脚本

## 安全注意事项

- 永远不要将 `.env` 文件提交到版本控制系统
- 生产环境请使用强密码和安全的连接字符串
- 定期更新 JWT_SECRET
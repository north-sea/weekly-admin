#!/bin/bash

echo "🔄 切换到 MySQL 数据库..."

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "❌ .env 文件不存在，请先创建 .env 文件"
    exit 1
fi

# 备份当前的 .env 文件
cp .env .env.backup

# 更新 .env 文件 - 启用 MySQL，禁用 SQLite
sed -i '' 's|^DATABASE_URL="file:|# DATABASE_URL="file:|' .env
sed -i '' 's|^# DATABASE_URL="mysql:|DATABASE_URL="mysql:|' .env

# 更新 Prisma schema
sed -i '' 's|provider = "sqlite"|provider = "mysql"|' prisma/schema.prisma

echo "✅ 配置已更新为 MySQL"
echo "📝 请手动检查 .env 文件中的 MySQL 连接字符串是否正确"
echo "📝 然后运行以下命令完成切换："
echo "   pnpm prisma db pull"
echo "   pnpm prisma generate"
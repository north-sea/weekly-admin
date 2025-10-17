#!/bin/bash

# 执行 SQL 迁移脚本
# 用法: ./scripts/run-sql-migration.sh database/add_content_preview_fields.sql

set -e

SQL_FILE="${1:-database/add_content_preview_fields.sql}"

if [ ! -f "$SQL_FILE" ]; then
  echo "错误: SQL 文件不存在: $SQL_FILE"
  exit 1
fi

echo "========================================="
echo "执行 SQL 迁移"
echo "========================================="
echo "SQL 文件: $SQL_FILE"
echo ""

# 从 .env 文件读取数据库连接信息
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 提取数据库连接信息
if [ -z "$DATABASE_URL" ]; then
  echo "错误: 未找到 DATABASE_URL 环境变量"
  exit 1
fi

echo "正在执行 SQL 迁移..."
echo ""

# 使用 Prisma 的数据库连接执行 SQL
# 或者直接使用 mysql 命令
mysql --defaults-extra-file=<(echo "[client]"; echo "user=weekly_user"; echo "password=weekly_20250629_@NAS"; echo "host=100.113.231.101") weekly_blog < "$SQL_FILE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SQL 迁移执行成功"
else
  echo ""
  echo "❌ SQL 迁移执行失败"
  exit 1
fi






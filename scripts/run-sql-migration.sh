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

echo "正在执行 SQL 迁移..."
echo ""

# 提取数据库连接信息
if [ -z "$DATABASE_URL" ]; then
  echo "错误: 未找到 DATABASE_URL 环境变量"
  exit 1
fi

# 使用 Node + mysql2 执行 SQL, 避免本地 mysql 客户端兼容性问题
SQL_FILE="$SQL_FILE" node << 'NODE'
const fs = require('fs');
const path = require('path');

async function main() {
  const { DATABASE_URL, SQL_FILE } = process.env;

  if (!DATABASE_URL) {
    console.error('错误: 未找到 DATABASE_URL 环境变量');
    process.exit(1);
  }

  if (!SQL_FILE) {
    console.error('错误: 未提供 SQL_FILE 环境变量');
    process.exit(1);
  }

  const sqlPath = path.resolve(SQL_FILE);

  if (!fs.existsSync(sqlPath)) {
    console.error('错误: SQL 文件不存在:', sqlPath);
    process.exit(1);
  }

  const mysql = require('mysql2/promise');

  try {
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // 简单按分号拆分多条语句, 过滤掉空语句
    const statements = sqlContent
      .split(/;\s*[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (statements.length === 0) {
      console.log('没有需要执行的 SQL 语句');
      return;
    }

    const connection = await mysql.createConnection(DATABASE_URL);

    for (const stmt of statements) {
      console.log('执行 SQL:', stmt);
      await connection.query(stmt);
    }

    await connection.end();
    console.log('');
    console.log('✅ SQL 迁移执行成功 (via mysql2)');
  } catch (error) {
    console.error('');
    console.error('❌ SQL 迁移执行失败:');
    console.error(error);
    process.exit(1);
  }
}

main();
NODE

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SQL 迁移执行成功"
else
  echo ""
  echo "❌ SQL 迁移执行失败"
  exit 1
fi



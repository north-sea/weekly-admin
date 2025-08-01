#!/bin/bash

# NAS 服务器更新脚本
# 在 NAS 服务器上运行此脚本来更新应用程序

set -e

echo "🔄 更新周刊内容管理系统..."

# 拉取最新镜像
echo "📥 拉取最新镜像..."
docker-compose pull app

# 重启应用程序
echo "🔄 重启应用程序..."
docker-compose up -d app

# 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo "✅ 更新完成！"

# 显示运行状态
echo ""
echo "📊 服务状态:"
docker-compose ps
#!/bin/bash

# 构建和推送 Docker 镜像脚本
# 使用方法: ./scripts/build-and-push.sh [version]
#
# 支持两种模式：
# 1. 本地构建模式 (DOCKER_REGISTRY为空): 仅构建本地镜像，用于save/load传输
# 2. Registry模式 (DOCKER_REGISTRY有值): 构建并推送到指定仓库，支持远程拉取
#
# 示例:
#   DOCKER_REGISTRY="" ./scripts/build-and-push.sh v1.0.0          # 本地构建
#   DOCKER_REGISTRY="registry.nas.local:5000" ./scripts/build-and-push.sh v1.0.0  # 推送到私有registry
#   DOCKER_REGISTRY="your-username" ./scripts/build-and-push.sh v1.0.0            # 推送到Docker Hub

set -e

# 配置
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}
IMAGE_NAME="weekly-content-management"
VERSION=${1:-$(date +%Y%m%d-%H%M%S)}

# 如果有 registry，添加前缀
# 解释: registry前缀决定了镜像的分发方式
# - 无前缀: 本地镜像，需要手动传输到目标服务器
# - 有前缀: 可通过docker pull从远程仓库拉取
if [ -n "$DOCKER_REGISTRY" ]; then
    FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}"
    echo "🌐 Registry模式: 将推送到 ${DOCKER_REGISTRY}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}"
    echo "🏠 本地模式: 仅构建本地镜像"
fi

echo "🏗️  构建 Docker 镜像..."
echo "镜像名称: ${FULL_IMAGE_NAME}:${VERSION}"

# 构建镜像
docker build -t "${FULL_IMAGE_NAME}:${VERSION}" .
docker tag "${FULL_IMAGE_NAME}:${VERSION}" "${FULL_IMAGE_NAME}:latest"

echo "✅ 镜像构建完成"

# 推送镜像（如果配置了 registry）
# 解释: Registry推送让NAS服务器可以通过docker pull获取镜像
# 如果没有registry，需要通过save/load或其他方式传输镜像文件
if [ -n "$DOCKER_REGISTRY" ]; then
    echo "📤 推送镜像到 registry..."
    docker push "${FULL_IMAGE_NAME}:${VERSION}"
    docker push "${FULL_IMAGE_NAME}:latest"
    echo "✅ 镜像推送完成"
    
    echo ""
    echo "🚀 Registry部署信息:"
    echo "镜像: ${FULL_IMAGE_NAME}:${VERSION}"
    echo "最新: ${FULL_IMAGE_NAME}:latest"
    echo ""
    echo "📋 NAS服务器部署步骤:"
    echo "1. 更新.env文件: APP_VERSION=${VERSION}"
    echo "2. 执行: docker compose -f docker/docker-compose.prod.yml pull"
    echo "3. 执行: docker compose -f docker/docker-compose.prod.yml up -d"
else
    echo "ℹ️  未配置 DOCKER_REGISTRY，跳过推送"
    echo ""
    echo "🚀 本地镜像信息:"
    echo "镜像: ${FULL_IMAGE_NAME}:${VERSION}"
    echo "最新: ${FULL_IMAGE_NAME}:latest"
    echo ""
    echo "📋 手动传输到NAS服务器:"
    echo "1. 导出镜像: docker save ${FULL_IMAGE_NAME}:${VERSION} | gzip > weekly-admin-${VERSION}.tar.gz"
    echo "2. 传输文件: scp weekly-admin-${VERSION}.tar.gz nas:/tmp/"
    echo "3. NAS导入: gunzip -c /tmp/weekly-admin-${VERSION}.tar.gz | docker load"
    echo "4. 更新.env: APP_VERSION=${VERSION}"
    echo "5. 重启服务: docker compose -f docker/docker-compose.prod.yml up -d"
fi

echo ""
echo "📝 记住更新 NAS 服务器上的 .env 文件:"
echo "APP_VERSION=${VERSION}"
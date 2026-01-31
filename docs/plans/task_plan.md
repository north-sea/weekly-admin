# Task Plan: Docker CI/CD 部署优化

**Created**: 2026-01-31
**PRD Reference**: [docker-cicd-optimization-prd.md](../docker-cicd-optimization-prd.md)
**Status**: `not_started`

---

## Goal

将 Weekly Admin 项目的 Docker 构建+部署总时长控制在 5 分钟内，最小化服务停机时间，并实现部署失败自动回滚 + 企业微信通知。

---

## Success Criteria

- [ ] 构建+部署总时长 ≤ 5 分钟
- [ ] 服务停机时间 ≤ 30 秒
- [ ] 部署失败时自动回滚到上一版本
- [ ] 企业微信收到部署状态通知

---

## Phases

### Phase 1: 准备工作
**Status**: `not_started`
**Estimated Tasks**: 2

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1.1 | 移动 `.dockerignore` 到项目根目录 | `pending` | 从 `docker/.dockerignore` 移动 |
| 1.2 | 确认 GitHub Secrets 配置 | `pending` | 需要 `WECOM_WEBHOOK_URL` |

**Acceptance Criteria**:
- [ ] `.dockerignore` 位于项目根目录
- [ ] 用户已配置 `WECOM_WEBHOOK_URL` Secret

---

### Phase 2: Dockerfile 优化
**Status**: `not_started`
**Estimated Tasks**: 4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 2.1 | 使用 corepack 替代手动安装 pnpm | `pending` | `corepack enable && corepack prepare pnpm@latest --activate` |
| 2.2 | 优化 deps 阶段 COPY 顺序 | `pending` | 先复制 package.json、pnpm-lock.yaml |
| 2.3 | 优化 builder 阶段 COPY 顺序 | `pending` | 先复制 prisma/，再复制源码 |
| 2.4 | 移除 runner 阶段的 pnpm 安装 | `pending` | standalone 模式不需要 pnpm |

**Acceptance Criteria**:
- [ ] 依赖未变动时，依赖安装层命中缓存
- [ ] runner 阶段镜像体积减少

**Files to Modify**:
- `docker/Dockerfile`

---

### Phase 3: GitHub Actions 优化
**Status**: `not_started`
**Estimated Tasks**: 4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 3.1 | 添加 pnpm/action-setup 和 Node.js 缓存 | `pending` | 使用 `pnpm/action-setup@v4` |
| 3.2 | 设置 `platforms: linux/amd64` | `pending` | 避免多平台构建 |
| 3.3 | 禁用 provenance 和 sbom | `pending` | 减少镜像层数 |
| 3.4 | 精简镜像标签策略 | `pending` | 仅保留 latest 和 sha |

**Acceptance Criteria**:
- [ ] pnpm store 缓存在 Actions 中复用
- [ ] 镜像推送层数减少

**Files to Modify**:
- `.github/workflows/deploy.yml`

---

### Phase 4: NAS 部署流程优化
**Status**: `not_started`
**Estimated Tasks**: 5

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 4.1 | 调整部署顺序：先 pull 再 stop | `pending` | 减少停机时间 |
| 4.2 | 部署前记录旧镜像 ID | `pending` | 用于回滚 |
| 4.3 | 实现健康检查失败自动回滚 | `pending` | 使用旧镜像重启容器 |
| 4.4 | 使用 docker compose 简化部署 | `pending` | `docker compose up -d --force-recreate` |
| 4.5 | 部署成功后清理悬空镜像 | `pending` | `docker image prune -f` |

**Acceptance Criteria**:
- [ ] 停机时间仅为容器启动时间
- [ ] 健康检查失败时自动回滚
- [ ] 旧镜像被清理

**Files to Modify**:
- `.github/workflows/deploy.yml` (deploy job)

---

### Phase 5: 企业微信通知
**Status**: `not_started`
**Estimated Tasks**: 3

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 5.1 | 创建通知函数/脚本 | `pending` | 封装 Webhook 调用逻辑 |
| 5.2 | 添加部署成功通知 | `pending` | 包含版本号、耗时 |
| 5.3 | 添加部署失败/回滚通知 | `pending` | 包含错误摘要 |

**Acceptance Criteria**:
- [ ] 部署成功时收到成功通知
- [ ] 部署失败时收到失败通知
- [ ] 触发回滚时收到回滚通知

**Files to Modify**:
- `.github/workflows/deploy.yml`

---

### Phase 6: 测试验证
**Status**: `not_started`
**Estimated Tasks**: 3

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 6.1 | 本地测试 Dockerfile 构建 | `pending` | 验证缓存命中 |
| 6.2 | 触发 GitHub Actions 完整流程 | `pending` | push 测试提交 |
| 6.3 | 验证企业微信通知 | `pending` | 确认收到通知 |

**Acceptance Criteria**:
- [ ] 构建+部署总时长 ≤ 5 分钟
- [ ] 企业微信收到通知
- [ ] 服务正常运行

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `docker/.dockerignore` | Move to root | Phase 1 |
| `.dockerignore` | Create (from docker/) | Phase 1 |
| `docker/Dockerfile` | Modify | Phase 2 |
| `.github/workflows/deploy.yml` | Modify | Phase 3, 4, 5 |

---

## Errors Encountered

| Error | Phase | Attempt | Resolution |
|-------|-------|---------|------------|
| (none yet) | - | - | - |

---

## Notes

- NAS 已配置 Docker daemon HTTP_PROXY
- 用户需要在 GitHub Secrets 中配置 `WECOM_WEBHOOK_URL`
- 保持 SSH 主动部署方式，不使用 Watchtower

---

## Timeline

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | 准备工作 | `not_started` |
| Phase 2 | Dockerfile 优化 | `not_started` |
| Phase 3 | GitHub Actions 优化 | `not_started` |
| Phase 4 | NAS 部署流程优化 | `not_started` |
| Phase 5 | 企业微信通知 | `not_started` |
| Phase 6 | 测试验证 | `not_started` |

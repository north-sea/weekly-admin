# Product Requirements Document: Docker CI/CD 部署优化

**Version**: 1.0
**Date**: 2026-01-31
**Author**: Sarah (Product Owner)
**Quality Score**: 92/100

---

## Executive Summary

Weekly Admin 项目当前已具备完整的 Docker 构建和 GitHub Actions 自动部署流程，但在构建速度、缓存利用率和部署停机时间方面存在优化空间。本次优化旨在将整体构建+部署时间控制在 5 分钟内，同时减少服务停机时间，并增加部署失败时的自动回滚和企业微信通知能力。

优化涵盖三个层面：Dockerfile 多阶段构建优化、GitHub Actions 缓存策略优化、NAS 部署流程优化。通过这些改进，开发者在 push 代码后能更快地看到变更生效，同时降低部署风险。

---

## Problem Statement

**Current Situation**:
- Dockerfile 中 pnpm 在多个阶段重复安装，浪费构建时间
- `COPY . .` 在依赖安装后执行，任何源码变动都会破坏依赖缓存
- GitHub Actions 未充分利用 pnpm store 缓存
- NAS 部署时先停止容器再拉取镜像，导致停机时间较长
- 部署失败时需要手动介入恢复，缺少自动回滚机制
- `.dockerignore` 文件位置不正确，未能生效

**Proposed Solution**:
优化 Dockerfile 构建流程、增强 GitHub Actions 缓存策略、改进 NAS 部署顺序，并添加自动回滚和企业微信通知功能。

**Business Impact**:
- 构建+部署总时长控制在 5 分钟内
- 减少服务停机时间至仅容器启动时间
- 部署失败时自动恢复，降低人工干预成本
- 实时通知部署状态，提升团队协作效率

---

## Success Metrics

**Primary KPIs:**
- **构建+部署总时长**: ≤ 5 分钟（从 push 到服务可用）
- **服务停机时间**: 仅容器启动时间（约 10-30 秒）
- **部署成功率**: 失败时自动回滚，保证服务可用性

**Validation**:
- 通过 GitHub Actions 运行日志统计各阶段耗时
- 部署完成后通过企业微信通知确认状态

---

## User Personas

### Primary: 开发者
- **Role**: Weekly Admin 项目维护者
- **Goals**: 快速将代码变更部署到生产环境
- **Pain Points**: 部署时间长、失败后需手动恢复、缺少状态通知
- **Technical Level**: Advanced

---

## User Stories & Acceptance Criteria

### Story 1: 快速构建 Docker 镜像

**As a** 开发者
**I want to** push 代码后快速完成 Docker 镜像构建
**So that** 能尽快验证变更效果

**Acceptance Criteria:**
- [ ] 依赖未变动时，依赖安装层命中缓存
- [ ] pnpm store 缓存在 GitHub Actions 中复用
- [ ] 镜像构建利用 BuildKit 层缓存

### Story 2: 最小化部署停机时间

**As a** 开发者
**I want to** 部署时服务停机时间最短
**So that** 用户访问不受影响

**Acceptance Criteria:**
- [ ] 新镜像拉取完成后再停止旧容器
- [ ] 停机时间仅为容器启动时间
- [ ] 健康检查通过后才视为部署成功

### Story 3: 部署失败自动回滚

**As a** 开发者
**I want to** 部署失败时自动回滚到上一版本
**So that** 服务始终保持可用

**Acceptance Criteria:**
- [ ] 部署前记录当前运行的镜像 ID
- [ ] 健康检查失败时自动使用旧镜像启动容器
- [ ] 回滚操作记录在部署日志中

### Story 4: 企业微信部署通知

**As a** 开发者
**I want to** 通过企业微信接收部署状态通知
**So that** 及时了解部署结果

**Acceptance Criteria:**
- [ ] 部署成功时发送成功通知（包含版本信息）
- [ ] 部署失败时发送失败通知（包含错误摘要）
- [ ] 触发回滚时发送回滚通知

---

## Functional Requirements

### Core Features

**Feature 1: Dockerfile 优化**
- Description: 优化多阶段构建，提升缓存命中率
- 改动点:
  - 使用 `corepack enable` 替代 `npm install -g pnpm`
  - 调整 COPY 顺序：先复制 `package.json`、`pnpm-lock.yaml`、`prisma/`，安装依赖后再复制源码
  - 移除 runner 阶段的 pnpm 安装（standalone 模式不需要）
  - 将 `.dockerignore` 移动到项目根目录
- 预期效果: 源码变动时依赖层仍可命中缓存

**Feature 2: GitHub Actions 优化**
- Description: 增强缓存策略，减少重复下载
- 改动点:
  - 添加 `pnpm/action-setup@v4` 和 `actions/setup-node@v4` 的 pnpm 缓存
  - 设置 `platforms: linux/amd64` 避免多平台构建
  - 设置 `provenance: false` 和 `sbom: false` 减少镜像层数
  - 精简镜像标签策略
- 预期效果: 依赖缓存命中时跳过下载

**Feature 3: NAS 部署流程优化**
- Description: 调整部署顺序，减少停机时间
- 改动点:
  - 先 `docker pull` 再 `docker stop`
  - 使用 `docker compose up -d --force-recreate`
  - 部署前记录旧镜像 ID 用于回滚
  - 健康检查失败时自动回滚
  - 部署完成后清理悬空镜像
- 预期效果: 停机时间仅为容器启动时间

**Feature 4: 企业微信通知**
- Description: 部署状态实时通知
- 改动点:
  - 添加企业微信 Webhook 调用步骤
  - 支持成功、失败、回滚三种通知类型
  - 通知内容包含版本号、耗时、错误摘要等
- 配置要求: 需在 GitHub Secrets 中配置 `WECOM_WEBHOOK_URL`

### Out of Scope
- Watchtower 自动拉取模式（保持 SSH 主动部署）
- 多平台镜像构建（仅 x86_64）
- 蓝绿部署或金丝雀发布
- 镜像安全扫描

---

## Technical Constraints

### Performance
- 构建+部署总时长 ≤ 5 分钟
- 服务停机时间 ≤ 30 秒

### Security
- GitHub Token 用于 GHCR 认证（已有）
- NAS SSH Key 用于远程部署（已有）
- 企业微信 Webhook URL 存储在 GitHub Secrets

### Integration
- **GitHub Container Registry (GHCR)**: 镜像存储
- **NAS Docker**: 运行环境，已配置 HTTP_PROXY
- **企业微信群机器人**: 部署通知

### Technology Stack
- GitHub Actions + Docker Buildx
- Node.js 20 + pnpm + corepack
- Next.js 15 standalone 输出模式

---

## MVP Scope & Phasing

### Phase 1: MVP (本次实施)
- [x] Dockerfile 优化（corepack、COPY 顺序、移除冗余 pnpm）
- [x] .dockerignore 移动到项目根目录
- [x] GitHub Actions 缓存优化
- [x] 部署流程优化（先 pull 再 stop）
- [x] 自动回滚机制
- [x] 企业微信通知

### Phase 2: 后续增强
- 部署耗时统计和趋势分析
- 多环境部署支持（staging/production）
- 镜像安全扫描集成

### Future Considerations
- 蓝绿部署减少停机时间至零
- Kubernetes 迁移

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| 缓存失效导致构建变慢 | Low | Low | BuildKit 缓存 + pnpm store 缓存双重保障 |
| 回滚失败 | Low | High | 回滚前验证旧镜像存在，失败时保留现场并通知 |
| 企业微信 Webhook 失效 | Low | Low | 通知失败不影响部署流程，仅记录警告 |
| NAS 代理不稳定 | Medium | Medium | 已配置 Docker daemon 代理，可考虑镜像加速 |

---

## Dependencies & Blockers

**Dependencies:**
- GitHub Secrets 配置: `WECOM_WEBHOOK_URL`（企业微信 Webhook）
- NAS Docker daemon 代理配置（已完成）

**Known Blockers:**
- 无

---

## Appendix

### 配置清单

**GitHub Secrets 需要新增:**
```
WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

**文件变更清单:**
1. `docker/Dockerfile` - 优化多阶段构建
2. `.dockerignore` - 从 `docker/.dockerignore` 移动到项目根目录
3. `.github/workflows/deploy.yml` - 优化缓存和部署流程

### References
- [Docker BuildKit 缓存文档](https://docs.docker.com/build/cache/)
- [GitHub Actions 缓存](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [企业微信群机器人配置](https://developer.work.weixin.qq.com/document/path/91770)

---

*This PRD was created through interactive requirements gathering with quality scoring to ensure comprehensive coverage of business, functional, UX, and technical dimensions.*

# Implementation Plan: Org-Level NAS Delivery

**Workspace**: `org-level-nas-delivery` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/org-level-nas-delivery/spec.md`

---

## Summary

推荐方案：把 `weekly-admin`、`mcps`、`agents` 迁移到现有 `north-sea` GitHub Organization，建立一套 org-level NAS self-hosted runner 和 org-level Actions secrets/variables，再按仓库逐个闭环迁移、改 workflow、改 GHCR namespace、同步 NAS 配置并完成端到端验证。

不推荐继续个人账号 + 每仓 repo-level runner，因为它无法真正共享 Actions secrets/runner 权限边界，后续每加仓库都会重复配置。

---

## Architecture Overview

```text
GitHub org: north-sea
  ├─ repos: weekly-admin / mcps / agents
  ├─ org secrets: GHCR_TOKEN? / optional shared deploy variables
  ├─ runner group: nas-deploy
  │   └─ runner labels: self-hosted, nas, deploy
  └─ GHCR packages: ghcr.io/north-sea/<image>

GitHub-hosted runners
  └─ build/test images, push to GHCR

NAS org runner
  └─ pull exact image, update compose/container, run health/smoke checks
```

The build jobs remain on GitHub-hosted runners. Only deploy jobs run on NAS. This keeps build resource usage off the NAS while allowing deploy to use local Docker, local compose files, and local private `.env` files without SSH secrets.

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| GitHub organization secrets with selected repositories | https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions | 统一 token/secret，并限制可见仓库 | 个人账号没有等价 account-level secret | 成长期 |
| GitHub self-hosted runners at repository/organization level | https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners | org-level runner 可供多个仓库复用 | 单 runner 并发能力有限 | 成长期 |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| GitHub repository transfer | `north-sea/<repo>` | local git remotes, Actions workflows | `gh repo view north-sea/<repo>` 成功；本地 `git remote -v` 指向新 owner |
| Org Actions settings | runner group + labels | deploy jobs | deploy job 不再 queued，并显示在 NAS runner 执行 |
| Org secrets/variables | `GHCR_TOKEN` / deploy vars | build/deploy workflows | workflow logs 显示 GHCR login 成功，secret 不泄露 |
| Build jobs | GHCR images | NAS deploy jobs | `docker pull ghcr.io/north-sea/...` 成功 |
| NAS deploy jobs | running containers | health/smoke checks | `docker inspect` actual image 符合预期；health endpoint 成功 |

**孤儿 artifact 处理**: 若迁移后旧 namespace package 仍存在，它只作为回滚来源，不作为长期部署产物；最终部署应使用 org namespace。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 安全 | org secret 限定 selected repos；runner group 限定 selected repos | 不使用跨公网 SSH secrets；NAS Docker 权限只暴露给 runner group | GitHub org secret visibility + runner group repo list |
| 可用性 | 三仓 build/deploy 均成功，现有服务不中断或可回滚 | 每仓迁移后先验证 build，再执行 deploy；失败时保留旧容器 | Actions run + NAS docker inspect/logs |
| 可维护性 | 常态只保留一套 NAS runner 服务 | 统一 labels 为 `nas,deploy`，仓库不再绑定独有 runner | org runner list 只有目标 runner；workflow runs-on 统一 |
| 可演进性 | 新仓接入无需新 runner | 新仓只需迁入 org、授权 runner group、复用 workflow pattern | 文档中有新仓接入步骤 |

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 使用现有 `north-sea` org | 已存在 org 且当前账号为 admin | 新建 org / 使用 `north-sea` / 留在个人账号 | 使用 `north-sea` | org 名称成为 GHCR namespace；需更新 image refs | GitHub API evidence |
| ADR-002 使用 org-level runner | 目标是一个 runner 支撑多仓 | 每仓 repo runner / org runner / SSH deploy | org runner + runner group | 单 runner 并发部署会排队 | GitHub docs |
| ADR-003 构建和部署分离 | NAS 资源有限且已有 GitHub-hosted build | 全部在 NAS / build 在 GitHub deploy 在 NAS | build GitHub-hosted，deploy NAS | build 产物需通过 GHCR 交接 | Existing workflows |
| ADR-004 GHCR namespace 统一到 org | 迁仓后 owner 变化 | 保留 `northseacoder` image / 改到 `north-sea` | 改到 `north-sea` | 需要更新 manifests/compose，旧包只作回滚 | GitHub package convention |

---

## Key Design Decisions

### Decision 1: 迁移顺序采用“org 基础设施预检 → 逐仓迁移 → 逐仓改造 → 逐仓验证”

- **背景**: 仓库迁移会改变 URL、package namespace、Actions 权限和 runner 可见性。
- **选项**:
  - A: 先迁仓，再补 runner/secrets — 简单但中间 Actions 容易断。
  - B: 先建 org runner/secrets，再逐仓迁移和验证 — 操作多但风险低。
- **结论**: 选择 B，并细化为逐仓闭环。先确认 org runner group 和 org runner 能创建；仓库迁入 org 后，立即把该仓加入 runner group / org secret selected repositories，再更新该仓 workflow、GHCR image refs、NAS compose/env，并完成 build/deploy/health 验证。一个仓库通过后再进入下一个仓库。
- **影响**: 执行节奏变慢，但任一仓失败时影响面可控；runner group selected repositories 不能假设在仓库迁入前即可完整授权。
- **来源**: UNVERIFIED + GitHub docs。

### Decision 2: workflow labels 统一为 `self-hosted,nas,deploy`

- **背景**: 现在 `mcps` 使用 `mcps-deploy`，`agents` 使用 `agents-deploy`，`weekly-admin` 使用 `weekly-admin-deploy`。
- **结论**: 迁移后统一使用 `deploy` label；如需要更细粒度权限，交给 runner group selected repositories 控制。
- **影响**: 需要同步三仓 workflow；旧 repo-specific runner labels 可退役。

### Decision 3: token/package 策略采用逐仓验证门

- **背景**: `GITHUB_TOKEN` 通常能推当前仓库关联 package；跨 package 或私有 package pull 时可能需要 PAT。
- **结论**: 首先尝试 org repo 的 `GITHUB_TOKEN`；每个仓库必须验证 package access、build push、NAS `docker pull` 和运行期 `docker inspect` actual image。若任一私有 package 读取或 NAS pull 失败，再建立 org-level `GHCR_TOKEN` PAT，权限最小化并限制 selected repositories。
- **影响**: `mcps` 当前已支持 `${{ secrets.GHCR_TOKEN || secrets.GITHUB_TOKEN }}`；`agents` 和 `weekly-admin` 需要统一 fallback；是否需要 PAT 由逐仓验证结果决定。

---

## Module Design

### Module: GitHub Organization Setup

**职责**: 承载三仓统一归属、org secrets、runner group 和 package namespace。

**改动概述**:

- 使用现有 `north-sea`。
- 先验证是否需要 org-level secret `GHCR_TOKEN`；若需要，仅授权已迁入并参与部署的 selected repositories。
- 配置 org-level variable，如需要 `NAS_DEPLOY_DIR` 或统一 registry owner。
- 配置 runner group `nas-deploy`，仓库迁入后逐个加入 selected repositories。

### Module: NAS Runner

**职责**: 在 NAS 本机执行部署 job。

**改动概述**:

- 注册为 org-level self-hosted runner。
- labels: `nas,deploy`。
- runner 执行用户必须能运行 `docker` 和 `docker compose`。
- 安装为系统服务，并记录服务名、安装目录、日志路径。

### Module: Repository Migration

**职责**: 将三仓从 `NorthSeacoder/*` 迁到 `north-sea/*`，更新本地和远端引用。

**改动概述**:

- 按 `weekly-admin` -> `mcps` -> `agents` 顺序逐仓迁移。
- 更新本地 `origin`。
- 检查 repo visibility、Actions enabled、package permissions。

### Module: Workflow Updates

**职责**: 统一 build/deploy 的 runner labels、GHCR owner、token fallback 和验证逻辑。

**改动概述**:

- `weekly-admin`: build on push main；deploy runs-on `[self-hosted,nas,deploy]`；image `ghcr.io/north-sea/weekly-admin`.
- `mcps`: tag release；deploy runs-on `[self-hosted,nas,deploy]`；manifest image 改为 org namespace。
- `agents`: tag release；deploy runs-on `[self-hosted,nas,deploy]`；image generation owner 改为 org namespace.
- 每个仓库 workflow 都必须能在无 repo-specific runner label 的情况下调度 deploy job，并记录 Actions run ID。

### Module: NAS Deploy Manifests

**职责**: 确保 NAS 本地 compose/env 使用迁移后的 image refs。

**改动概述**:

- `/vol1/1000/Docker/hermes-db-mcp` compose image 指向 `ghcr.io/north-sea/hermes-db-mcp`.
- `/vol1/1000/Docker/wechat-mcp-server` compose image 指向 `ghcr.io/north-sea/wechat-mcp-server`.
- `/volume1/docker/weekly-admin` 或实际路径 compose/docker run 指向 `ghcr.io/north-sea/weekly-admin`.
- weekly-admin 若使用 NAS 本地 `docker-compose.yml`，必须验证 `docker compose config` 解析后的 image，而不能只验证 workflow 脚本里的 `IMAGE` 变量。

---

## Project Structure

```text
weekly-admin/
  .github/workflows/deploy.yml
  docs/nas-deployment.md
  specs/org-level-nas-delivery/

AI/mcps/
  .github/workflows/mcp-release.yml
  deploy/mcp-services.json
  deploy/services/*.yml

AI/agents/
  .github/workflows/mcp-release.yml
  deploy/mcp-services.json
  apps/wechat-agent/docker-compose.yml
```

---

## Risks and Tradeoffs

- 仓库迁移后 GHCR packages 可能不自动迁移或权限不完整；需要验证 package visibility 和 Actions package permissions。
- `agents` 是 private repo，org-level runner group 和 package access 更容易出现权限差异；必须先验证 package access，再触发真实部署。
- 单 NAS runner 会让多个部署排队；这是可接受的维护换取，后续可加第二个 org runner。
- 当前 `gh auth status` 曾显示 token invalid，但部分 `gh api` 可用；执行迁移前应刷新 `gh auth`，否则中途失败。
- GitHub transfer API 和 UI 行为可能需要用户二次确认；执行阶段必须准备手动 fallback。

---

## Evolution Path

- **MVP**: 一个 org、一个 org runner、一个 runner group、三仓授权。
- **成长期**: 新仓迁入 `north-sea` 后只需加入 runner group 和 org secret selected repositories。
- **成熟期**: 若部署并发增加，按服务类型拆 runner group，例如 `nas-web-deploy`、`nas-mcp-deploy`。

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。保留单 runner，不引入复杂平台。
- 是否引用了外部模式但没有适配检查：否。GitHub org secrets/runner 是平台原生能力。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。新增外部状态均在 tasks 中验证。

---

## Verification Strategy

1. **GitHub org verification**: `gh repo view north-sea/<repo>`；org secrets/runner group 可见；runner online。
2. **Runner authorization verification**: 仓库迁入后，runner group selected repositories 包含当前仓；deploy job 能被 `self-hosted,nas,deploy` 接单。
3. **Package access verification**: package owner、package access、workflow push、NAS pull 全部指向 `ghcr.io/north-sea/...`。
4. **Workflow syntax verification**: 每仓 YAML parse；对应本地静态检查。
5. **Build verification**:
   - `weekly-admin`: push/main 或 workflow_dispatch build success。
   - `mcps`: test release tag build success。
   - `agents`: release tag build success。
6. **Deploy verification**:
   - deploy job 被 NAS org runner 接单。
   - NAS `docker inspect <container> --format '{{.Config.Image}}'` 匹配新 image ref。
   - 如使用 compose，NAS `docker compose config` 解析后的 image 匹配新 image ref。
   - health/smoke endpoint 通过。
7. **Retirement verification**:
   - 旧 repo-level runners 停用。
   - repo-specific labels 从 workflow 移除。
   - 旧 image namespace 不再被新部署引用。

---

## Stage Readiness

- 是否需要 `data-model.md`: 不需要。没有应用内数据模型变化；外部实体已在 spec/plan 描述。
- 下一步建议：`tasks`
- 阻塞项：执行前需要用户最终确认迁移目标 `north-sea` 和迁移三个仓库。

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| org-level secrets | https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions | 官方文档 |
| self-hosted runners | https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/about-self-hosted-runners | 官方文档 |
| current org membership | GitHub API `orgs/north-sea/memberships/NorthSeacoder` | role=admin |
| current workflows | local repo files | `weekly-admin`, `AI/mcps`, `AI/agents` |

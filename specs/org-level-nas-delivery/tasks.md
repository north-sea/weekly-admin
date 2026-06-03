# Tasks: Org-Level NAS Delivery

**Workspace**: `org-level-nas-delivery` | **Date**: 2026-06-03  
**Input**: `specs/org-level-nas-delivery/spec.md` + `plan.md`  
**Prerequisites**: spec.md, plan.md

---

## 执行原则

- 每个外部副作用动作先记录当前状态，再执行，再验证。
- 三个仓库逐个闭环迁移，不并行迁移。
- 单仓顺序固定为：迁仓 -> runner/secret 授权 -> workflow/image/NAS 配置 -> build/deploy/health 验证。
- 优先保证服务不中断；部署失败先保留旧容器和旧镜像证据。
- 所有 token/secret 只写入 GitHub org secrets，不写入仓库文件或日志。
- `GHCR_TOKEN` 是否需要由逐仓 package access / NAS pull 验证决定，不预设必须使用 PAT。

---

## Phase 0: 执行前确认与访问修复

**目标**: 确保迁移操作不会因权限或目标选择中断。

- [x] T001 确认目标 org 和迁移范围
  - scope: 用户决策
  - maps_to: FR-001 / ADR-001
  - verify: 用户已要求“调整一下开始执行”，按现有 spec 默认执行 `north-sea` + `weekly-admin, mcps, agents`

- [x] T002 刷新 GitHub CLI 权限
  - scope: local `gh auth`
  - maps_to: FR-001 / FR-002 / FR-003
  - verify: `gh auth status` 正常；具备 repo、workflow、admin:org、write:packages/read:packages 所需能力

- [x] T003 记录三仓迁移前基线
  - scope: GitHub repo metadata, local remotes, workflow status, NAS containers
  - maps_to: NFR-004
  - verify: 保存 `gh repo view`、`git remote -v`、latest Actions run、NAS `docker ps/inspect` 摘要

---

## Phase 1: 建立 org-level Actions 基础设施

**目标**: 准备 org runner 基础设施；仓库授权在迁入 org 后逐仓完成。

- [x] T004 创建或确认 org runner group `nas-deploy`
  - scope: GitHub `north-sea` Actions runner groups
  - maps_to: FR-002 / 安全
  - verify: runner group 存在，仓库访问范围为 selected repositories 或准备切换为 selected repositories

- [x] T005 在 NAS 注册 org-level runner
  - scope: NAS runner install dir/service
  - maps_to: US2 / FR-002
  - verify: org runner online，labels 包含 `self-hosted`, `nas`, `deploy`

- [x] T006 记录 token/package 初始策略
  - scope: GitHub org/package settings
  - maps_to: FR-003 / ADR-003
  - verify: 记录先使用 `GITHUB_TOKEN` 还是先配置 selected-repo `GHCR_TOKEN`；如暂不配置 PAT，记录后续触发条件

---

## Phase 2: `weekly-admin` 逐仓闭环

**目标**: 先完成当前仓库迁移、部署路径改造和端到端验证。

- [x] T007 迁移 `weekly-admin` 到 `north-sea`
  - scope: GitHub repository transfer, local remote
  - maps_to: US1 / FR-001 / FR-006
  - verify: `gh repo view north-sea/weekly-admin` 成功；local `origin` 指向 `north-sea`

- [x] T008 授权 `weekly-admin` 使用 org runner / org secrets
  - scope: GitHub runner group selected repositories, org Actions secret visibility
  - maps_to: US2-2 / FR-002 / FR-003
  - verify: runner group repo list 包含 `weekly-admin`；如配置 `GHCR_TOKEN`，visibility 包含 `weekly-admin`

- [x] T009 更新 `weekly-admin` workflow 和 docs
  - scope: `.github/workflows/deploy.yml`, `docs/nas-deployment.md`
  - maps_to: US3-1 / FR-004 / FR-005
  - verify: YAML parse；`runs-on` 为 `[self-hosted,nas,deploy]`；image 为 `ghcr.io/north-sea/weekly-admin`

- [x] T010 同步 `weekly-admin` NAS 部署目录
  - scope: `/volume1/docker/weekly-admin` 或实际目录
  - maps_to: US3-1 / FR-007
  - verify: compose/docker run 使用 `ghcr.io/north-sea/weekly-admin`；如有 compose，`docker compose config` 解析后的 image 匹配新 namespace

- [x] T011 验证 `weekly-admin` build/package/deploy/health
  - scope: GitHub Actions run + GHCR package + NAS container
  - maps_to: US3-1 / FR-008
  - verify: build success；package push success；NAS `docker pull` success；deploy job 被 org runner 接单；`docker inspect weekly-admin` image 为 org namespace；`/api/health` 通过或预期 degraded

---

## Phase 3: `mcps` 逐仓闭环

**目标**: 在 weekly-admin 通过后迁移并验证 MCP release 流程。

- [x] T012 迁移 `mcps` 到 `north-sea`
  - scope: GitHub repository transfer, local remote `/Users/yqg/personal/AI/mcps`
  - maps_to: US1 / FR-001 / FR-006
  - verify: `gh repo view north-sea/mcps` 成功；local `origin` 指向 `north-sea`

- [x] T013 授权 `mcps` 使用 org runner / org secrets
  - scope: GitHub runner group selected repositories, org Actions secret visibility
  - maps_to: US2-2 / FR-002 / FR-003
  - verify: runner group repo list 包含 `mcps`；如配置 `GHCR_TOKEN`，visibility 包含 `mcps`

- [x] T014 更新 `mcps` release workflow 和 service manifest
  - scope: `/Users/yqg/personal/AI/mcps/.github/workflows/mcp-release.yml`, `deploy/mcp-services.json`, `deploy/services/*.yml`
  - maps_to: US3-2 / FR-004 / FR-005 / FR-007
  - verify: YAML/JSON parse；image refs 指向 `ghcr.io/north-sea/...`；runner label 为 `deploy`

- [x] T015 同步 `mcps` NAS 部署目录
  - scope: `/vol1/1000/Docker/hermes-db-mcp`
  - maps_to: US3-2 / FR-007
  - verify: compose override 或 service compose 使用 `ghcr.io/north-sea/hermes-db-mcp`；`docker compose config` 解析后的 image 匹配新 namespace

- [x] T016 验证 `mcps` release build/package/deploy/smoke
  - scope: release tag or workflow_dispatch equivalent
  - maps_to: US3-2 / FR-008
  - verify: build success；package push success；NAS `docker pull` success；deploy success；MCP smoke test 通过；actual image 等于 tag image ref

---

## Phase 4: `agents` 逐仓闭环

**目标**: 最后迁移 private repo，并重点验证 private package 权限。

- [x] T017 迁移 `agents` 到 `north-sea`
  - scope: GitHub repository transfer, local remote `/Users/yqg/personal/AI/agents`
  - maps_to: US1 / FR-001 / FR-006
  - verify: `gh repo view north-sea/agents` 成功；private visibility 保持；local `origin` 指向 `north-sea`

- [x] T018 授权 `agents` 使用 org runner / org secrets
  - scope: GitHub runner group selected repositories, org Actions secret visibility
  - maps_to: US2-2 / FR-002 / FR-003
  - verify: runner group repo list 包含 `agents`；如配置 `GHCR_TOKEN`，visibility 包含 `agents`

- [x] T019 更新 `agents` release workflow 和 service manifest
  - scope: `/Users/yqg/personal/AI/agents/.github/workflows/mcp-release.yml`, `deploy/mcp-services.json`, compose files
  - maps_to: US3-3 / FR-004 / FR-005 / FR-007
  - verify: YAML/JSON parse；image refs 指向 `ghcr.io/north-sea/...`；runner label 为 `deploy`

- [x] T020 同步 `agents` NAS 部署目录
  - scope: `/vol1/1000/Docker/wechat-mcp-server`
  - maps_to: US3-3 / FR-007
  - verify: compose 使用 `ghcr.io/north-sea/wechat-mcp-server`；`docker compose config` 解析后的 image 匹配新 namespace

- [x] T021 验证 `agents` release build/package/deploy/health
  - scope: release tag or workflow_dispatch equivalent
  - maps_to: US3-3 / FR-008
  - verify: build success；private package access 正常；NAS `docker pull` success；deploy success；health check 通过；actual image 等于 tag image ref

---

## Phase 5: 收尾和退役

**目标**: 移除旧模式，留下可复用文档。

- [ ] T022 停用旧 repo-level runners
  - scope: GitHub repo runners, NAS runner services
  - maps_to: NFR-003
  - verify: repo-level runner list 无旧 runner；NAS 上旧 runner service stopped/disabled

- [x] T023 检查 repo-level secrets 是否可退役
  - scope: three repos Actions secrets
  - maps_to: 安全
  - verify: 不再需要 `NAS_HOST`, `NAS_SSH_KEY`, repo-specific `GHCR_TOKEN`

- [x] T024 写验收记录
  - scope: `specs/org-level-nas-delivery/acceptance.md`
  - maps_to: FR-008
  - verify: 记录三仓 Actions run IDs、image refs、NAS health/smoke 结果、遗留风险

- [ ] T025 保存知识库
  - scope: nmem memory
  - maps_to: NFR-004
  - verify: 保存 org runner/token 接入流程和三仓最终状态

---

## 依赖与顺序

- T001-T003 是硬前置。
- T004-T006 是 org 基础设施前置；runner group selected repositories 可在各仓迁入后逐仓授权。
- T007-T011 必须先完成，作为第一仓迁移模板。
- T012-T016 依赖 T011 通过。
- T017-T021 依赖 T016 通过，并重点验证 private repo/package 权限。
- T022-T025 只有在 T011、T016、T021 全部通过后才能执行。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 统一归属与配置 | T001-T009, T012-T014, T017-T019 |
| US2 单 NAS org runner | T004-T005, T008, T013, T018, T022 |
| US3 三项目 build/deploy | T009-T021 |
| FR-001 迁移到 org | T007, T012, T017 |
| FR-002 org runner | T004-T005, T008, T013, T018 |
| FR-003 org token/package access | T006, T008, T011, T013, T016, T018, T021 |
| FR-004 workflow labels | T009, T014, T019 |
| FR-005 image namespace | T009-T011, T014-T016, T019-T021 |
| FR-006 local remote | T007, T012, T017 |
| FR-007 NAS manifests | T010, T015, T020 |
| FR-008 验收证据 | T011, T016, T021, T024 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 使用 `north-sea` | T001, T007, T012, T017 | T024 |
| ADR-002 org runner | T004-T005, T008, T013, T018 | T011, T016, T021, T022 |
| ADR-003 build/deploy 分离 | T009, T014, T019 | T011, T016, T021 |
| ADR-004 org GHCR namespace | T009-T021 | T011, T016, T021 |
| 安全 | T004-T006, T008, T013, T018, T023 | T024 |
| 可用性 | T011, T016, T021 | T024 |

---

## Stage Readiness

- 推荐下一步：`execute-plan`
- 当前执行块：T002-T006；完成后进入 `weekly-admin` 逐仓闭环。
- 阻塞项：仓库 transfer、org runner/secret 写入、NAS 修改均属于外部副作用，执行前必须先完成 T002-T003 基线并保留证据。

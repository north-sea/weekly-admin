# Feature Specification: Org-Level NAS Delivery

**Workspace**: `org-level-nas-delivery`  
**Created**: 2026-06-03  
**Status**: Draft  
**Input**: 用户描述: "规划建立 org 级的 token 和 runner，最终保证 weekly-admin、mcps、agents 三个项目能够正常 build 正常部署到 NAS 上"

---

## Feature Traits

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 迁仓、权限、runner、workflow、NAS 验证需要按阶段推进 |
| `external-side-effects` | ✅ | 会修改 GitHub 仓库归属、Actions secrets、runner、GHCR package、NAS 容器 |
| `artifact-handoff` | ✅ | workflow、runner labels、GHCR image、compose/env 是跨系统交接产物 |
| `user-visible-output` | ✅ | 最终用户可见为 3 个服务 build/deploy 状态与 NAS 服务可用性 |
| `prior-closure-failure` | ✅ | `weekly-admin` build 已通但 deploy queued，原因是缺少匹配 NAS runner |

**结论**: 本 feature 需要强化的执行治理：先建立可回滚计划，再执行迁移；每个外部副作用都要有验证证据；不能只以 workflow 成功作为完成条件，还要验证 NAS 上实际容器镜像与健康检查。

---

## User Scenarios & Testing

### User Story 1 - 统一 GitHub 归属与交付配置 (Priority: P1)

作为维护者，我希望 `weekly-admin`、`mcps`、`agents` 三个仓库归属到同一个 GitHub Organization，以便使用统一的 org-level runner、token/secrets 和部署策略。

**Why this priority**: 如果仓库继续在个人账号下，runner 和 secrets 只能按仓库重复维护，无法实现真正统一。

**Acceptance Scenarios**:

1. **US1-1 迁移仓库到 org**
   **Given** 目标 org `north-sea` 存在且当前账号在其中为 admin  
   **When** 三个仓库迁移完成  
   **Then** `north-sea/weekly-admin`、`north-sea/mcps`、`north-sea/agents` 均可访问，旧 remote 有重定向，本地 remote 已更新

2. **US1-2 统一 GitHub Actions 权限资产**
   **Given** 三个仓库已归属 `north-sea`  
   **When** 配置 org-level secrets/variables  
   **Then** 三个仓库能读取允许范围内的 `GHCR_TOKEN`、NAS runner 配置变量，且不再依赖 repo-level NAS SSH secrets

**Edge Cases**:

- **US1-3** 仓库迁移后 GHCR package 仍在旧 owner namespace，workflow 必须显式处理或迁移 image namespace。
- **US1-4** 私有仓库 `agents` 迁移后包权限、Actions 权限、runner group 仓库访问需要单独验证。
- **US1-5** 旧 webhook、deploy key 或 package 权限若不随迁移生效，需要记录并修复。

### User Story 2 - 一个 NAS org runner 支撑多个仓库部署 (Priority: P1)

作为维护者，我希望 NAS 上只保留一套 org-level GitHub Actions runner，用 labels 和 runner group 控制可部署仓库，以降低维护成本。

**Why this priority**: 多个 repo-level runner 会增加常驻进程、服务目录、升级和排障复杂度。

**Acceptance Scenarios**:

1. **US2-1 org-level runner 可调度**
   **Given** NAS runner 已注册到 `north-sea` org  
   **When** 任一仓库触发部署 job  
   **Then** job 可被 `self-hosted,nas,deploy` 或约定 labels 接单，不再 queued

2. **US2-2 runner 权限最小化**
   **Given** runner group 只授权给三个目标仓库  
   **When** 其他仓库尝试使用同 runner labels  
   **Then** 不应被该 runner group 接单

**Edge Cases**:

- **US2-3** 一个 runner 同时只能执行一个 job，并发部署需要排队或扩容第二个 runner。
- **US2-4** NAS runner 进程重启、离线或 token 过期时，workflow 应表现为 queued/failed，并有排障步骤。

### User Story 3 - 三个项目均能 build 并部署到 NAS (Priority: P1)

作为维护者，我希望三个项目的 release workflow 都能构建镜像、推送 GHCR、在 NAS 拉取并启动容器，并通过健康检查。

**Why this priority**: 这是迁移成功的最终业务验收。

**Acceptance Scenarios**:

1. **US3-1 weekly-admin**
   **Given** push 到 `main` 或手动触发 workflow  
   **When** build 和 deploy 完成  
   **Then** `weekly-admin` 容器运行期镜像来自目标 org GHCR namespace，`/api/health` 返回成功或预期 degraded 状态

2. **US3-2 mcps**
   **Given** 发布 tag 触发 `mcp-release.yml`  
   **When** build 和 deploy 完成  
   **Then** 目标 MCP 容器运行，实际镜像等于 release 版本 image ref，smoke test 通过

3. **US3-3 agents**
   **Given** 发布 tag 触发 `mcp-release.yml`  
   **When** build 和 deploy 完成  
   **Then** `wechat-mcp-server` 或目标服务运行，健康检查通过

**Edge Cases**:

- **US3-4** 旧镜像 namespace 与新 namespace 同时存在时，部署必须明确使用新 namespace，避免误拉旧 image。
- **US3-5** 若新版本健康检查失败，必须保留回滚路径或明确失败证据。

---

## Requirements

### Functional Requirements

- **FR-001**: 三个仓库必须迁移到同一个 GitHub Organization，默认目标为现有 `north-sea`。
- **FR-002**: 必须建立 org-level NAS self-hosted runner 或 runner group，授权给三个目标仓库。
- **FR-003**: 必须建立 org-level `GHCR_TOKEN` secret；若最终证明 `GITHUB_TOKEN` 对 org package 足够，可记录决策并不使用 PAT。
- **FR-004**: 三个仓库的 workflow 必须使用统一 runner labels，避免 repo-specific runner labels 长期存在。
- **FR-005**: 三个仓库的 GHCR image namespace 必须统一到 org namespace，或在 plan 中明确保留旧 namespace 的原因。
- **FR-006**: 本地 clone 的 `origin` 必须更新到迁移后的仓库 URL。
- **FR-007**: NAS compose/env/deploy manifest 必须同步新的 image ref。
- **FR-008**: 必须记录每个项目的 build、push、deploy、health/smoke 验收证据。

### Non-Functional Requirements

- **NFR-001 安全**: PAT 如需使用，必须最小权限，并放在 org-level secret 且限制 selected repositories。
- **NFR-002 可用性**: 迁移期间不得破坏现有 NAS 服务；部署失败时要保留旧容器或可回滚镜像。
- **NFR-003 可维护性**: 最终常态只保留一套 NAS runner 服务，避免每仓一套常驻 runner。
- **NFR-004 可审计性**: 每个外部副作用动作必须有命令、对象、结果记录。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 安全 | token 最小权限、runner group 限仓 | NAS runner 有 Docker 权限，风险高 | org secret 可见仓库列表、runner group 授权列表 | 是 |
| 可用性 | 三个服务迁移后可部署 | 不能因迁移中断服务 | Actions 成功 + NAS 容器健康 | 是 |
| 可演进性 | 新仓库可低成本接入 | 用户后续还会有其他仓 | 新仓接入只需加入 org、授权 runner group、复用 secret | 否 |

### Key Entities

- **Organization**: `north-sea`，目标统一归属与 org-level Actions 配置容器。
- **Repository**: `weekly-admin`、`mcps`、`agents`。
- **Org Runner / Runner Group**: NAS 上注册的一套 self-hosted runner，带统一 labels。
- **GHCR Package**: 每个服务的容器镜像包。
- **NAS Deploy Target**: NAS 上的 compose/project 目录、env 文件、容器和健康检查。

---

## Out of Scope

- 不重构三个项目的业务代码。
- 不把所有 release 策略统一成同一种触发方式；`weekly-admin` 可继续 main push，`mcps/agents` 可继续 tag release。
- 不在本阶段引入 Kubernetes、Portainer、Watchtower 等新部署平台。
- 不承诺 org 之外的其他仓库自动迁移；只设计可复用路径。

---

## Unclear Questions

- `GHCR_TOKEN` 是否必须使用 classic PAT，还是 org 仓库内 `GITHUB_TOKEN` 已足够覆盖所有 package pull/push。Plan 阶段应给出推荐并在执行时验证。
- `north-sea` 是否作为长期正式 org 名称；当前计划默认使用它，若用户改选新 org，需要替换目标 owner。

---

## Stage Readiness

- 下一步建议：`plan`
- 阻塞项：无。剩余问题不阻塞规划，可在执行期通过验证收敛。

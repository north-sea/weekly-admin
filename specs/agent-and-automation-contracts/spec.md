# Feature Specification: Agent And Automation Contracts

**Workspace**: `agent-and-automation-contracts`  
**Created**: 2026-06-04  
**Status**: Draft  
**Input**: 用户描述: "$sdd specify agent-and-automation-contracts"

> 本 spec 固化 Admin 与 n8n/Hermes/外部自动化调用方之间的运行契约，避免周刊自动化链路只在单个组件内可用、但端到端不可验证。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 自动化链路包含 Karakeep/n8n 同步、Admin 评分与周刊生成、人工审核、Quail 发布等多阶段协同。 |
| `external-side-effects` | ✅ | 会创建/关联周刊、写入 MySQL、调用 LLM、可能触发 Quail 发布或外部自动化调用；发布/发送类动作不可自然回滚。 |
| `artifact-handoff` | ✅ | inbox item、AI 评分结果、weekly draft、组织结果、发布 payload 都会被后续阶段消费，需要稳定格式和状态语义。 |
| `user-visible-output` | ✅ | 最终会影响 Admin UI 中的周刊草稿、内容关联、发布结果、错误提示和运维可见状态。 |
| `prior-closure-failure` | ✅ | 既有文档已把 automation plan 迁移到 SDD 工作区，并强调旧文档废弃；现有实现已有 API/服务能力，但外部调用契约、状态、审计和端到端证据仍分散。 |

**结论**: 下游 plan 必须包含 Producer-Consumer Matrix；verify 必须启用 Evidence Gate；closeout 必须给出 Component / Workflow / User-Visible Outcome 三维 Verdict，并做 workflow replay。

---

## Context Summary

Admin 现有文档已经把项目职责限定为后端 API、数据库 schema、n8n/Hermes 对接契约、Docker 部署和 Quail 发布集成；Hermes 技能实现和 n8n 工作流文件不在本仓库内。`admin-modernization-roadmap` 已将本 feature 排在 inbox scoring 收口之后，并明确要求 API token/Bearer Auth、最小 scope、OpenAPI、写入接口的 dry-run/idempotency/operation log。

现有代码已经有周刊自动化服务与 API，例如历史回填、自动创建、自动关联、内容-周刊关联、待关联候选、批量关联、AI 组织周刊、Quail 发布。`weekly_content_items` 已有 `(weekly_issue_id, content_id)` 唯一约束，`operation_logs` 已可承载基础审计，但没有 token、scope、idempotency 或 run 专用字段。`docs/cron-job-setup.md` 描述了 `CRON_API_TOKEN` / Bearer Token 调用模型，而当前认证实现仍主要校验用户 JWT 或 `auth-token` cookie，这个差异必须在本 feature 中收口。

本 feature 的目标是把“自动化如何调用 Admin、Admin 如何报告结果、失败如何重试、哪些动作幂等、哪些动作需要人工确认、哪些产物交给下一阶段”固化为可实现、可测试、可运维的需求。它不是从零实现周刊自动化，也不是一次性重写所有自动化逻辑，而是在已有 API 和服务能力之上建立稳定契约边界，降低后续 n8n/Hermes/cron 接入时的闭环风险。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 外部自动化可以稳定触发 Admin 工作流 (Priority: P1)

作为自动化维护者，我希望 n8n、cron 或 Hermes 能通过明确的 Admin API contract 触发周刊自动化步骤，以便调用方不依赖页面行为、私有实现或临时脚本。

**Why this priority**: 当前已有 `/api/weekly/auto-create`、`/api/weekly/auto-link`、`/api/weekly/backfill`、`/api/ai/organize-weekly` 等能力，但认证、返回结构、幂等语义、错误码和调用方身份没有统一描述。

**Acceptance Scenarios**:

1. **[US1-1] 自动化调用方有明确认证方式**
   **Given** 自动化调用方需要触发 Admin workflow  
   **When** 它调用契约内 API  
   **Then** spec/plan 必须定义调用方身份、认证方式、权限边界和 secret 不出日志的规则

2. **[US1-2] 每个 workflow step 有稳定请求/响应 contract**
   **Given** 调用方触发创建周刊、关联内容、组织草稿或发布预备动作  
   **When** API 返回成功、跳过、部分成功或失败  
   **Then** 响应必须包含可机器判断的 `success`、`status/action`、`runId` 或等价追踪键、关键计数和错误码

3. **[US1-3] 自动化调用不依赖 UI session**
   **Given** n8n/cron/Hermes 在无人值守环境执行  
   **When** 它调用 Admin 自动化 API  
   **Then** 不应要求浏览器 cookie 或人工登录态作为唯一认证方式

**Edge Cases**:

- **[US1-4] 未授权调用**：必须返回可区分的 401/403，不执行副作用。
- **[US1-5] 参数错误**：必须返回 400 和结构化 validation details。
- **[US1-6] 重复调用**：幂等步骤必须返回 `exists`、`skipped` 或等价状态，不重复创建业务事实。

### User Story 2 - 周刊自动化链路有端到端状态与产物交接 (Priority: P1)

作为周刊运营管理员，我希望自动化从候选内容到周刊草稿的每一步都有可追踪状态和产物，以便我能判断是“没有内容”“已生成待审核”“部分失败”还是“需要人工介入”。

**Why this priority**: 周刊链路跨 `inbox_items`、`contents`、`weekly_issues`、`weekly_content_items`、AI 组织结果和发布集成；没有统一状态会导致单步成功但整体不可用。

**Acceptance Scenarios**:

1. **[US2-1] Producer-Consumer 产物明确**
   **Given** 上游步骤产生 inbox 评分、内容晋升、weekly issue、weekly content item 或 AI 组织结果  
   **When** 下游步骤消费这些产物  
   **Then** plan 必须列出 producer、artifact、consumer、存储位置、必填字段和失败处理

2. **[US2-2] Draft-first 审核语义保持**
   **Given** 自动化生成或关联周刊内容  
   **When** 操作完成  
   **Then** 周刊必须保持可人工审核的草稿/待处理语义，不得绕过审核直接发布，除非显式调用发布 contract

3. **[US2-3] 空结果是成功状态而非异常**
   **Given** 某周没有可关联内容或 AI 组织没有候选内容  
   **When** 自动化步骤执行  
   **Then** contract 必须区分 `empty`/`skipped` 与系统错误，避免调用方误重试或误告警

**Edge Cases**:

- **[US2-4] 部分内容失败**：单条内容失败不得让整个批次失去可观察结果；响应必须保留失败项和原因。
- **[US2-5] 内容已被其他周刊消费**：必须跳过并报告，不得破坏已有关联。
- **[US2-6] 并发执行**：同一周刊同一步骤并发触发时不得重复创建 issue 或重复插入 content item。

### User Story 3 - 外部副作用被显式隔离和确认 (Priority: P1)

作为维护者，我希望 Quail 发布、通知、外部写回等不可回滚动作被放在明确契约之后执行，以便自动化不会在草稿未验证时误发用户可见内容。

**Why this priority**: `/api/quail/publish` 已支持发布和可选 deliver；这类动作必须与草稿生成、组织、审核步骤分开定义。

**Acceptance Scenarios**:

1. **[US3-1] 发布动作需要显式 contract**
   **Given** 调用方准备发布或发送周刊  
   **When** 调用 Quail 或其他外部副作用 API  
   **Then** 请求必须显式声明目标 issue、是否投递、是否允许 republish，并返回外部系统标识

2. **[US3-2] dry-run/preview 优先于副作用**
   **Given** 自动化调用方需要验证本次执行会影响什么  
   **When** workflow 支持 dry-run 或 preview  
   **Then** dry-run 必须不写入不可回滚副作用，并返回与真实执行可对比的摘要

3. **[US3-3] 可重试失败不重复外部副作用**
   **Given** 外部发布请求超时或调用方重试  
   **When** 同一 issue 被重复提交  
   **Then** contract 必须定义幂等键、已发布检测或 `forceRepublish` 语义，避免重复发信

**Edge Cases**:

- **[US3-4] Quail 不可用**：不得改变本地周刊事实为“已成功发布”，错误需可观测。
- **[US3-5] 已发布 issue 被重新发布**：必须要求显式 `forceRepublish` 或等价确认。
- **[US3-6] 自动化调用方权限不足**：发布类 API 权限应高于只读或草稿生成类 API。

### User Story 4 - 运维可以审计每次 agent/automation run (Priority: P2)

作为运维者，我希望每次自动化执行都能被追踪、审计和复盘，以便发现失败点、评估重试结果，并为后续 Hermes 学习提供事实输入。

**Why this priority**: 现有方案提到复用 `operation_logs` 记录用户反馈和动作，但自动化 run 的统一追踪、runId、调用方和耗时还未规格化。

**Acceptance Scenarios**:

1. **[US4-1] 每次 run 有追踪键**
   **Given** 自动化步骤被触发  
   **When** Admin 执行并返回结果  
   **Then** 响应和日志必须共享同一个 run 追踪键，便于跨 API、数据库和调用方日志定位

2. **[US4-2] 审计记录不泄漏 secret**
   **Given** 自动化调用带有 token、API key、LLM prompt 或外部 payload  
   **When** 记录 operation log 或 console log  
   **Then** 不得输出 secret、完整 token 或敏感正文；必要时只保留摘要/哈希/计数

3. **[US4-3] 失败可分类**
   **Given** 自动化步骤失败  
   **When** 维护者查看响应或日志  
   **Then** 错误必须能区分 validation、auth、conflict、dependency unavailable、external side-effect failed 和 internal error

**Edge Cases**:

- **[US4-4] 日志写入失败**：业务操作成功时，日志失败不能反向制造重复业务副作用，但必须有 fallback 可见告警。
- **[US4-5] 多步骤 workflow 失败**：必须能看出最后成功的 step 和下一个可恢复 step。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须定义 agent/automation 调用方类型，至少区分 human admin、cron/n8n、Hermes 或其他 service caller。
- **FR-002**: 系统必须定义自动化 API 的认证方式和权限边界；无人值守调用不能只依赖浏览器 cookie。
- **FR-002a**: 系统必须收口 `CRON_API_TOKEN` 文档约定与当前 JWT/cookie 认证实现之间的差异，明确 Bearer token 对 human user、cron/n8n 和 Hermes 的含义。
- **FR-002b**: 若引入 API token/service token，必须定义 token 存储、hash、过期、撤销、scope、最后使用时间和最小权限校验要求。
- **FR-003**: 自动化 API 成功响应必须包含可机器判断的状态字段，覆盖 `created`、`exists`、`linked`、`skipped`、`empty`、`partial_success`、`failed` 中适用状态。
- **FR-004**: 自动化 API 错误响应必须统一错误 envelope，至少包含稳定 `code` 和人可读 `message`，validation error 需包含 details。
- **FR-005**: 每次自动化 run 必须有可追踪标识；该标识应出现在 API 响应、服务日志和持久化审计记录中。
- **FR-006**: 周刊创建必须幂等；同一目标周重复触发默认不得创建重复 issue。
- **FR-007**: 周刊内容关联必须幂等；重复触发不得重复插入同一 `weekly_issue_id + content_id` 关系。
- **FR-008**: 自动化步骤必须定义空结果语义；没有候选内容、目标已存在、已全部关联等情况不得默认作为 500。
- **FR-009**: AI 组织周刊的输出必须被 schema 校验；无效 content id、空 items、超出 maxItems 或结构不符必须失败并可观测。
- **FR-010**: Quail 发布或其他外部副作用必须与草稿生成/组织步骤分离，并要求显式请求字段触发。
- **FR-011**: 发布类 contract 必须定义重复发布、强制重发和发送投递的语义，避免重试造成重复用户通知。
- **FR-012**: dry-run 或 preview 模式不得产生不可回滚外部副作用；对数据库写入步骤，dry-run 必须明确是否完全不写库。
- **FR-013**: 自动化 run 必须记录调用方、目标资源、执行结果、计数、耗时、错误分类和可恢复建议中的关键字段。
- **FR-014**: 日志和响应不得泄漏 token、API key、数据库密码、完整 LLM secret 或其他敏感配置。
- **FR-015**: contract 必须保持现有 human-admin API 的基本兼容性，除非 plan 明确迁移路径和兼容 wrapper。
- **FR-016**: 下游 plan 必须列出 Producer-Consumer Matrix，覆盖 inbox scoring、content promotion、weekly creation/linking、AI organization、review/publish 的主要交接产物。
- **FR-017**: 下游 plan 必须定义 OpenAPI 或等价机器可读契约产物的覆盖范围，说明哪些既有旧路径纳入契约，哪些新增到 `/api/v1` 或 automation 命名空间。
- **FR-018**: 本 feature 若新增或修改持久化模型，必须通过 Prisma Migrate 生成迁移，不得新增 `database/*.sql` 作为 schema 变更入口。

### Non-Functional Requirements

- **NFR-001 (可靠性)**: 自动化重复触发、超时重试和并发调用不得破坏核心 MySQL 事实源。
- **NFR-002 (可观测性)**: 维护者必须能通过 runId 或等价追踪键定位一次自动化执行的输入摘要、输出摘要和失败分类。
- **NFR-003 (安全)**: service caller 的权限应按最小权限分配；发布/投递类权限不得与只读或草稿生成权限混用。
- **NFR-004 (向后兼容)**: 现有页面和已存在 API 调用不应因 contract 收敛被无提示破坏。
- **NFR-005 (可演进性)**: contract 应允许未来将实现从同步 API 迁移到 queue/job，而不改变调用方的核心状态语义。
- **NFR-006 (可测试性)**: 每个 contract 至少应有 request validation、success、idempotent skip、auth failure 和代表性 dependency failure 的测试路径。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 一致性 | 同一类 API 使用一致 envelope、状态和错误码 | n8n/Hermes 需要机器消费结果 | route/service 测试与 contract 表 | 是 |
| 幂等性 | 重复触发不重复创建/发布 | cron 与 agent 重试是常态 | 并发/重复调用测试或 DB 约束证据 | 是 |
| 安全 | service caller 最小权限且 secret 不泄漏 | 自动化 token 常驻外部系统 | auth 设计、日志脱敏测试 | 是 |
| 可观测性 | 每次 run 可追踪和审计 | 端到端失败需要复盘 | runId 响应、operation log、错误分类 | 是 |
| 可演进性 | 同步 API 可迁移到 queue/job | 后续自动化可能增长为异步链路 | plan 中 contract 与实现解耦 | 否 |

### Key Entities

- **Automation Caller**
  - 触发 Admin 自动化能力的主体。
  - 可能是 human admin、n8n workflow、cron、Hermes 或后续 service account。

- **Automation Token / Scope**
  - 面向无人值守调用方的凭证与权限集合。
  - 若落地为持久化模型，必须支持撤销、过期、最小 scope、脱敏展示和审计。

- **Automation Contract**
  - 一组稳定的 request、response、auth、status、error、idempotency 和 observability 约定。
  - 面向外部调用方，而不是只面向内部服务函数。

- **Automation Run**
  - 一次可追踪执行。
  - 至少包含 runId、caller、workflow/step、target resource、started/finished time、result、counts、error classification。

- **Workflow Artifact**
  - 被下游消费的中间产物。
  - 例如 AI score、promoted content、weekly issue、weekly content item、organization result、publish payload。

- **External Side Effect**
  - 调用 Admin 之外的系统或用户可见发送动作。
  - 例如 Quail 发布/投递、通知、未来写回 Hermes/n8n 状态。

---

## Business Metrics *(optional — 上线后度量)*

- **BM-001**: 自动化 workflow 的失败能按错误类别聚合，而不是只看到 500 或 console error。
- **BM-002**: 重复触发周刊创建/关联不产生重复 issue 或重复 content item。
- **BM-003**: n8n/Hermes 调用方可以仅根据响应状态决定继续、跳过、重试或告警。

---

## Clarifications

### CL-001 - Automation token 与 human JWT 分离

**发现**: Roadmap 已明确要求“区分人类 JWT 与 automation token”，并要求为 n8n、Hermes、MCP 分配独立 token；当前代码主要通过用户 JWT 或 cookie 认证，`docs/cron-job-setup.md` 又假设存在 `CRON_API_TOKEN`。

**结论**: 本 feature 默认采用独立 automation token/service token 体系；human JWT 继续服务后台用户与现有人机交互。`Authorization: Bearer ...` 仍作为 header 形式，但 token 类型必须可区分，scope 校验必须服务于 automation caller。`CRON_API_TOKEN` 作为兼容命名或 seed/bootstrap 输入处理，不作为长期唯一身份模型。

**Plan 输入**: 需要设计 token hash 存储、scope、撤销/禁用、过期、最后使用时间、脱敏展示、测试 fixture 和迁移路径。Secret rotation 可延后，不阻塞本 feature。

### CL-002 - 需要专用 Automation Run / Idempotency 持久化，operation_logs 只做审计视图

**发现**: `operation_logs` 需要 `user_id`，operation type 只有 CREATE/UPDATE/DELETE/LOGIN/LOGOUT，字段适合人类操作审计，但不适合 token scope、run lifecycle、idempotency lookup、重复请求响应复用和跨步骤状态恢复。

**结论**: 本 feature 不把 `operation_logs` 作为唯一 run 存储。Plan 应设计专用 automation run / idempotency 持久化模型，`operation_logs` 可作为兼容审计或 UI 查询补充。若为了最小化首版范围暂不新增完整 run 表，也必须至少有可查询的 idempotency 记录与 runId 关联，且记录该降级为 known risk。

**Plan 输入**: run 模型至少覆盖 caller/token、scope、workflow/step、target resource、idempotency key、status、request digest、response summary、error code、started/finished time。

### CL-003 - `draft` 继续表示“自动生成后待人工审核”

**发现**: `weekly_issues.status` 当前只有 `draft/published/archived`，PRD 和现有自动化也都要求自动关联后保持 draft；引入 `pending_review` 会扩大 UI、查询和发布语义改动。

**结论**: 本 feature 不扩展 `weekly_issues.status`。自动化生成、自动关联、AI 组织后的周刊仍保持 `draft`，并通过 automation run、operation details 或后续 workbench checklist 表达“由自动化生成、待审核”的来源和状态。

**Plan 输入**: 发布 contract 必须显式检查 `draft -> published` 的人工确认或自动化 publish scope，不得把“自动生成完成”误判为“可直接投递”。

### CL-004 - 路由策略：保留旧路径，新增 `/api/v1` agent-friendly 契约

**发现**: 现有 `/api/weekly/*` 路径已经被 UI、cron 文档和旧自动化使用；roadmap 同时要求 agent-friendly endpoint 和 OpenAPI。直接替换旧路径会破坏兼容，继续只用旧路径又会把人类 UI contract 与 automation contract 绑死。

**结论**: 本 feature 保留现有 human-admin 路径，新增或稳定 `/api/v1` 下的 agent-friendly 契约，并用共享 service 层保证行为一致。OpenAPI 优先覆盖 `/api/v1` automation contract；旧路径可作为兼容 wrapper 纳入文档或标注 legacy。

**Plan 输入**: 需要列出每个旧路径是否 wrapper、是否纳入 OpenAPI、是否需要迁移提示，以及 n8n/cron 文档如何从旧路径迁移到 `/api/v1`。

### CL-005 - AI 组织结果首版保持 preview/建议，不直接写入周刊事实

**发现**: `organizeWeekly` 当前返回经过 schema 校验的组织结果，没有写入 `weekly_content_items`；直接让 AI 输出写库会放大错误 content id、排序和 section 语义的风险。

**结论**: 本 feature 首版将 AI organization 定义为 suggestion/preview artifact，由后续明确的 apply/confirm contract 消费后才写入周刊事实。若 plan 选择实现 apply endpoint，必须要求 idempotency、人工或高 scope 确认、以及逐项校验。

**Plan 输入**: Producer-Consumer Matrix 必须区分 `weekly suggestion artifact` 与 `weekly_content_items` 事实写入。

### Architecture Quality Gate

本 feature 触发架构质量门，因为它涉及权限、安全、持久化、幂等、外部副作用和跨模块 workflow。当前阶段结论足以支撑 plan：

- **业务范围**: Admin 对外提供 automation contract；不实现 n8n workflow 或 Hermes skill。
- **读写特征**: 低频写入、低并发但高重试概率；幂等和审计比吞吐更重要。
- **一致性**: MySQL 仍是业务事实源；自动化 run/idempotency 需要与业务写入在关键步骤保持可恢复一致。
- **失败代价**: 重复创建、重复关联、重复发布和 secret 泄漏是最高风险；空结果、依赖失败和部分成功必须可机器判定。
- **硬约束**: 所有 schema change 必须走 Prisma Migrate；secret rotation deferred；Redis job orchestration 是后续 feature，不作为本 feature 前置。

---

## Out of Scope

明确不在本次功能范围内：

- 不实现 Hermes 技能本体。
- 不创建或改造 n8n workflow 文件。
- 不重写全部周刊 UI。
- 不立即把所有自动化迁移到 queue/job。
- 不改变 MySQL 作为业务事实源的定位。
- 不实现新的通知渠道。
- 不要求本 feature 直接完成 Quail 发布体验改版。
- 不在本 feature 内接入 Redis queue/job；但 contract 必须为后续异步迁移保留稳定状态语义。
- 不在本 feature 内实现 secret rotation；token 撤销/禁用与脱敏展示仍在范围内。

---

## Known Risks

- **KR-001**: 旧 cron 文档和现有代码认证模型不一致，plan 必须提供迁移路径，避免部署后 cron 继续使用无效 token。
- **KR-002**: 如果首版为了减小范围不新增完整 automation run 表，idempotency 和审计查询能力会受限，必须在 plan 中明确降级边界。
- **KR-003**: 保留旧路径和新增 `/api/v1` 会带来双入口维护成本，必须通过共享 service 和测试矩阵控制行为漂移。

---

## Stage Readiness

- 下一步建议：`plan`
- 阻塞项：无剩余阻塞性需求歧义；认证、run/idempotency、状态语义、路由策略和 AI suggestion 写入边界已在 Clarifications 中收口。Plan 阶段需要把这些结论转化为 data model、API contract、Producer-Consumer Matrix、迁移与验证路径。

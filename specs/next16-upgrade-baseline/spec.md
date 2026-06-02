# Feature Specification: Next.js 16 Upgrade Baseline

**Workspace**: `next16-upgrade-baseline`  
**Created**: 2026-06-02  
**Status**: Draft  
**Input**: 用户描述: "希望升级到 Next.js 16；可以拆成多个 feature；先确认相关 feature 描述，后续再进入开发。"

> 写入本文件后，应同步更新 `specs/.active` 指向当前 workspace。

---

## Feature Traits *(LM 自动检测，用户可 override)*

| Trait | 是否命中 | 依据 |
|---|---|---|
| `multi-stage-workflow` | ✅ | 升级涉及依赖、构建器、lint/typegen、`middleware` 迁移、Request APIs 审计和部署验证。 |
| `external-side-effects` | ✅ | 后续实现会影响本地开发、Docker/standalone build 和 NAS 部署基线。 |
| `artifact-handoff` | ❌ | 本 feature 不生产给外部系统消费的业务 artifact。 |
| `user-visible-output` | ❌ | 目标是框架基线稳定，不直接改变 UI 功能。 |
| `prior-closure-failure` | ✅ | 当前 `next.config.ts` 存在临时忽略 ESLint/TypeScript 的配置，升级时必须避免只得到表面 build 通过。 |

**结论**: 本 feature 需要强化验证与 closeout，但不需要 Producer-Consumer Matrix。

---

## Summary

将周刊 Admin 从 `next@15.4.4` 升级到 Next.js 16，并把构建、lint、类型生成、认证代理和 App Router 类型约束恢复到可维护状态。该 feature 是 UI 改造、Agent API 契约和自动化接入之前的框架基线。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 作为维护者，我能在 Next.js 16 下稳定开发和构建 (Priority: P1)

作为 Admin 维护者，我希望项目升级到 Next.js 16 后仍能完成开发启动、类型检查、测试和生产构建，以便后续功能改造建立在稳定框架上。

**Why this priority**: Next.js 16 会改变默认构建器、lint 命令、Request APIs 和 proxy 约定。若基线不稳，后续 UI/API 改造会放大回归风险。

**Acceptance Scenarios**:

1. **[US1-1] 依赖升级完成**
   **Given** 当前项目使用 `next@15.4.4` 和 `eslint-config-next@15.4.4`  
   **When** 执行本 feature 的实现任务  
   **Then** `next` 与 `eslint-config-next` 升级到 Next.js 16 兼容版本，lockfile 同步更新

2. **[US1-2] 核心验证命令可用**
   **Given** 依赖已升级  
   **When** 执行 `pnpm lint`、`pnpm type-check`、`pnpm test`、`pnpm build`  
   **Then** 命令应成功，或失败项必须有明确、已记录且不被 `next.config.ts` 掩盖的原因

3. **[US1-3] Turbopack 作为长期完成标准**
   **Given** Next.js 16 默认使用 Turbopack dev/build  
   **When** 执行 `pnpm build`  
   **Then** 以 Turbopack build 通过作为完成目标；`next build --webpack` 只能作为短期诊断或发布回退

**Edge Cases**:

- **[US1-4]** 如果 Turbopack 因第三方依赖或配置失败，必须记录失败文件、错误类型和临时 `--webpack` 回退条件，不能把 webpack 通过当作最终完成。
- **[US1-5]** 如果 Node.js 版本低于 Next.js 16 要求，开发和部署文档必须明确 Node.js 20.9+ 前置条件。
- **[US1-6]** 如果现有 TypeScript 错误过多，不能继续依赖 `typescript.ignoreBuildErrors: true` 作为完成标准；必须收敛或拆出明确后续阻塞项。

### User Story 2 - 作为维护者，我能保留现有鉴权和路由保护行为 (Priority: P1)

作为 Admin 维护者，我希望 Next.js 16 升级后现有登录、API 鉴权、管理员路由保护和重定向逻辑保持一致，以便升级不引入权限回归。

**Why this priority**: 当前项目有 `src/middleware.ts` 负责 cookie/header token 校验和受保护路由处理。Next.js 16 已弃用 `middleware.ts` 文件约定，需迁移为 `proxy.ts`。

**Acceptance Scenarios**:

1. **[US2-1] proxy 迁移完成**
   **Given** 当前存在 `src/middleware.ts`  
   **When** 完成 Next.js 16 升级  
   **Then** 认证代理迁移到 `src/proxy.ts` 并导出 `proxy` 函数，matcher 行为保持等价

2. **[US2-2] 登录与 API 鉴权行为保持**
   **Given** 用户未登录访问受保护页面或 API  
   **When** 请求 `/dashboard`、`/weekly` 或受保护 `/api/*`  
   **Then** 页面请求重定向到 `/login`，API 请求返回 401；管理员路由仍按角色返回 403 或跳转

**Edge Cases**:

- **[US2-3]** `api/upload/image` 当前仍在 public route/matcher 排除中；图片退役不属于本 feature，迁移时只保持现状，不在此处删除图片接口。
- **[US2-4]** 代理逻辑不能引入 Edge-only 假设；Next.js 16 proxy runtime 为 Node.js，需保持现有 token 校验可运行。

### User Story 3 - 作为维护者，我能识别并修复 App Router 类型迁移问题 (Priority: P2)

作为维护者，我希望升级后所有 App Router route/page 的 `params`、`searchParams` 和 Request APIs 使用 Next.js 16 支持的 async 模式，以便类型检查真实反映框架要求。

**Why this priority**: Next.js 16 完全移除同步 Request APIs 访问；项目已有部分 route 使用 `params: Promise<...>`，但仍需全量审计。

**Acceptance Scenarios**:

1. **[US3-1] typegen 纳入验证链路**
   **Given** 项目使用 App Router  
   **When** 执行类型检查  
   **Then** 先运行 `next typegen` 生成路由类型，再执行 `tsc --noEmit`

2. **[US3-2] 同步 Request APIs 清零或记录**
   **Given** 项目存在大量 route handlers 和 pages  
   **When** 完成审计  
   **Then** 同步访问 `cookies`、`headers`、`draftMode`、`params`、`searchParams` 的风险点被修复或记录为阻塞项

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须将 `next` 和 `eslint-config-next` 升级到 Next.js 16 兼容版本，并同步 `pnpm-lock.yaml`。
- **FR-002**: 系统必须把 `src/middleware.ts` 迁移为 Next.js 16 推荐的 `src/proxy.ts` / `proxy` 导出，并保持现有 matcher 和鉴权行为。
- **FR-003**: 系统必须替换 `next lint` / `next lint --fix`，改用 ESLint CLI。
- **FR-004**: 系统必须把 `next typegen` 纳入类型检查或独立验证命令。
- **FR-005**: 系统必须审计并修复同步 Request APIs 的 Next.js 16 不兼容用法。
- **FR-006**: 系统必须以 Turbopack `next build` 通过作为完成目标；`--webpack` 只允许作为临时诊断/发布回退。
- **FR-007**: 系统必须清理 `next.config.ts` 中 Next.js 16 不再需要或不再支持的配置，尤其是 `eslint` config option。
- **FR-008**: 系统必须明确 Node.js 20.9+ 的开发与部署前置条件。

### Non-Functional Requirements

- **NFR-001**: 升级不得依赖 `typescript.ignoreBuildErrors: true` 或 build 阶段忽略 lint 来掩盖基线问题。
- **NFR-002**: 升级不得改变 Admin 业务数据模型、数据库事实源或图片退役范围。
- **NFR-003**: NAS/Docker 生产构建仍需支持 `output: 'standalone'`。

### Quality Attributes

| 属性 | 目标 | 为什么重要 | 验收 / 证据 | 是否阻塞 plan |
|------|------|------------|-------------|----------------|
| 可演进性 | Next 16 基线稳定后再做 UI/API 改造 | 避免框架迁移和业务改造耦合 | `pnpm lint/type-check/test/build` 结果 | 是 |
| 安全 | 鉴权代理行为不回退 | Admin 有受保护页面和 API | 登录、API 401/403、admin route 手动验证 | 是 |
| 可用性 | Meilisearch/图片等非本 feature 能力不影响升级完成 | 避免扩大范围 | 本 feature 不改搜索/图片数据库语义 | 否 |
| 可部署性 | NAS/Docker 构建仍可发布 | Admin 运行在 NAS 环境 | standalone build + Node 20.9+ 记录 | 是 |

---

## Key Entities

本 feature 不新增业务实体。涉及的技术对象包括：

- **Next.js runtime baseline**: `next`、`react`、`react-dom`、`eslint-config-next`、Node.js 版本要求。
- **Proxy auth layer**: 原 `src/middleware.ts` 中的路由保护和 API header 注入逻辑。
- **Validation commands**: `pnpm lint`、`pnpm type-check`、`pnpm test`、`pnpm build`、`next typegen`。

---

## Out of Scope

- 不重构 Admin UI，不引入 `nextjs-tpl` 的壳层组件。
- 不删除图片字段、图片 API 或图片依赖；图片退役由 `image-feature-retirement` 处理。
- 不迁移 MySQL 到 Postgres，不改 Prisma 数据模型。
- 不接入 Redis job、n8n workflow、Hermes skill 或 hermes-db MCP。
- 不改 Meilisearch 策略；Meili optional 由 `database-and-search-strategy` 处理。
- 不引入 monorepo、Drizzle 或 `nextjs-tpl` 的数据库双模式。

---

## Unclear Questions

- 当前 NAS 上 Admin 容器运行的 Node.js 版本需在实现阶段确认；若低于 20.9，需要先升级镜像或运行环境。
- 是否在本 feature 内把 `typescript.ignoreBuildErrors: true` 一次性移除，取决于实际 type-check 错误规模；默认目标是移除或至少把剩余错误拆成明确阻塞项。

---

## Stage Readiness

- 下一步建议：`plan`
- 阻塞项：无。当前需求和边界足以生成实现方案。


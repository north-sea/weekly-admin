# Implementation Plan: Next.js 16 Upgrade Baseline

**Workspace**: `next16-upgrade-baseline` | **Date**: 2026-06-02 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/next16-upgrade-baseline/spec.md`

---

## Summary

本计划将 Admin 升级到 Next.js 16，并把框架迁移限定在依赖、构建/lint/typegen、`proxy.ts`、Request APIs 审计和验证链路内。后续 UI、图片退役、数据库和 Hermes/n8n 接入必须在独立 feature 中推进。

---

## Architecture Overview

本 feature 只触碰框架基线和认证代理，不改变业务数据流。

```text
Browser / n8n / future agents
        |
        v
src/proxy.ts
  - public route bypass
  - cookie / bearer token auth
  - API request header injection
        |
        v
Next.js 16 App Router
  - pages
  - route handlers
  - Server Components
        |
        v
existing service layer + Prisma/MySQL
```

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|-----------------|----------|--------|----------|----------|
| Next.js 16 upgrade guide | https://nextjs.org/docs/app/guides/upgrading/version-16 | Node 20.9+、Turbopack 默认、`middleware` -> `proxy`、Request APIs async、`next lint` 移除 | 不能替代项目内具体 route/page 审计 | 成长期 |
| Next.js CLI / `next typegen` | https://nextjs.org/docs/app/api-reference/cli/next | 生成 route-aware 类型，配合 `tsc --noEmit` | 不自动修复业务类型错误 | 成长期 |
| 当前 Admin App Router 结构 | `/Users/yqg/personal/weekly/admin/src/app` | 现有 route/page 是迁移对象 | 不改变业务模块和路由信息架构 | 当前系统 |

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|------|------|----------|----------|
| 可演进性 | 框架基线先稳定，后续 feature 再改 UI/API | 本 feature 不混入业务重构 | roadmap 中后续 feature 独立推进 |
| 安全 | proxy 迁移不改变鉴权语义 | `middleware` 改为 `proxy` 时保留 token 校验和 admin route 逻辑 | 手动验证 401/403/redirect |
| 可部署性 | Docker standalone build 可继续使用 | 保留 `output: 'standalone'`，确认 Node 20.9+ | `pnpm build` |
| 可维护性 | lint/typecheck 不再依赖 Next 15 命令或 build 忽略项 | ESLint CLI + `next typegen` + `tsc --noEmit` | `pnpm lint`、`pnpm type-check` |

---

## Capacity / Scale Notes

- **规模假设**: 个人/小团队 Admin；页面和 route handlers 数量较多，但请求规模不是升级瓶颈。
- **读写特征**: 本 feature 不改变读写路径。
- **失败代价**:
  - proxy 迁移错误：登录、API 鉴权或 admin route 权限回归。
  - Turbopack build 失败：后续 Next 16 基线不完整。
  - 类型忽略继续存在：后续 UI/API 改造会继承隐藏错误。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|------|------|------|------|------|------|
| ADR-001 使用 Next.js 16 且以 Turbopack 通过为完成标准 | 用户明确要求升级；Next 16 dev/build 默认 Turbopack | Next 15 / Next 16 + webpack / Next 16 + Turbopack | 选择 Next 16 + Turbopack；webpack 仅回退 | 需要处理 Turbopack 暴露的兼容问题 | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| ADR-002 `middleware.ts` 迁移为 `proxy.ts` | Next 16 弃用 middleware 文件约定 | 保留 middleware / 改 proxy | 改为 `src/proxy.ts` 并导出 `proxy` | 需验证鉴权行为等价 | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| ADR-003 `next lint` 改 ESLint CLI | Next 16 移除 `next lint`，`next.config.ts` 中 `eslint` option 不再需要 | 保留脚本 / 改 ESLint CLI | 改为 `eslint` / `eslint --fix` | 需要确认 ESLint flat/config 兼容 | https://nextjs.org/docs/app/api-reference/config/eslint |
| ADR-004 `next typegen` 纳入类型检查 | Next 16 推荐 route-aware 类型辅助 async APIs 迁移 | 仅 `tsc` / typegen + tsc | 选择 typegen + tsc | CI/本地多一步命令 | https://nextjs.org/docs/app/api-reference/cli/next |
| ADR-005 不在本 feature 处理图片、数据库、Hermes | 用户要求先确认 feature 描述，后续开发 | 一次性大改 / 分 feature | 分 feature | 总工期更长，但风险低 | 用户澄清 |

---

## Key Design Decisions

### Decision 1: 先升级框架基线，再做 UI/API 改造

- **背景**: Next.js 16 会改变构建、lint、proxy 和 Request APIs。若同时做 UI/API，会难以定位回归来源。
- **选项**:
  - A: 先完成 Next 16 基线。
  - B: 与 UI、图片退役、Agent API 一起改。
- **结论**: 选择 A。
- **影响**: 本 feature 只处理框架迁移和验证命令。
- **来源**: roadmap ADR-001 + 用户澄清。

### Decision 2: 不把 webpack build 通过作为完成标准

- **背景**: Next.js 16 默认 Turbopack。长期依赖 webpack 会留下下一次迁移债务。
- **选项**:
  - A: Turbopack 通过才完成。
  - B: webpack 通过即可完成。
- **结论**: 选择 A。`next build --webpack` 只作为诊断/临时发布回退。
- **影响**: 任务中必须包含 Turbopack build 验证和失败记录。
- **来源**: Next.js 16 upgrade guide。

### Decision 3: proxy 迁移保持等价行为

- **背景**: 当前 `src/middleware.ts` 承担登录重定向、API 401、admin route 权限和 API header 注入。
- **选项**:
  - A: 文件和函数都迁移为 proxy，业务逻辑保持等价。
  - B: 趁机重构鉴权。
- **结论**: 选择 A。
- **影响**: 不引入新 auth 架构；只做 Next 16 文件约定迁移。
- **来源**: Next.js 16 upgrade guide。

---

## Module Design

### Module: Dependency Baseline

**职责**: 升级 Next.js 相关依赖并保持 React 19 / TypeScript 5 / ESLint 9 兼容。

**改动概述**:

- `package.json`: `next`、`eslint-config-next` 升级到 16 系列。
- `pnpm-lock.yaml`: 同步 lockfile。
- 保留 `react@19.1.0` / `react-dom@19.1.0`，除非 Next 16 peer 约束要求调整。

**注意事项**:

- 使用 `pnpm`。
- 先记录当前 Node.js 版本；低于 20.9 时先修环境。

### Module: Scripts and Tooling

**职责**: 替换 Next 15 工具命令，恢复 lint/typecheck 的真实约束。

**改动概述**:

- `lint`: 从 `next lint` 改为 ESLint CLI。
- `lint:fix`: 从 `next lint --fix` 改为 ESLint CLI fix。
- `type-check`: 建议改为 `next typegen && tsc --noEmit`。
- 可新增 `typegen`: `next typegen`。

**注意事项**:

- 若 ESLint config 当前不支持 CLI，需要在实现中补齐配置，而不是保留 `next lint`。

### Module: Next Config

**职责**: 让 `next.config.ts` 符合 Next.js 16 语义。

**改动概述**:

- 移除 `eslint` config option。
- 审查 `typescript.ignoreBuildErrors: true`，默认目标是移除；若错误规模超出本 feature，需要记录阻塞项。
- 保留 `output: 'standalone'`、`serverExternalPackages` 和安全 headers。
- 保留 top-level `turbopack` 配置并验证是否仍兼容。

**注意事项**:

- 不在本 feature 中重写 image 配置；图片退役独立处理。

### Module: Proxy Auth Layer

**职责**: 将 `src/middleware.ts` 迁移为 Next.js 16 proxy。

**改动概述**:

- `src/middleware.ts` -> `src/proxy.ts`。
- `export async function middleware` -> `export async function proxy`。
- 保持 `config.matcher`、public/protected/admin routes、debug throttling、token 校验和 API request headers 注入。

**注意事项**:

- 不删除 `/api/upload/image` public route；它由图片退役 feature 处理。
- 迁移后需要手动验证登录跳转和 API 401/403。

### Module: App Router Async API Audit

**职责**: 修复 Next 16 同步 Request APIs 不兼容点。

**改动概述**:

- 全量搜索 `cookies()`、`headers()`、`draftMode()`。
- 审计 App Router `page.tsx`、`layout.tsx`、`route.ts` 中的 `params` / `searchParams` 类型。
- 对 server page/route 使用 async `params` / `searchParams` 约定；client hook `useParams` / `useSearchParams` 不属于该迁移问题。

**注意事项**:

- 当前已有 route 使用 `{ params }: { params: Promise<{ id: string }> }`，实现时应沿用这种方向。

---

## Project Structure

```text
package.json
pnpm-lock.yaml
next.config.ts
src/middleware.ts       # 迁移后删除或改名
src/proxy.ts            # 新增/迁移目标
src/app/**/page.tsx     # 按需审计 server props
src/app/**/layout.tsx   # 按需审计 params
src/app/**/route.ts     # 按需审计 route context params
```

---

## Risks and Tradeoffs

- 当前 `next.config.ts` 有 `typescript.ignoreBuildErrors: true`，移除后可能暴露大量既有类型问题。
- `next lint` 移除后，ESLint CLI 可能需要配置调整。
- Turbopack 可能暴露 `@uiw/react-md-editor`、Prisma/mysql2、markdown/highlight 相关 bundling 问题。
- proxy 迁移是安全敏感点，必须保留行为验证。

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。本 feature 不引入新部署平台或新框架结构。
- 是否引用了外部模式但没有适配检查：否。Next.js 16 官方迁移点已映射到项目文件。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。仅升级依赖和工具链。

---

## Verification Strategy

实现阶段至少执行并记录：

```bash
node --version
pnpm install
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

如 Turbopack build 失败，可额外执行：

```bash
pnpm exec next build --webpack
```

但 `--webpack` 结果只能作为诊断信息，不能单独作为完成证据。

手动 smoke 验证：

- 未登录访问 `/dashboard` 应重定向到 `/login?redirect=/dashboard`。
- 未登录访问受保护 `/api/*` 应返回 401。
- 非管理员访问 admin-only route 应保持原有 403/跳转行为。
- `/api/health` 仍为 public route。

---

## Stage Readiness

- 是否需要 `data-model.md`：不需要；本 feature 不新增业务实体、状态或存储关系。
- 下一步建议：`tasks`
- 阻塞项：无。方案足以拆成实现任务。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | 必须 | 主实现计划 |
| data-model.md | 不需要 | 不涉及数据模型 |
| tasks.md | 后续阶段生成 | 由 tasks 阶段产出 |
| acceptance.md | 后续阶段生成 | 用于最终验收结论 |

---

## Sources

| 决策 | 来源 URL | 备注 |
|------|---------|------|
| Next.js 16 upgrade | https://nextjs.org/docs/app/guides/upgrading/version-16 | Node 20.9+、Turbopack 默认、proxy、async APIs |
| ESLint / `next lint` removal | https://nextjs.org/docs/app/api-reference/config/eslint | Next 16 移除 `next lint` |
| `next typegen` | https://nextjs.org/docs/app/api-reference/cli/next | route-aware 类型生成 |


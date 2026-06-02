# Tasks: Next.js 16 Upgrade Baseline

**Workspace**: `next16-upgrade-baseline` | **Date**: 2026-06-02  
**Input**: `specs/next16-upgrade-baseline/spec.md` + `plan.md`  
**Prerequisites**: spec.md (必须), plan.md (必须), data-model.md (不需要)

---

## 执行原则

- 本 feature 只做 Next.js 16 基线升级，不混入 UI、图片退役、数据库迁移、Redis、n8n 或 Hermes。
- 以 Turbopack `pnpm build` 通过作为完成目标。
- `next build --webpack` 只允许作为诊断或临时回退证据，不作为最终完成标准。
- proxy 迁移必须保持现有鉴权行为等价。
- 不用 `typescript.ignoreBuildErrors` 或 `next.config.ts` 的 lint 忽略项掩盖基线问题。

---

## Phase 1: Preflight Baseline

**目标**: 记录当前环境、失败面和迁移输入，避免升级后无法判断问题来源。

- [x] T001 [US1] 记录 Node.js 和包管理环境
  - scope: 本地 shell / NAS Dockerfile 或部署说明（如存在）
  - maps_to: FR-008 / 可部署性
  - verify: `node --version` 结果满足或明确标记需升级到 20.9+

- [x] T002 [US1] 执行升级前基线验证
  - scope: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`
  - maps_to: US1 / NFR-001
  - verify: 记录每条命令当前状态；失败项标记为既有问题或升级阻塞

- [x] T003 [US3] 扫描 Next.js 16 高风险迁移点
  - scope: `package.json`, `next.config.ts`, `src/middleware.ts`, `src/app/**`
  - maps_to: FR-002 / FR-003 / FR-004 / FR-005 / FR-007
  - verify: 形成实现清单：`next lint`、`middleware`、`params/searchParams`、`cookies/headers/draftMode`、config ignore 项

---

## Phase 2: Dependency and Tooling Upgrade

**目标**: 升级 Next.js 依赖并替换 Next 15 工具命令。

- [x] T004 [US1] 升级 Next.js 相关依赖
  - scope: `package.json`, `pnpm-lock.yaml`
  - maps_to: FR-001 / ADR-001
  - verify: `next` 和 `eslint-config-next` 为 16 兼容版本，`pnpm install` 成功

- [x] T005 [US1] 替换 lint 脚本
  - scope: `package.json`, ESLint 配置文件（如需）
  - maps_to: FR-003 / ADR-003
  - verify: `pnpm lint` 调用 ESLint CLI；`pnpm lint:fix` 调用 ESLint CLI fix；不再出现 `next lint`

- [x] T006 [US3] 纳入 `next typegen`
  - scope: `package.json`
  - maps_to: FR-004 / ADR-004
  - verify: 存在 `typegen` 脚本或 `type-check` 包含 `next typegen && tsc --noEmit`

---

## Phase 3: Next Config Migration

**目标**: 让 `next.config.ts` 符合 Next.js 16，并减少临时忽略项。

- [x] T007 [US1] 移除 Next 16 不再需要的 ESLint config option
  - scope: `next.config.ts`
  - maps_to: FR-007 / ADR-003
  - verify: `next.config.ts` 中不再配置 `eslint: { ignoreDuringBuilds: ... }`

- [x] T008 [US1] 收敛 TypeScript build 忽略项
  - scope: `next.config.ts`
  - maps_to: NFR-001 / 可维护性
  - verify: 默认移除 `typescript.ignoreBuildErrors: true`；若无法移除，必须在 tasks/acceptance 中记录具体阻塞错误和后续 feature

- [x] T009 [US1] 验证 Turbopack 配置兼容
  - scope: `next.config.ts`
  - maps_to: FR-006 / ADR-001
  - verify: top-level `turbopack` 配置在 `pnpm build` 下可用，或记录需要调整的 alias/rules

---

## Phase 4: Proxy Migration

**目标**: 将认证代理迁移到 Next.js 16 推荐约定，并保持行为等价。

- [x] T010 [US2] 迁移 `middleware` 文件和导出
  - scope: `src/middleware.ts` -> `src/proxy.ts`
  - maps_to: FR-002 / ADR-002
  - verify: `src/proxy.ts` 存在并导出 `proxy`；不再依赖 `src/middleware.ts`

- [x] T011 [US2] 保留 route 分类和 matcher 行为
  - scope: `src/proxy.ts`
  - maps_to: US2 / 安全
  - verify: public routes、protected routes、admin routes、`config.matcher` 与原行为等价

- [x] T012 [US2] 保留 API header 注入行为
  - scope: `src/proxy.ts`
  - maps_to: US2 / 安全
  - verify: API 请求认证通过后仍注入 `x-user-id`、`x-user-role`、`x-username`

---

## Phase 5: Async Request API Audit

**目标**: 修复 Next.js 16 完全移除同步 Request APIs 后的类型与运行风险。

- [x] T013 [US3] 审计 server-side `params` / `searchParams`
  - scope: `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/**/route.ts`
  - maps_to: FR-005
  - verify: server page/layout/route context 使用 Next 16 async props/context 约定；client hooks 不误改

- [x] T014 [US3] 审计 `cookies()` / `headers()` / `draftMode()`
  - scope: `src/app/**`, `src/lib/**`
  - maps_to: FR-005
  - verify: Request APIs 均以 async 方式访问；无同步访问遗留

- [x] T015 [US3] 运行 typegen + type-check 并修复暴露问题
  - scope: `.next/types`, `src/app/**`, `src/lib/**`
  - maps_to: FR-004 / FR-005 / NFR-001
  - verify: `pnpm type-check` 成功，或剩余问题被明确记录为阻塞项

---

## Phase 6: Verification and Smoke Test

**目标**: 证明升级后的框架基线、构建链路和鉴权行为可用。

- [x] T016 [US1] 执行静态验证
  - scope: 全项目
  - maps_to: US1 / 可维护性
  - verify: `pnpm lint`、`pnpm type-check`、`pnpm test` 成功

- [x] T017 [US1] 执行 Turbopack production build
  - scope: 全项目 / `.next`
  - maps_to: FR-006 / ADR-001 / 可部署性
  - verify: `pnpm build` 成功；若失败，记录失败原因并不得以 webpack 结果替代

- [x] T018 [US1] 仅在需要时执行 webpack 诊断
  - scope: 全项目
  - maps_to: ADR-001
  - verify: Turbopack `pnpm build` 已通过，未触发 webpack 诊断

- [x] T019 [US2] 手动验证登录和 API 鉴权 smoke
  - scope: `/dashboard`, `/weekly`, `/api/health`, 受保护 `/api/*`, admin-only route
  - maps_to: US2 / 安全
  - verify: 未登录页面重定向、API 401、admin 权限行为与升级前一致

- [x] T020 [US1] 记录完成证据和残余风险
  - scope: `specs/next16-upgrade-baseline/acceptance.md`
  - maps_to: closeout / prior-closure-failure
  - verify: acceptance 记录命令结果、Node 版本、Turbopack 状态、proxy smoke、未解决问题

---

## 依赖与顺序

- 关键路径：T001 -> T002 -> T004 -> T005/T006 -> T007/T008/T009 -> T010/T011/T012 -> T013/T014/T015 -> T016/T017/T019 -> T020。
- T005 和 T006 可在 T004 后并行。
- T013 和 T014 可在 proxy 迁移后并行。
- T018 只在 T017 失败或需要发布回退诊断时执行。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|-------------|----------|
| US1 Next 16 稳定开发和构建 | T001, T002, T004, T005, T006, T007, T008, T009, T016, T017, T018, T020 |
| US2 鉴权和路由保护保持 | T010, T011, T012, T019 |
| US3 App Router async API 迁移 | T003, T006, T013, T014, T015 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|----------------------|----------|----------|
| ADR-001 Turbopack 完成标准 | T004, T009 | T017, T018 |
| ADR-002 proxy 迁移 | T010, T011, T012 | T019 |
| ADR-003 ESLint CLI | T005, T007 | T016 |
| ADR-004 next typegen | T006, T015 | T016 |
| 可部署性 | T001, T007, T009 | T017, T020 |
| 安全 | T010, T011, T012 | T019 |
| 可维护性 | T005, T006, T008, T015 | T016 |

---

## Notes

- 当前项目已有 `src/app/page.tsx` 使用 `await cookies()`，这属于正确方向，但仍需全量审计。
- 当前已有部分 route handler 使用 `{ params }: { params: Promise<{ id: string }> }`，实现时应沿用该模式。
- 当前 `package.json` 中 `dev:turbo` 在 Next 16 后可能冗余；可保留为兼容脚本，但 `dev` 默认已经是 Turbopack。
- 当前图片相关 public route 不在本 feature 删除，避免和 `image-feature-retirement` 交叉。
- 2026-06-02 实现后验证：`pnpm lint`、`pnpm type-check`、`pnpm test`、`pnpm build` 通过；`pnpm lint` 仍有既有 warning 债务（475 warnings），后续按模块清理并逐步升回 error。

---

## Stage Readiness

- 推荐下一步：`verify`
- 阻塞项：无。登录/API 鉴权 smoke 已完成；`/api/health` 因 Meilisearch 不健康返回 503，但 database/application/startup 为 healthy，属于搜索服务状态而非 proxy 回归。

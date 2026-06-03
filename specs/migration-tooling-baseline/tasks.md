# Tasks: Migration Tooling Baseline

**Workspace**: `migration-tooling-baseline` | **Date**: 2026-06-03  
**Input**: `specs/migration-tooling-baseline/spec.md` + `plan.md`  
**Prerequisites**: spec.md, plan.md

---

## 执行原则

- 先拿 fresh schema evidence，再生成或标记 baseline；不得用 2026-05-23 的旧 drift 结论做生产依据。
- 本 feature 不夹带业务 schema 变更，只建立 Prisma Migrate 工作流。
- 任何生产 DB metadata 写入前，都必须有备份/checkpoint 与可回退操作说明。
- 旧迁移入口保留但 deprecated；新 schema 变更入口必须是 `prisma/migrations/`。

---

## Phase 1: Fresh Schema Evidence

**目标**: 在任何 migration metadata 写入前，确认 Prisma schema、generated client、当前数据库和迁移状态一致。

- [x] T001 [US1] 采集当前 Prisma/DB 迁移状态
  - scope: `prisma/schema.prisma`, current database, Prisma CLI output
  - maps_to: FR-011 / ADR-004 / 一致性
  - verify: 记录 `pnpm prisma generate`、`pnpm prisma migrate status`、当前 `_prisma_migrations` 状态和数据库连接目标；不得输出 secrets

- [x] T002 [US1] 重新生成或校验 baseline diff
  - scope: `prisma/schema.prisma`, `specs/migration-tooling-baseline/_research/baseline-preview.sql`
  - maps_to: FR-001 / FR-011 / ADR-001
  - verify: fresh baseline SQL 与当前 schema 对齐；若与 `_research/baseline-preview.sql` 不同，记录差异原因

- [x] T003 [US1] 审查 baseline SQL 是否只表达当前 schema 起点
  - scope: generated baseline SQL
  - maps_to: NFR-001 / ADR-001 / 可用性
  - verify: baseline SQL 不包含非预期 drop/alter/data mutation；已有库不会执行 baseline SQL

---

## Phase 2: Prisma Baseline

**目标**: 创建 canonical Prisma baseline migration，并为已有库建立迁移历史起点。

- [x] T004 [US1] 创建 Prisma baseline migration 目录
  - scope: `prisma/migrations/<timestamp>_baseline/migration.sql`
  - maps_to: FR-001 / Key Entity `prisma/migrations/`
  - verify: migration 使用 Prisma Migrate 目录格式；`migration.sql` 可被 `prisma migrate status` 识别

- [x] T005 [US1] 标记本地/dev baseline 为已应用
  - scope: local/dev database `_prisma_migrations`
  - maps_to: FR-002 / US1-1 / ADR-001
  - verify: `prisma migrate resolve --applied <baseline>` 后，`prisma migrate status` 显示 baseline applied 且无 pending baseline

- [x] T006 [US2] 制定生产 baseline resolve 操作步骤
  - scope: `docs/migration-workflow.md`, production checklist
  - maps_to: FR-002 / NFR-001 / ADR-005 / 可运维性
  - verify: 文档包含备份/checkpoint、执行命令、执行前后 schema 抽样检查、失败处理；不要求本任务直接操作生产 DB

---

## Phase 3: Seed Extraction

**目标**: 将默认数据初始化从旧迁移脚本中抽离为独立、幂等的 Prisma seed。

- [x] T007 [US3] 梳理旧脚本中的 seed 逻辑
  - scope: `scripts/migrate-db.ts`
  - maps_to: FR-003 / ADR-003
  - verify: 明确 5 类 seed 的来源字段和幂等键：ADMIN 用户、默认分类、默认标签、AI settings、AI prompts

- [x] T008 [US3] 创建 `prisma/seed.ts`
  - scope: `prisma/seed.ts`
  - maps_to: FR-003 / FR-004 / Key Entity `prisma/seed.ts`
  - verify: seed 只写默认数据，不创建/修改表结构；重复运行不报错

- [x] T009 [US3] 配置 Prisma seed workflow
  - scope: `package.json`
  - maps_to: FR-005 / US3-1
  - verify: `package.json` 包含 `"prisma": { "seed": "tsx prisma/seed.ts" }`；`pnpm prisma db seed` 可运行

---

## Phase 4: Command And Legacy Migration Surface

**目标**: 让常用命令切到 Prisma Migrate，并让旧入口明确退役。

- [x] T010 [US1, US2] 切换 `db:migrate` 到 Prisma deploy
  - scope: `package.json`
  - maps_to: NFR-002 / ADR-002
  - verify: `pnpm db:migrate` 不再调用 `scripts/migrate-db.ts`，而是执行 `pnpm prisma migrate deploy`

- [x] T011 [US1] 为旧迁移脚本添加 deprecation 标记
  - scope: `scripts/migrate-db.ts`
  - maps_to: FR-008 / ADR-004
  - verify: 文件顶部有 `@deprecated` JSDoc，说明新迁移和 seed 分别使用 Prisma Migrate / Prisma seed

- [x] T012 [US1, US2] 标记裸 SQL 工作流为 legacy
  - scope: `scripts/README.md`, `scripts/run-sql-migration.sh`, `database/*.sql` docs references
  - maps_to: FR-009 / ADR-004 / 可演进性
  - verify: 文档明确 F1.5 后不得新增 `database/*.sql` 作为 schema 变更入口

---

## Phase 5: Deploy Workflow

**目标**: 在 NAS/GitHub Actions 部署新容器前自动应用 pending migrations，并让失败阻断部署。

- [x] T013 [US2] 在 deploy workflow 中加入 `prisma migrate deploy`
  - scope: `.github/workflows/deploy.yml`
  - maps_to: FR-007 / US2-2 / ADR-002 / 可运维性
  - verify: migration step 位于停止旧容器之前；失败时 workflow 退出，不继续重启容器

- [x] T014 [US2] 验证 deploy runner 的 DB 环境变量接入方式
  - scope: `.github/workflows/deploy.yml`, NAS deploy environment
  - maps_to: FR-007 / ADR-002
  - verify: workflow 使用 deploy 环境中的 `DATABASE_URL` 或等价方式；日志不打印连接串和 secrets

- [x] T015 [US2] 保持 Docker build 只生成 Prisma Client
  - scope: `docker/Dockerfile`
  - maps_to: FR-006 / ADR-003
  - verify: Dockerfile 仍包含 `pnpm prisma generate`；不包含 `prisma migrate` / `migrate deploy`

---

## Phase 6: Migration Workflow Documentation

**目标**: 让开发、部署、回滚和排障流程可被后续 feature 直接消费。

- [x] T016 [US1, US2, US3] 创建迁移工作流文档
  - scope: `docs/migration-workflow.md`
  - maps_to: FR-010 / NFR-004 / user-visible-output
  - verify: 文档覆盖创建迁移、查看状态、本地 reset、seed、生产 deploy、baseline resolve、failed migration、forward-fix rollback

- [x] T017 [US3] 记录生产回滚策略
  - scope: `docs/migration-workflow.md`
  - maps_to: NFR-003 / ADR-005 / 可回滚性
  - verify: 文档明确 MySQL DDL 不保证全部事务回滚；生产回滚主路径是 forward-fix migration + restore checkpoint

---

## Phase 7: Verification And Evidence Gate

**目标**: 用 fresh evidence 证明组件、工作流和用户可见产物都闭环。

- [x] T018 [US1] 验证开发者迁移历史工作流
  - scope: Prisma CLI, `prisma/migrations/`, `_prisma_migrations`
  - maps_to: US1-1 / US1-2 / FR-001 / FR-002
  - verify: `pnpm prisma migrate status` 显示 baseline applied；后续 migration 创建路径在文档中可按步骤复现

- [x] T019 [US3] 验证 seed 幂等性
  - scope: `prisma/seed.ts`, existing default-data tables
  - maps_to: US3-1 / FR-004 / FR-005
  - verify: `pnpm prisma db seed` 连续运行两次成功；默认数据存在且不重复

- [ ] T020 [US2] 验证 deploy migration 工作流
  - scope: `.github/workflows/deploy.yml`, deployment logs or dry-run evidence
  - maps_to: US2-2 / US2-3 / FR-007
  - verify: deploy 日志或 dry-run 证据显示 `prisma migrate deploy` 会在容器重启前执行；失败路径会中止部署

- [x] T021 [US1, US2, US3] 运行静态验证
  - scope: repository
  - maps_to: FR-001..FR-011 / architecture drift check
  - verify: `pnpm type-check` 通过；按风险运行必要 focused tests；如 lint 仍有既有 warnings，记录范围

- [x] T022 [Evidence Gate] 创建最终验收记录
  - scope: `specs/migration-tooling-baseline/acceptance.md`
  - maps_to: Feature Traits / Evidence Gate / 三维 Verdict
  - verify: acceptance 包含 Component / Workflow / User-Visible Outcome verdict；每条 P0/P1 requirement 有 evidence 或明确残余风险

---

## 依赖与顺序

- T001-T003 是硬前置，必须先于 T004/T005/T006。
- T004/T005 建立本地/dev baseline 后，T007-T012 可以并行推进。
- T013/T014 依赖 T010 的命令语义和 T006 的生产 checklist。
- T016/T017 可以与实现任务并行，但必须在 T022 前完成。
- T018-T022 是最终 verify/evidence gate，不应提前标记完成。
- 关键路径：T001 -> T002 -> T003 -> T004 -> T005 -> T010 -> T013 -> T018/T020 -> T022。

---

## 覆盖检查

| 场景 / 需求 | 对应任务 |
|---|---|
| US1 开发者清晰迁移历史 | T001-T005, T010-T012, T018 |
| US2 运维自动化部署迁移 | T006, T013-T015, T016, T020 |
| US3 团队协作与回滚能力 | T007-T009, T017, T019 |
| FR-001 baseline migration | T002-T004, T018 |
| FR-002 baseline resolve | T005-T006, T018 |
| FR-003/FR-004 seed | T007-T009, T019 |
| FR-005 package seed config | T009 |
| FR-006 Docker generate only | T015 |
| FR-007 deploy migrate | T013-T014, T020 |
| FR-008 legacy script deprecated | T011 |
| FR-009 raw SQL workflow deprecated | T012 |
| FR-010 workflow docs | T016-T017 |
| FR-011 fresh drift/status evidence | T001-T003, T021 |

| 架构决策 / 质量属性 | 对应任务 | 验证任务 |
|---|---|---|
| ADR-001 baseline 起点 | T002-T006 | T018 |
| ADR-002 生产迁移入口 | T010, T013-T014 | T020 |
| ADR-003 seed 分离 | T007-T009 | T019 |
| ADR-004 legacy 保留策略 | T011-T012 | T021 |
| ADR-005 rollback 策略 | T006, T017 | T022 |
| 一致性 | T001-T003 | T018, T021 |
| 可用性 | T003, T006, T013 | T020, T022 |
| 可演进性 | T010-T012, T016 | T021, T022 |
| 可运维性 | T013-T014, T016 | T020 |
| 可回滚性 | T006, T017 | T022 |

---

## Notes

- 本任务清单不要求立即操作生产 DB；生产 resolve/deploy 的真实执行应在 implement/verify 阶段按用户确认和环境权限推进。
- 如果 T001-T003 发现 schema drift 或 Prisma Client 与 schema 不一致，应回到 `plan` 或补充 clarify，不要继续 baseline。
- `spec-assessment.md` 是辅助评估产物，不是实现必需文件。
- 2026-06-03 执行记录：`pnpm prisma generate --no-engine`、`pnpm prisma generate`、`pnpm prisma validate`、`pnpm type-check`、`pnpm lint --quiet`、`pnpm test src/lib/services/__tests__/inbox-scoring.test.ts` 均通过。`pnpm prisma migrate resolve --applied 20260603202720_baseline` 已成功；`pnpm prisma migrate status` / `pnpm db:status` 显示 database schema is up to date；`pnpm prisma db seed` 连续运行两次成功。

---

## Stage Readiness

- 推荐下一步：`execute-plan`
- 理由：任务数量多且含 DB metadata、deploy workflow、legacy deprecation 和 evidence gate，应该按阶段推进并逐项记录证据。
- 阻塞项：无；但 T001-T003 可能在执行时发现需要回退 plan 的 drift。

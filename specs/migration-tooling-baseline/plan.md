# Implementation Plan: Migration Tooling Baseline

**Workspace**: `migration-tooling-baseline` | **Date**: 2026-06-03 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/migration-tooling-baseline/spec.md`

---

## Summary

本计划把当前"自定义迁移脚本 + 裸 SQL + 混合 seed"切换为 Prisma Migrate baseline、独立 Prisma seed、部署期 `migrate deploy` 和废弃旧迁移入口的标准工作流。

候选方案讨论跳过：用户已明确选择标准 Prisma Migrate 路线，且 spec 已收口 baseline / resolve / seed / CI 的关键决策；plan 只需要把执行边界、风险和验证路径设计清楚。

---

## Architecture Overview

迁移治理从一次性脚本模式改为版本化 migration artifact 模式。

```text
prisma/schema.prisma
        |
        | prisma migrate diff --from-empty
        v
prisma/migrations/<timestamp>_baseline/migration.sql
        |
        | dev/prod: prisma migrate resolve --applied <baseline>
        v
_prisma_migrations
        |
        | future deploys: prisma migrate deploy
        v
MySQL schema state

scripts/migrate-db.ts seed fragments
        |
        | extract idempotent data initialization
        v
prisma/seed.ts + package.json prisma.seed

legacy SQL/scripts
        |
        | deprecated docs + command redirects
        v
Prisma Migrate workflow
```

边界：

- 本 feature 不改变业务 schema；baseline 只记录当前 schema 起点。
- `migrate resolve --applied` 用于已有数据库的 baseline 标记，不执行 baseline SQL。
- `migrate deploy` 用于生产/CI 应用后续 pending migrations。
- seed 只负责初始化数据，不再承载 schema 变更。
- 旧脚本保留但标记 deprecated，避免一次性删除造成运维断点。

---

## Architecture Reference

| 参考模式 / 模板 | 来源 URL | 适配点 | 不适配点 | 当前阶段 |
|---|---|---|---|---|
| Prisma Migrate baseline existing database | https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/prisma-migrate/getting-started.mdx | 用 `migrate diff --from-empty` 为既有库生成初始 migration，并用 resolve 标记已应用 | 不替代本项目的生产备份、NAS 部署顺序和 MySQL DDL 风险治理 | 成长期 |
| Prisma production migration workflow | https://github.com/prisma/web/blob/main/apps/docs/content/docs/cli/migrate/index.mdx | 生产/CI 使用 `prisma migrate deploy`，并用 `status` / `resolve` 管理状态 | 不解决应用容器重启、健康检查和回滚编排 | 成长期 |
| Pipeline / artifact handoff | https://github.com/study8677/awesome-architecture/blob/main/tutorial/04-%E5%8D%81%E5%A4%A7%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84%E6%A8%A1%E5%BC%8F.md | baseline、seed、migration logs 都是跨阶段产物，需要明确 consumer | 不引入复杂流水线平台；继续沿用 pnpm、GitHub Actions、NAS runner | 成长期 |

---

## Producer-Consumer Matrix

| Producer | Artifact | Consumer | Consumption Proof |
|---|---|---|---|
| `prisma/schema.prisma` + Prisma CLI | `prisma/migrations/<timestamp>_baseline/migration.sql` | 本地 dev DB、生产 DB migration metadata | `prisma migrate status` 显示 baseline 已应用；baseline SQL 与当前 schema 对齐 |
| Baseline resolve step | `_prisma_migrations` baseline row | 后续 `prisma migrate deploy` | deploy 日志不重复执行 baseline；status 无 drift/pending baseline |
| `scripts/migrate-db.ts` seed fragments | `prisma/seed.ts` | `prisma migrate reset` / `prisma db seed` | 重复运行 seed 不报错，关键默认数据存在 |
| `package.json` | `prisma.seed`, `db:migrate` command | 开发者、CI、NAS deploy | `pnpm prisma db seed` 和 `pnpm db:migrate` 使用新流程 |
| `.github/workflows/deploy.yml` | deploy-time `prisma migrate deploy` output | 运维、closeout evidence | GitHub Actions / NAS deploy 日志显示迁移状态 |
| `docs/migration-workflow.md` | 开发/部署/回滚说明 | 后续 feature 作者和运维 | 文档覆盖 create/apply/deploy/rollback/baseline/fresh drift check |
| Deprecated legacy files | `@deprecated` 注释和 README 标记 | 后续维护者 | 搜索 `migrate-db.ts` / `run-sql-migration.sh` 能看到不要新增 schema change 的警告 |

**孤儿 artifact 处理**: `database/*.sql` 作为历史 artifact 保留，不再作为新 schema change 的 producer。后续 feature 若需要 DB 变更，必须消费 Prisma Migrate workflow。

---

## Quality Attribute Targets

| 属性 | 目标 | 设计影响 | 验证方式 |
|---|---|---|---|
| 一致性 | Prisma schema、generated client、baseline SQL、生产 DB 状态一致 | baseline 前必须做 fresh drift/status 检查 | `prisma migrate status`、schema diff、generated client/type-check 证据 |
| 可用性 | baseline resolve 不修改业务表，不中断现有服务 | baseline SQL 只作为 migration artifact；已有库只 resolve | resolve 前后 schema checksum/表结构抽样一致 |
| 可演进性 | 后续 DB 变更全部通过 `prisma/migrations` | 废弃裸 SQL 和自定义 schema 脚本入口 | 文档、package scripts、deprecated 注释和首个后续迁移 dry-run |
| 可运维性 | 部署时自动应用 pending migrations，失败可见 | deploy workflow 在启动新版本前执行 `migrate deploy` | CI/NAS deploy 日志包含迁移输出；失败时部署中止 |
| 可回滚性 | 生产回滚采用前进式修复迁移为主 | 文档禁止假设 MySQL DDL 全部事务回滚 | rollback 文档包含 forward-fix migration 和 restore checkpoint |

---

## Capacity / Scale Notes

- **规模假设**: 个人/小团队 Admin；当前内容量为千级，表数量约二十张上下。
- **读写特征**: DB schema 变更低频，但每次变更影响所有运行时。
- **失败代价**: baseline 错误会污染迁移历史；deploy migration 失败会阻断发布；seed 不幂等会破坏本地 reset 和部署初始化。

---

## Lightweight ADR

| 决策 | 背景 | 候选 | 结论 | 代价 | 来源 |
|---|---|---|---|---|---|
| ADR-001 baseline 起点 | 既有库没有 `_prisma_migrations`，不能回放历史脚本 | 回溯所有历史迁移 / 从当前 schema 生成 baseline / 继续自定义脚本 | 从当前 schema 生成 baseline，并标记为已应用 | 历史变更细节不进入 Prisma 迁移史 | Prisma baseline docs |
| ADR-002 生产迁移入口 | 当前 deploy 只重启容器，不跑迁移 | 手动迁移 / build 时迁移 / deploy 前 `migrate deploy` | deploy 前运行 `prisma migrate deploy` | deploy workflow 需要处理迁移失败和 DB 连接 | Prisma migrate CLI docs |
| ADR-003 seed 分离 | seed 与 schema 变更混在 `migrate-db.ts` | 保持混合 / 抽离到 `prisma/seed.ts` / 临时 seed API | 抽离到 `prisma/seed.ts`，通过 Prisma seed workflow 调用 | 需要拆分和验证既有默认数据逻辑 | Prisma seeding docs |
| ADR-004 legacy 保留策略 | 直接删除旧脚本可能破坏运维习惯 | 立即删除 / deprecated 保留 / 双写维护 | deprecated 保留，命令和文档切到新流程 | 短期存在两套文件，需要强警告避免误用 | UNVERIFIED |
| ADR-005 rollback 策略 | MySQL DDL 不应假设全部自动事务回滚 | 依赖事务回滚 / 只恢复备份 / 前进式修复迁移 + 备份 checkpoint | 以 forward-fix migration 为主，关键发布前保留备份/checkpoint | 文档和运维步骤更严格 | UNVERIFIED |

---

## Key Design Decisions

### Decision 1: baseline migration 只作为历史起点

- **背景**: 当前生产库已经存在完整 schema，直接执行 baseline SQL 会尝试重建已有表。
- **结论**: 生成 `prisma/migrations/<timestamp>_baseline/migration.sql` 后，在 dev/prod 已有库使用 `prisma migrate resolve --applied <baseline>` 标记；只有空库 reset 才回放 baseline。
- **影响**: implementation 必须先验证 baseline SQL 与当前 schema 对齐，再 resolve。
- **来源**: Prisma baseline docs。

### Decision 2: `db:migrate` 保持兼容但语义切换

- **背景**: 仓库当前脚本是 `pnpm db:migrate`，不是 `pnpm migrate`。
- **结论**: `pnpm db:migrate` 改为 `pnpm prisma migrate deploy`，并可新增更显式的辅助脚本，但不强制。
- **影响**: 现有运维命令继续可用，但不再执行 `scripts/migrate-db.ts`。
- **来源**: 仓库 `package.json`。

### Decision 3: deploy migration 不放进 Docker build

- **背景**: build 阶段没有真实生产 DB 语义，且镜像构建不应产生外部 DB 副作用。
- **结论**: Dockerfile 保留 `pnpm prisma generate`；migration 放在 GitHub Actions / NAS deploy 启动新容器前。
- **影响**: deploy runner 必须有 `DATABASE_URL` 和可执行 Prisma CLI 的方式。
- **来源**: Prisma production migration docs。

### Decision 4: fresh drift check 是 baseline 前置 gate

- **背景**: Post-F6 runtime smoke 暴露过 Prisma relation name/schema 假设错误。
- **结论**: 生成或 resolve baseline 前必须记录 fresh evidence：schema diff/status、Prisma Client 生成、type-check 或 focused runtime check。
- **影响**: tasks 阶段需要把 drift check 放在所有写入迁移元数据动作之前。
- **来源**: `specs/admin-modernization-roadmap/plan.md` Post-F6 Reassessment。

---

## Module Design

### Module: Prisma Baseline

**职责**: 生成当前 schema 的 canonical baseline migration，并把已有库标记为已应用。

**改动概述**:

- 创建 `prisma/migrations/<timestamp>_baseline/migration.sql`。
- 使用 `specs/migration-tooling-baseline/_research/baseline-preview.sql` 作为参考，但最终 migration 必须重新生成或校验。
- 在文档中记录 dev/prod resolve 步骤。

**关键行为**:

```text
1. fresh drift/status check
2. generate baseline SQL from current prisma/schema.prisma
3. review baseline SQL for destructive/unexpected statements
4. resolve baseline as applied on existing databases
5. verify migrate status
```

### Module: Seed Extraction

**职责**: 把默认用户、分类、标签、AI settings、AI prompts 从旧迁移脚本中抽离为幂等 seed。

**改动概述**:

- 新增 `prisma/seed.ts`。
- 新增 `package.json` 的 `prisma.seed`。
- seed 使用 upsert/存在性检查，重复运行不报错。

**注意事项**:

- seed 不创建或修改表结构。
- 涉及敏感配置时只初始化非 secret 默认值；不把生产 secret 写进 seed。

### Module: Package Scripts

**职责**: 让开发者和部署继续使用稳定命令，同时切到 Prisma Migrate。

**改动概述**:

- `db:generate` 保持 `pnpm prisma generate`。
- `db:migrate` 改为 `pnpm prisma migrate deploy`。
- 可按需新增 `db:seed`、`db:status`，但不强制。

### Module: Deploy Workflow

**职责**: 在发布新容器前应用 pending migrations，并让失败阻断部署。

**改动概述**:

- `.github/workflows/deploy.yml` 在 NAS runner 拉取镜像后、停止旧容器前执行 migration。
- migration 使用 deploy environment 的 `DATABASE_URL`。
- 日志保留 `prisma migrate deploy` 输出。

**注意事项**:

- 当前 workflow 会先停止旧容器再启动新容器；迁移步骤应放在停止旧容器之前，降低应用不可用窗口。
- 如果迁移需要新代码才能兼容，必须在具体后续 migration 中设计 expand/contract，不在本 baseline feature 里夹带业务 schema change。

### Module: Legacy Deprecation

**职责**: 让旧入口不再被误用，同时保留历史可读性。

**改动概述**:

- `scripts/migrate-db.ts` 顶部添加 `@deprecated` 注释。
- `scripts/README.md` 标记 `migrate-db.ts` 和 `run-sql-migration.sh` 为 legacy。
- `docs/migration-workflow.md` 明确禁止新增 `database/*.sql` 作为 schema 变更入口。

### Module: Migration Workflow Documentation

**职责**: 固化开发、部署、回滚和排障流程。

**改动概述**:

- 新增 `docs/migration-workflow.md`。
- 覆盖：创建迁移、本地 reset、seed、生产 deploy、baseline resolve、failed migration、forward-fix rollback、legacy workflow 退役。

---

## Data Model

不创建单独 `data-model.md`。

原因：

- 本 feature 不新增业务实体或业务关系。
- `_prisma_migrations` 是 Prisma 管理的内部表，spec 和 plan 中说明即可。
- `prisma/seed.ts` 写入的是既有业务表的默认数据，不改变实体结构。

---

## Project Structure

```text
prisma/
  migrations/
    <timestamp>_baseline/
      migration.sql
  seed.ts
  schema.prisma
docs/
  migration-workflow.md
scripts/
  migrate-db.ts          # deprecated
  README.md              # legacy migration docs update
package.json             # prisma.seed + db:migrate
.github/workflows/
  deploy.yml             # migrate deploy before container restart
specs/migration-tooling-baseline/
  spec.md
  plan.md
  tasks.md               # next stage
  acceptance.md          # verify/closeout stage
```

---

## Risks and Tradeoffs

- Baseline generation based on stale schema evidence would lock an incorrect migration history. Mitigation: fresh drift/status check before baseline and resolve.
- `migrate deploy` before container restart may apply schema changes while old code is still serving traffic. Mitigation: baseline feature only sets process; future destructive migrations must use expand/contract.
- Keeping legacy files may confuse contributors. Mitigation: package command switch, deprecated comments, docs warnings, and tasks requiring no new schema change under `database/*.sql`.
- Production DB access from NAS runner may need environment plumbing. Mitigation: plan tasks should verify `DATABASE_URL` availability without printing secrets.
- MySQL DDL rollback is not uniformly transactional. Mitigation: forward-fix migration and backup/checkpoint documented as production rollback path.

---

## Evolution Path

- **MVP**: Establish baseline, seed, deploy migration, docs, and deprecation.
- **成长期**: Add migration lint/drift check in CI before merge.
- **成熟期**: Add migration rehearsal against staging snapshot and automated expand/contract checks for destructive changes.

---

## Anti-Pattern Check

- 是否把成熟期架构套到了 MVP：否。当前只引入 Prisma 官方迁移工作流，不引入额外 migration platform。
- 是否引用了外部模式但没有适配检查：否。已明确 Prisma docs 只覆盖 CLI 语义，生产备份和 NAS deploy 顺序由本 plan 约束。
- 是否新增未记录的状态、依赖、缓存、队列或失败模式：否。新增状态集中在 `_prisma_migrations` 和 deploy migration output，已记录。

---

## Verification Strategy

Plan 后续 tasks 至少需要覆盖：

1. Fresh schema evidence:
   - `pnpm prisma generate`
   - `pnpm prisma migrate status`
   - baseline diff/status 记录
   - `pnpm type-check`
2. Baseline:
   - baseline migration directory exists in Prisma format
   - existing DB uses `migrate resolve --applied`
   - `migrate status` shows no pending baseline
3. Seed:
   - `pnpm prisma db seed` succeeds twice
   - required default records exist
4. Deploy:
   - workflow contains `prisma migrate deploy` before container restart
   - migration failure path aborts deploy
5. Legacy retirement:
   - `db:migrate` no longer calls `scripts/migrate-db.ts`
   - deprecated comments and docs are present
6. Evidence Gate:
   - Developer workflow evidence
   - Operator/deploy workflow evidence
   - User-visible docs/log evidence

---

## Stage Readiness

- 是否需要 `data-model.md`: 不需要。没有业务 schema 变更；Prisma 内部 metadata 表和 seed 数据在 plan/spec 中足够说明。
- 下一步建议: `tasks`
- 阻塞项: 无。进入 tasks 前不需要额外澄清。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|---|---|---|
| plan.md | 必须 | 本文件 |
| data-model.md | 不需要 | 不改变业务实体/关系 |
| tasks.md | 后续阶段生成 | 拆分 fresh check、baseline、seed、deploy、docs、verify |
| acceptance.md | 后续阶段生成 | 记录最终 Evidence Gate 和三维结论 |

---

## Notes

- `spec-assessment.md` 是本轮进入 plan 前的评估产物，后续可以保留作为说明，也可以在 closeout 时归档。
- 本 plan 不执行任何数据库写操作；真正的 `resolve` 和 `deploy` 命令必须在 implement/verify 阶段按 tasks 执行并记录 evidence。

---

## Sources

| 决策 | 来源 URL | 备注 |
|---|---|---|
| Baseline generation | https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/prisma-migrate/getting-started.mdx | `migrate diff --from-empty` 生成 baseline |
| `migrate resolve --applied` | https://github.com/prisma/web/blob/main/apps/docs/content/docs/orm/reference/prisma-cli-reference.mdx | 标记 migration 为已应用 |
| Production migrate commands | https://github.com/prisma/web/blob/main/apps/docs/content/docs/cli/migrate/index.mdx | `migrate deploy` / `status` / `resolve` |
| Prisma seeding | https://github.com/prisma/web/blob/main/web/apps/docs/content/docs/orm/prisma-migrate/workflows/seeding.mdx | seed workflow 和幂等初始化参考 |
| Architecture quality gate | https://github.com/study8677/awesome-architecture/blob/main/tutorial/04-%E5%8D%81%E5%A4%A7%E6%A0%B8%E5%BF%83%E6%9E%B6%E6%9E%84%E6%A8%A1%E5%BC%8F.md | pipeline/artifact handoff 参考 |

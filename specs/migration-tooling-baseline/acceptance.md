# Acceptance: Migration Tooling Baseline

**Date**: 2026-06-03  
**Feature**: `migration-tooling-baseline`  
**Verdict**: PASS

## Summary

本轮已建立 Prisma Migrate baseline 工作流的代码与文档基础，并已将目标 MySQL 的 baseline migration metadata 标记为 applied。当前 `prisma migrate status` 显示 database schema is up to date。真实 GitHub Actions/NAS deploy 已通过，迁移命令在容器重启前执行，部署后健康检查通过。

## Evidence

| Area | Evidence | Verdict |
|---|---|---|
| Fresh schema generation | `pnpm prisma generate --no-engine` passed. 常规 `pnpm prisma generate` 会尝试下载 `linux-musl-openssl-3.0.x` engine；本轮用 no-engine 做 schema/client 生成校验。 | PASS |
| Prisma schema validity | `pnpm prisma validate` passed. | PASS |
| Migration status | `pnpm prisma migrate resolve --applied 20260603202720_baseline` 已成功；`pnpm prisma migrate status` 和 `pnpm db:status` 显示 database schema is up to date。 | PASS |
| Baseline SQL | `prisma/migrations/20260603202720_baseline/migration.sql` 与 fresh `migrate diff --from-empty` 输出一致。 | PASS |
| Baseline preview drift | fresh baseline 相比 2026-05-23 `_research/baseline-preview.sql` 多出 `inbox_items.scoring_status` 和索引；旧 preview 还混入 Prisma upgrade 提示文本。 | PASS |
| Seed extraction | 新增 `prisma/seed.ts`，覆盖默认用户、内容类型、分类、标签组、标签、AI settings、AI prompts；`pnpm prisma db seed` 连续运行两次成功。 | PASS |
| Package scripts | `db:migrate` 改为 `pnpm prisma migrate deploy`；新增 `db:seed` 和 `db:status`；配置 `prisma.seed`。 | PASS |
| Legacy deprecation | `scripts/migrate-db.ts`、`scripts/README.md`、`scripts/run-sql-migration.sh` 已标记 legacy/deprecated。 | PASS |
| Deploy workflow | GitHub Actions run `26896308413` / deploy job `79336833413` passed。日志显示 `.github/workflows/deploy.yml` 在 `🛑 停止旧容器...` 前运行 `docker run ... pnpm prisma migrate deploy`；迁移容器接入 `1panel-network`；Prisma 输出 `No pending migrations to apply.`；随后容器重启，`/api/health` 健康检查通过。 | PASS |
| Migration docs | 新增 `docs/migration-workflow.md`，覆盖 baseline、创建迁移、deploy、seed、reset、rollback、legacy 入口。 | PASS |
| Static validation | `pnpm type-check`, `pnpm lint --quiet`, `pnpm test src/lib/services/__tests__/inbox-scoring.test.ts` passed. | PASS |

## Component / Workflow / User-Visible Outcome

| Dimension | Verdict | Notes |
|---|---|---|
| Component | PASS | baseline migration、seed、scripts、docs、workflow 文件都已落地并通过静态验证。 |
| Workflow | PASS | baseline resolve、seed 幂等性和真实 NAS deploy migration 验证均已通过。 |
| User-Visible Outcome | PASS | 开发/运维文档和 legacy 警告已可见。 |

## Deploy Evidence

- Run: `26896308413`
- Build job: `79336180629`, success.
- Deploy job: `79336833413`, success.
- Ordering evidence: `🗄️ 应用数据库迁移...` and `No pending migrations to apply.` appear before `🛑 停止旧容器...`.
- Runtime evidence: new `weekly-admin` container reached `healthy` state and `/api/health` passed.

## Residual Risks

- Prisma 6.19 对 `package.json#prisma` seed 配置提示 Prisma 7 将移除。当前 spec 明确要求 package.json seed，本轮保持该实现；后续 Prisma 7 升级时应迁移到 `prisma.config.ts`。
- GitHub Actions 提示 Node.js 20 action runtime 将在 2026-09-16 移除；当前 deploy 已通过，但后续应升级 workflow actions 或显式切换 Node.js 24 runtime。

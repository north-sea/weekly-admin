# Acceptance: Migration Tooling Baseline

**Date**: 2026-06-03  
**Feature**: `migration-tooling-baseline`  
**Verdict**: CONDITIONAL PASS

## Summary

本轮已建立 Prisma Migrate baseline 工作流的代码与文档基础，并已将目标 MySQL 的 baseline migration metadata 标记为 applied。当前 `prisma migrate status` 显示 database schema is up to date。最终 PASS 仍需要一次真实或受控 dry-run 的 GitHub Actions/NAS deploy 证据。

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
| Deploy workflow | `.github/workflows/deploy.yml` 在停止旧容器前运行 `pnpm prisma migrate deploy`，并要求 `DATABASE_URL`。未跑真实 GitHub Actions。 | PARTIAL |
| Migration docs | 新增 `docs/migration-workflow.md`，覆盖 baseline、创建迁移、deploy、seed、reset、rollback、legacy 入口。 | PASS |
| Static validation | `pnpm type-check`, `pnpm lint --quiet`, `pnpm test src/lib/services/__tests__/inbox-scoring.test.ts` passed. | PASS |

## Component / Workflow / User-Visible Outcome

| Dimension | Verdict | Notes |
|---|---|---|
| Component | PASS | baseline migration、seed、scripts、docs、workflow 文件都已落地并通过静态验证。 |
| Workflow | CONDITIONAL PASS | baseline resolve 和 seed 幂等性已通过；仍需一次真实/受控 deploy migration 验证。 |
| User-Visible Outcome | PASS | 开发/运维文档和 legacy 警告已可见。 |

## Remaining Gates

1. 触发或 dry-run GitHub Actions deploy，确认 `pnpm prisma migrate deploy` 在容器重启前执行。
2. 部署后再次确认 `/api/health` 正常，并检查部署日志中迁移步骤输出。

## Residual Risks

- Prisma 6.19 对 `package.json#prisma` seed 配置提示 Prisma 7 将移除。当前 spec 明确要求 package.json seed，本轮保持该实现；后续 Prisma 7 升级时应迁移到 `prisma.config.ts`。
- 尚未执行真实 GitHub Actions/NAS deploy，因此 deploy workflow 仍缺运行时证据。

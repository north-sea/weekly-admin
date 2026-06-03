# Migration Workflow

本项目从 `migration-tooling-baseline` 起使用 Prisma Migrate 管理 schema 变更。旧的 `scripts/migrate-db.ts` 和 `database/*.sql` 只作为历史排障入口保留，不再作为新增 schema change 的入口。

## 基线原则

- `prisma/migrations/20260603202720_baseline/migration.sql` 是当前 schema 的历史起点。
- 已有数据库不要执行 baseline SQL；使用 `prisma migrate resolve --applied 20260603202720_baseline` 标记为已应用。
- 空库、测试库或 `prisma migrate reset` 可以回放 baseline。
- 生成或标记 baseline 前必须先做 fresh drift/status 检查。

## Fresh 检查

```bash
pnpm prisma generate --no-engine
pnpm prisma migrate status
pnpm prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

检查点：

- `migrate status` 能连接目标数据库。
- 如果数据库还没有 `_prisma_migrations`，Prisma 会提示当前库尚未由 Prisma Migrate 管理。
- baseline diff 只能表达当前 schema 起点，不能混入数据写入或非预期 drop/alter。
- 不要在日志中打印 `DATABASE_URL` 或其他 secret。

## 创建新迁移

开发时修改 `prisma/schema.prisma` 后运行：

```bash
pnpm prisma migrate dev --name <change_name>
```

要求：

- 迁移文件必须位于 `prisma/migrations/<timestamp>_<name>/migration.sql`。
- 不再新增 `database/*.sql` 作为 schema 变更入口。
- 迁移 SQL 要可 review，尤其是 drop、rename、类型收窄、not null 和大表变更。

## 部署迁移

部署使用：

```bash
pnpm db:migrate
```

该命令等价于：

```bash
pnpm prisma migrate deploy
```

GitHub Actions / NAS deploy 会在停止旧容器前执行迁移。迁移失败时部署中止，不继续重启容器。

## Seed

默认数据使用 Prisma seed：

```bash
pnpm prisma db seed
```

seed 行为：

- 创建或补齐默认用户、内容类型、分类、标签组、标签、AI settings、AI prompts。
- seed 幂等，可重复运行。
- seed 不创建或修改表结构。
- seed 不写入生产 secret；AI provider API key 等敏感配置仍由环境变量或后台配置管理。

## 本地重置

仅用于本地/测试环境：

```bash
pnpm prisma migrate reset
```

该命令会删除并重建数据库，然后回放 migrations 并执行 seed。不要在生产环境运行。

## 生产 Baseline Resolve

首次接入既有生产库时：

1. 确认已备份数据库，或有可恢复 checkpoint。
2. 运行 fresh 检查，确认 schema 与 baseline 对齐。
3. 标记 baseline：

```bash
pnpm prisma migrate resolve --applied 20260603202720_baseline
```

4. 再运行：

```bash
pnpm prisma migrate status
```

预期状态：baseline 已应用，没有 pending baseline。

## 失败与回滚

不要假设 MySQL DDL 都能自动事务回滚。生产回滚主路径：

1. 停止继续发布。
2. 查看 `prisma migrate status` 和部署日志，确认失败迁移。
3. 优先编写 forward-fix migration 修复 schema。
4. 如数据或结构损坏，使用发布前备份/checkpoint 恢复。
5. 必要时使用 `prisma migrate resolve` 标记 failed migration 状态，但只能在确认 DB 实际状态后执行。

## Legacy 入口

- `scripts/migrate-db.ts`：历史自定义 schema/seed 脚本，已 deprecated。
- `scripts/run-sql-migration.sh`：历史裸 SQL runner，已 deprecated。
- `database/*.sql`：历史 SQL 文件，后续 feature 不应新增此类 schema 变更文件。

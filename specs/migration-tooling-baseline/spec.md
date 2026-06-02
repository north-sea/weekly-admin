# Feature Specification: Migration Tooling Baseline

**Workspace**: `migration-tooling-baseline`
**Created**: 2026-05-23
**Status**: Draft
**Input**: 用户问题: "顺便检查下,为啥这些migrate都没走标准流程而是自己实现脚本?能否改成标准流程?" + 决策: "那就按 c 来吧,但是要把这个 f1.5 的 prd 写清楚"

> 本 spec 定义 F1.5 (migration-tooling-baseline),在 F1 (inbox-ai-scoring) 完成后、F2 (preference-learning) 开始前,将项目从"自定义迁移脚本 + 裸 SQL"切换到"标准 Prisma migrate 工作流 + 独立 seed"。
> 上游文档:`docs/automation-plan-admin.md` (v2.2) 的 Feature 拆分章节。

---

## 现状摘要(写 spec 前的范围级只读探索结论)

代码库当前迁移方式:

| 组件 | 现状 | 文件 |
|---|---|---|
| 迁移脚本 | ✅ 自定义 TypeScript 脚本,36 个 schema 操作 + 2 个数据迁移 + 5 类 seed | `scripts/migrate-db.ts` (711 行) |
| 裸 SQL 文件 | ✅ 用于特定变更,无幂等性检查 | `database/*.sql` (3 个文件) |
| Prisma 迁移表 | ❌ 不存在 `_prisma_migrations` 表 | 无 |
| 迁移历史 | ❌ 无结构化历史记录 | 无 |
| Seed 分离 | ❌ seed 逻辑混在 `migrate-db.ts` 中 | 无 |
| CI/CD 自动化 | ❌ Docker 构建和 GitHub Actions 都不跑迁移 | `.github/workflows/deploy.yml` / `docker/Dockerfile` |

**为什么会这样**:

- 项目从已有数据库启动,用 `prisma db pull` 生成初始 schema
- 后续变更用自定义脚本 + 裸 SQL,从未切换到 `prisma migrate`
- `migrate-db.ts` 用 `SHOW COLUMNS LIKE` 实现幂等性,避免重复执行报错
- 部署时手动跑 `pnpm migrate` 或 `./scripts/run-sql-migration.sh`,无自动化

**当前数据库状态**(2026-05-23 探查):

- MySQL 8.4.5,18 张表,无 schema drift
- `inbox_items`: 566 条记录
- `contents`: 1404 条记录
- 所有表结构与 `prisma/schema.prisma` 一致

**F1.5 要解决的问题**:

| 问题 | 影响 | F1.5 目标 |
|---|---|---|
| **无迁移历史** | 无法回滚,无法追溯变更 | 建立 `_prisma_migrations` 表,记录所有后续变更 |
| **seed 混在迁移里** | 开发环境重置困难,seed 逻辑难维护 | 抽出独立 `prisma/seed.ts` |
| **部署无自动化** | 依赖人工记得跑脚本,易遗漏 | CI/CD 自动跑 `prisma migrate deploy` |
| **幂等性靠手写** | 每次加字段都要写 `SHOW COLUMNS`,易出错 | Prisma 自动管理已应用迁移 |
| **裸 SQL 无版本** | `database/*.sql` 文件无法追踪是否已应用 | 统一到 `prisma/migrations/` 目录 |

**关键决策已确认 (clarify 阶段已收口)**:

- **切换时机**: F1 完成后,F2 开始前(F1 已用 `database/inbox_scoring_baseline.sql`,F2 起用新流程)
- **历史迁移**: 不回溯,用 `prisma migrate diff --from-empty` 生成 baseline,`prisma migrate resolve --applied` 标记为已应用
- **现有脚本**: `migrate-db.ts` 保留但标记为 deprecated,`database/*.sql` 工作流在 F1.5 后废弃
- **部署策略**: 先在 dev 环境验证 baseline,再在 prod 环境 `prisma migrate resolve`,最后更新 CI/CD

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 开发者清晰的迁移历史 (Priority: P1)

作为开发者,我希望每次 schema 变更都有清晰的迁移记录,
这样我能看到变更历史、回滚错误变更、理解 schema 演进过程。

**Why this priority**: 这是 F1.5 的核心价值。没有迁移历史,团队无法安全地演进 schema,
每次变更都是"黑盒操作",出问题无法追溯。

**Acceptance Scenarios**:

1. **[US1-1] 查看迁移历史**
   **Given** F1.5 已上线,baseline 已生成
   **When** 开发者运行 `rtk pnpm prisma migrate status`
   **Then**
   - 显示 baseline 迁移已应用
   - 显示所有后续迁移的状态(pending/applied)
   - 每个迁移有清晰的名称和时间戳

2. **[US1-2] 创建新迁移**
   **Given** 开发者修改了 `prisma/schema.prisma`(例如给 `contents` 加字段)
   **When** 运行 `rtk pnpm prisma migrate dev --name add_content_field`
   **Then**
   - Prisma 自动生成 SQL 迁移文件
   - 迁移文件在 `prisma/migrations/<timestamp>_add_content_field/migration.sql`
   - 本地数据库自动应用迁移
   - `_prisma_migrations` 表记录新迁移

3. **[US1-3] 回滚迁移**
   **Given** 最新迁移有问题
   **When** 开发者删除迁移文件,运行 `rtk pnpm prisma migrate resolve --rolled-back <migration_name>`
   **Then** `_prisma_migrations` 表标记该迁移为已回滚

**Edge Cases**:

- **[US1-4] baseline 与实际 DB 不一致**
  生成 baseline 后发现与生产 DB 有差异 → 重新生成 baseline,对比差异,手动调整
- **[US1-5] 多人并行开发迁移冲突**
  两个分支都修改 schema → 合并时 Prisma 会检测冲突,需手动解决

---

### User Story 2 - 运维自动化部署迁移 (Priority: P1)

作为运维,我希望部署时自动应用数据库迁移,
这样我不必记得手动跑脚本,减少人为遗漏风险。

**Why this priority**: P1 是因为手动迁移是生产事故的常见来源。
自动化迁移是 F1.5 的第二核心价值。

**Acceptance Scenarios**:

1. **[US2-1] Docker 构建时生成 Prisma Client**
   **Given** Dockerfile 已更新
   **When** 运行 `docker build`
   **Then**
   - 构建阶段运行 `pnpm prisma generate`
   - 不运行 `prisma migrate`,避免构建时修改数据库

2. **[US2-2] 部署时自动应用迁移**
   **Given** GitHub Actions workflow 已更新
   **When** 推送到 `main` 分支触发部署
   **Then**
   - 部署脚本在启动容器前运行 `prisma migrate deploy`
   - 只应用未应用的迁移
   - 迁移失败时部署中止

3. **[US2-3] 生产环境迁移日志**
   **Given** 生产部署完成
   **When** 查看部署日志
   **Then** 日志显示哪些迁移被应用,耗时多久

**Edge Cases**:

- **[US2-4] 迁移失败回滚**
  迁移应用到一半失败 → Prisma 事务回滚,数据库保持原状,部署中止
- **[US2-5] 无待应用迁移**
  部署时所有迁移已应用 → `prisma migrate deploy` 静默退出,不报错

---

### User Story 3 - 团队协作与回滚能力 (Priority: P2)

作为团队成员,我希望能安全地回滚有问题的迁移,
并且团队成员之间的迁移不会互相干扰。

**Why this priority**: P2 是因为回滚场景相对少见,但一旦需要就很关键。

**Acceptance Scenarios**:

1. **[US3-1] 本地重置数据库**
   **Given** 开发者想清空本地数据库重新开始
   **When** 运行 `rtk pnpm prisma migrate reset`
   **Then**
   - 删除所有表
   - 重新应用所有迁移
   - 运行 `prisma/seed.ts` 填充初始数据

2. **[US3-2] 生产环境回滚迁移**
   **Given** 生产环境应用了有问题的迁移
   **When** 运维编写反向迁移 SQL,创建新迁移
   **Then** 新迁移撤销问题变更,数据库恢复正常

**Edge Cases**:

- **[US3-3] seed 依赖特定 schema**
  迁移回滚后 seed 可能失败 → seed 脚本需要健壮处理,或手动调整

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须生成 baseline 迁移,包含当前所有 18 张表的 CREATE TABLE 语句
- **FR-002**: baseline 迁移必须通过 `prisma migrate resolve --applied` 标记为已应用,不实际执行 SQL
- **FR-003**: 系统必须创建独立的 `prisma/seed.ts`,包含 5 类 seed 逻辑(用户/分类/标签/AI 设置/AI prompts)
- **FR-004**: `prisma/seed.ts` 必须幂等,可重复运行不报错
- **FR-005**: `package.json` 必须添加 `"prisma": { "seed": "tsx prisma/seed.ts" }` 配置
- **FR-006**: Dockerfile 必须在构建阶段运行 `pnpm prisma generate`,不运行迁移
- **FR-007**: GitHub Actions workflow 必须在部署前运行 `prisma migrate deploy`
- **FR-008**: `scripts/migrate-db.ts` 必须标记为 deprecated,添加警告注释
- **FR-009**: `database/*.sql` 工作流必须在文档中标记为废弃,F2 起不再使用
- **FR-010**: 系统必须提供迁移工作流文档,说明如何创建/应用/回滚迁移

### Non-Functional Requirements

- **NFR-001 (零停机)**: baseline 标记为已应用时,不修改数据库,不影响生产服务
- **NFR-002 (向后兼容)**: F1.5 上线后,`pnpm migrate` 命令仍可用(内部调 `prisma migrate deploy`)
- **NFR-003 (可回滚)**: 所有迁移必须可通过反向迁移回滚
- **NFR-004 (文档完整)**: 迁移工作流文档必须覆盖开发/部署/回滚三个场景

### Key Entities

- **_prisma_migrations** (新表)
  - Prisma 自动创建,记录迁移历史
  - 字段:`id` / `checksum` / `finished_at` / `migration_name` / `logs` / `rolled_back_at` / `started_at` / `applied_steps_count`

- **prisma/migrations/** (新目录)
  - `<timestamp>_baseline/migration.sql` - baseline 迁移(414 行,18 张表)
  - 后续迁移按 `<timestamp>_<name>/migration.sql` 格式

- **prisma/seed.ts** (新文件)
  - 从 `scripts/migrate-db.ts` 抽取的 seed 逻辑
  - 5 类 seed:
    1. ADMIN 用户(id=1)
    2. 默认分类(技术/工具/资源等)
    3. 默认标签(JavaScript/React/Node.js 等)
    4. AI 设置(4 个 key,见 F1 spec)
    5. AI prompts(inbox_scoring scene)

- **scripts/migrate-db.ts** (现有文件,标记 deprecated)
  - 保留但不再维护
  - 顶部添加注释:
    ```typescript
    /**
     * @deprecated
     * This script is deprecated after F1.5 (migration-tooling-baseline).
     * Use `pnpm prisma migrate dev` for new migrations.
     * Use `pnpm prisma db seed` for seeding.
     */
    ```

- **database/*.sql** (现有文件,标记废弃)
  - F1 最后一次使用(`inbox_scoring_baseline.sql`)
  - F2 起不再使用,文档中说明

---

## Business Metrics *(optional — 上线后度量)*

- **BM-001**: F1.5 上线后,F2 开发周期中 schema 变更全部通过 `prisma migrate` 完成
- **BM-002**: 部署失败率中"忘记跑迁移"类事故降为 0
- **BM-003**: 迁移回滚操作可在 10 分钟内完成(含编写反向迁移)

---

## Out of Scope

明确不在 F1.5 范围内:

- ❌ **重写 F1 使用新工作流** — F1 已用 `database/inbox_scoring_baseline.sql`,不回头改
- ❌ **迁移历史回溯** — 不为历史变更补迁移文件,baseline 是起点
- ❌ **数据库结构变更** — F1.5 只切换工具,不改 schema
- ❌ **多数据库支持** — 继续只支持 MySQL
- ❌ **迁移测试自动化** — 不在 F1.5 引入迁移测试框架(可在后续 feature 考虑)

---

## Clarifications (已收口)

进入 plan 阶段前已确认的关键决议:

- **Q1 — 何时切换**:**F1 完成后,F2 开始前**。F1 最后一次用旧流程(`database/inbox_scoring_baseline.sql`),F2 起用新流程。
- **Q2 — 历史迁移怎么办**:**不回溯**。用 `prisma migrate diff --from-empty` 生成 baseline,包含当前所有表,`prisma migrate resolve --applied` 标记为已应用。
- **Q3 — 现有脚本怎么办**:**保留但 deprecated**。`migrate-db.ts` 加警告注释,`database/*.sql` 工作流文档标记废弃。
- **Q4 — 部署策略**:**先 dev 验证,再 prod resolve,最后更新 CI/CD**。生产环境用 `prisma migrate resolve` 标记 baseline,不实际执行 SQL。
- **Q5 — seed 分离**:**必须分离**。抽出独立 `prisma/seed.ts`,`package.json` 配置 `prisma.seed`,`prisma migrate reset` 自动调用。

---

## Stage Readiness

- **下一步建议**: `plan`
  - 理由:Q1–Q5 已全部收口,FR/Key Entities/Out of Scope 均已对齐,无遗留歧义,可直接进入技术方案设计。
- **F1.5 需落地的关键产物**:
  1. `prisma/migrations/<timestamp>_baseline/migration.sql` - 414 行 baseline(已在 `_research/baseline-preview.sql` 预览)
  2. `prisma/seed.ts` - 从 `migrate-db.ts` 抽取的 seed 逻辑
  3. `package.json` - 添加 `prisma.seed` 配置
  4. `docker/Dockerfile` - 确保只 `prisma generate`,不 `migrate`
  5. `.github/workflows/deploy.yml` - 部署前加 `prisma migrate deploy`
  6. `docs/migration-workflow.md` - 迁移工作流文档
  7. `scripts/migrate-db.ts` - 顶部加 deprecated 注释
- **阻塞项**: 无
- **风险**:
  - **R1 (低)**: baseline 与生产 DB 不一致 — 已验证无 drift,风险低
  - **R2 (中)**: 生产环境 `prisma migrate resolve` 需停机 — 不需要,resolve 只写 `_prisma_migrations` 表,不改 schema
  - **R3 (低)**: 现有调用方依赖 `migrate-db.ts` — 只有 `package.json` 的 `migrate` 命令,改为调 `prisma migrate deploy` 即可

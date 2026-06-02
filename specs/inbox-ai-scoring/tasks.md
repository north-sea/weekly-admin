# Tasks: Inbox AI 评分自动闭环

**Workspace**: `inbox-ai-scoring` | **Date**: 2026-05-22
**Input**: `specs/inbox-ai-scoring/spec.md` + `plan.md`
**Prerequisites**: spec.md ✅, plan.md ✅, data-model.md ❌ (已合并入 plan)

> 本 tasks 同时落地 F0 schema-baseline(无独立 feature)。
> 任务 ID 命名:`T<phase><seq>`,例如 P1 阶段第一条是 `T101`。

---

## 执行原则

- **可并行任务用 `[P]` 标记**(无依赖、不同文件)
- **关键路径**:Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 5 → Phase 6(Phase 4 反馈采集可并行 Phase 5)
- 每个任务带:
  - **scope**:涉及文件/模块边界
  - **verify**:本地验证方式
  - **deps**:依赖的前置任务(若无写"无")
  - **覆盖**:对应的 FR / US / NFR / Risk(便于追溯)

---

## Phase 0: 前置 Spike(可选,但强烈推荐)

**目标**: 用最小代价验证 plan 里的关键选型,失败则回到 plan 调整。

- [x] **T001 [P] [Spike] 验证 croner + instrumentation.ts 在 dev 模式下的可重启幂等性**
  - scope: 临时创建 `src/instrumentation.ts`,注册一条 `*/1 * * * *` 的 dummy job(只打印一行日志),改一次源码触发 dev 热重载,观察日志是否只打一次
  - verify: 修改任意文件触发 hot reload 后,dummy job 仍只每分钟打一次日志(`globalThis` 哨兵生效)
  - deps: 无
  - 覆盖: Decision 4 / R2

- [x] **T002 [P] [Spike] 起草 inbox_scoring prompt v1 并跑 5 条样本**
  - scope: 在 `prompt-drafts/inbox-scoring-v1.txt` 草拟 prompt,用现有 `serverGenerateJSON` 跑 5 条真实 inbox_items 样本,人工校对输出能否稳定符合 6 维 JSON schema
  - verify: 5 条样本中 ≥ 4 条 LLM 输出可被新 `ScoreSchema.safeParse` 成功;若不行,迭代 prompt 至达标
  - deps: 无
  - 覆盖: FR-015 / R8 / plan S2

---

## Phase 1: Schema Baseline(F0 合并)

**目标**: 完成数据库与 Prisma schema 变更,跑通 `db:generate`,不破坏现有功能。

- [x] **T101 [Schema] 编写 `database/inbox_scoring_baseline.sql`**
  - scope: 新建 `database/inbox_scoring_baseline.sql`,含 5 个 SQL 段(scoring_status 列+索引 / contents.auto_promoted 列+索引 / 历史回填 done / ai_settings seed 4 个 key / 占位注释 ai_prompts)。同时在 `scripts/migrate-db.ts` 末尾追加幂等执行逻辑(SHOW COLUMNS 检查后 ALTER)
  - verify: SQL 文件可读,语义对照 plan.md "Migration SQL(单文件)" 节;`rtk pnpm migrate` 可重复执行不报错
  - deps: T001(可选)
  - 覆盖: FR-003 / FR-017 / spec Stage Readiness 4 项

- [x] **T102 [Schema] 修改 `prisma/schema.prisma` 添加 `inbox_items.scoring_status` + 索引**
  - scope: 在 `model inbox_items` 添加 `scoring_status String? @default("pending") @db.VarChar(20)`,在 `@@index` 末加 `@@index([scoring_status, created_at])`
  - verify: 文件保存后无 lint 报错
  - deps: 无
  - 覆盖: FR-003 / FR-004

- [x] **T103 [Schema] 修改 `prisma/schema.prisma` 添加 `contents.auto_promoted` + 索引**
  - scope: 在 `model contents` 添加 `auto_promoted Boolean? @default(false)`,加 `@@index([auto_promoted, created_at])`
  - verify: 同上
  - deps: 无(可与 T102 并行,但同改一个文件,顺序执行更稳)
  - 覆盖: FR-017 / K8

- [x] **T104 [Schema] 执行迁移 + 生成 Prisma Client**
  - scope: 命令:`rtk pnpm migrate`(走 scripts/migrate-db.ts 幂等逻辑)后 `rtk pnpm db:generate`
  - verify: migration 应用成功;`prisma.inbox_items.scoring_status` 与 `prisma.contents.auto_promoted` 在 TypeScript 类型中可访问
  - deps: T102, T103
  - 覆盖: R1 验证 / NFR-006(向后兼容回归基线)

- [x] **T105 [Schema] 验证历史回填正确性**
  - scope: SQL 查询 `SELECT scoring_status, COUNT(*) FROM inbox_items GROUP BY scoring_status`
  - verify: `ai_score IS NOT NULL` 的记录数 = `scoring_status='done'` 的记录数;其余应为 `pending`
  - deps: T104
  - 覆盖: Decision 7

---

## Phase 2: 评分服务核心升级

**目标**: 把 `inbox-scorer.ts` 改造为 6 维输出 + 拆出纯计算函数,引入新 `ScoreDetails` JSON shape。

- [x] **T201 [Scorer] 升级 `AiPromptScene` union 与 `DEFAULT_AI_PROMPTS`**
  - scope: 修改 `src/lib/services/ai-prompt.ts`,union 加 `'inbox_scoring'`,`DEFAULT_AI_PROMPTS` 加 inbox_scoring 一项(prompt 文本来自 T002 定稿)
  - verify: `AiPromptService.getByScene('inbox_scoring')` 在 DB 无记录时也能返回默认值(若 service 支持兜底则一并测)
  - deps: T002, T104
  - 覆盖: Decision 1 / FR-015

- [x] **T202 [Scorer] 重写 `inbox-scorer.ts` 的 `ScoreSchema` 为 6 维 + overall**
  - scope: 替换 `src/lib/ai/server/inbox-scorer.ts` L9-15 的 zod schema 为 plan.md Decision 2 形态:`{ dimensions: {...6 维...}, overall, reasons }`
  - verify: `pnpm type-check` 通过,旧的 4 维字段引用全部消除
  - deps: T201
  - 覆盖: FR-015 / FR-016

- [x] **T203 [Scorer] 抽出 `calculateInboxScore` 纯计算函数 + 兼容 `scoreInboxItem`**
  - scope: 在同文件新增 `calculateInboxScore(inboxId)` 返回 `{ totalScore, details, reasons }`(不再 prisma.update);保留 `scoreInboxItem` 作为 thin wrapper 调用新的 InboxScoringService(P3 实现);保留 `batchScoreInboxItems` 同理转发
  - verify: 现有调用方(sync-orchestrator L539、score-batch route)语法层面不破
  - deps: T202
  - 覆盖: 模块设计 inbox-scorer / NFR-006

- [x] **T204 [Scorer] 升级 `AiScoreDetails` type 与加权聚合函数**
  - scope: 同文件新增 `AiScoreDetails` 类型(plan.md Data Model "ai_score_details JSON Shape (新版)" 完整字段);新增 `aggregateAiQuality(dimensions)` 函数,实现 `(15·topic+25·content+20·depth+20·practical+10·innovation+10·expression)/100 ×4 → round`
  - verify: 单元测试: 6 维全 10 → ai_quality=40;全 0 → 0;边界 5 → 20
  - deps: T203
  - 覆盖: FR-015 / FR-016 / V1

- [x] **T205 [Scorer] 单元测试 `calculateInboxScore` 与加权公式**
  - scope: 新建 `src/lib/ai/server/__tests__/inbox-scorer.test.ts`,mock `serverGenerateJSON` + `prisma.inbox_items.findUnique`,覆盖:(a) Karakeep 失败 → 0 分;(b) 无摘要 → 0 分;(c) 正常 6 维输入 → 总分公式正确
  - verify: `rtk pnpm test inbox-scorer` 通过
  - deps: T204
  - 覆盖: V1

---

## Phase 3: 状态机 + 调度服务

**目标**: 新增 `InboxScoringService`,封装 CAS 抢占、状态迁移、批量拾取、超时回收。

- [x] **T301 [Service] 创建 `lib/services/inbox-scoring.ts` 骨架**
  - scope: 新建文件,导出 `InboxScoringService` 类含 `runOne` / `runBatch` / `sweepStaleProcessing` 三个方法的空壳(标 `TODO`)
  - verify: import 不报错
  - deps: T204
  - 覆盖: 模块设计 InboxScoringService

- [x] **T302 [Service] 实现 `sweepStaleProcessing`(超时回收)**
  - scope: `prisma.$executeRaw` 写 plan.md Decision 3 的 SQL,把 `scoring_status='processing'` 且 `ai_score_details.last_scored_at` 距今超过 N 分钟(从 `ai_settings.inbox_scoring_processing_timeout_minutes` 读)的记录重置为 `pending`
  - verify: 集成测试:插入一条 processing + last_scored_at=now()-15min 记录,跑 sweep,断言变 pending
  - deps: T301
  - 覆盖: FR-007 / NFR-003 / V3

- [x] **T303 [Service] 实现 `runOne(inboxId, opts)` 含 CAS 抢占**
  - scope: 实现伪流程(plan.md 模块设计):force 时重置 → CAS updateMany → markStarted(写 last_scored_at) → calculateInboxScore → 判定阈值 → markDone 或 promoteAtomic(P4 提供) → 失败时 markFailed(retry_count++)
  - verify: 单元测试两并发 runOne 同 id,断言只一个成功(`scored:true`),另一个 `scored:false`
  - deps: T302
  - 覆盖: FR-005 / FR-006 / US2-1 / V2

- [x] **T304 [Service] 实现 `runBatch(opts)` 拾取 pending 项**
  - scope: 入口先 `sweepStaleProcessing`,再 `SELECT id FROM inbox_items WHERE scoring_status IN ('pending') OR scoring_status NOT IN ('processing','done','failed') AND retry_count<3 ORDER BY created_at ASC LIMIT N`,逐条 `runOne` + 配置化延迟
  - verify: 集成测试:插入 N 条 pending,跑 runBatch,断言全部 → done;插入 1 条 retry_count=3,断言被跳过
  - deps: T303
  - 覆盖: FR-008 / FR-006 / US3-1 / US2-5

- [x] **T305 [Service] 接入 `AiSettingsService` 读 4 个 F1 key**
  - scope: 修改 `src/lib/services/ai-settings.ts`:`DEFAULT_AI_SETTINGS` 加 `inbox_promotion_threshold/inbox_scoring_enabled/inbox_scoring_batch_size/inbox_scoring_processing_timeout_minutes`;`normalizeSettingValue` 加分支处理 `{ value: number }` / `{ value: boolean }` 兜底;在 `inbox-scoring.ts` 中用 `AiSettingsService.get(key)` 读取
  - verify: 删除 ai_settings 中的 key,服务仍按默认值工作(US1-6)
  - deps: T301
  - 覆盖: FR-001 / FR-009 / US1-6

- [x] **T306 [Service] 失败重试 + retry_count 上限**
  - scope: runOne catch 块写 markFailed:`scoring_status='failed'`,在 `ai_score_details` JSON 内 `retry_count++`、`error=message`、`last_scored_at=now`;runBatch 拾取条件加 `retry_count<3`(读 JSON 字段)
  - verify: 单元测试:让 scoreInboxItem mock 抛错 4 次,断言第 4 次起 scoring_status='failed' 且不被 runBatch 拾取
  - deps: T303
  - 覆盖: FR-006 / US2-3 / V4

---

## Phase 4: 自动晋升原子事务 + 反馈采集

**目标**: 阈值判定通过时,在单事务内创建 content + 更新 inbox;写 operation_logs。

- [x] **T401 [Promotion] 抽取 `buildContentDataForPromotion` helper**
  - scope: 把 `src/lib/services/inbox.ts` `promoteInboxItem` L196-267 的 content 构造逻辑(slug 生成、category 解析、tag suggestion 处理、markdown 拼接等)提取为独立函数 `buildContentDataForPromotion(item)`;两个调用方共用
  - verify: `pnpm type-check`;手动晋升路径(`promoteInboxItem`)行为不变
  - deps: T104
  - 覆盖: 模块设计 promotion / NFR-006

- [x] **T402 [Promotion] 创建 `lib/services/inbox-scoring-promotion.ts` 实现 `promoteAtomic`**
  - scope: 新文件,导出 `promoteAtomic(inboxId, scoreResult)` 用 `prisma.$transaction(async tx => ...)`:防重检查(content_id 已存在 → 仅 update 不创建)→ tx.contents.create({...buildContentDataForPromotion, auto_promoted:true, original_score, ai_metadata}) → tx.inbox_items.update({ai_score, ai_score_details, scoring_status:'done', status:'promoted', auto_promoted:true, content_id})
  - verify: 集成测试:插入 mock 失败让 inbox_items.update 抛错,断言 contents 行也被回滚(V5)
  - deps: T401, T306
  - 覆盖: FR-002 / FR-012 / FR-017 / US1-1 / US1-4 / US1-8 / V5 / V6

- [x] **T403 [Promotion] 在 `runOne` 中接入 `promoteAtomic`**
  - scope: 修改 `inbox-scoring.ts` `runOne`:`totalScore >= threshold && totalScore > 0` 时调 `promoteAtomic`,否则 markDone(仅更新 ai_score/details/scoring_status)
  - verify: 集成测试覆盖 US1-1 / US1-2 / US1-5 / US1-7
  - deps: T402
  - 覆盖: FR-001 / US1-1 / US1-2 / US1-5 / US1-7

- [x] **T404 [Logging] 扩展 `OperationLogger` 增加 `logInboxAction` 语义层**
  - scope: 修改 `src/lib/middleware/operation-logger.ts`,新增方法 `logInboxAction({ userId, action, inboxItemId, contentId?, aiScoreAtAction?, reason?, source })`,内部根据 action 决定 operation_type(promote/demote/feature/unfeature/reject → UPDATE;delete → DELETE),拼装 `operation_details` JSON 符合 spec.md Key Entities 约定
  - verify: 单元测试:不同 action 映射到正确 operation_type;operation_details 含 5 个必填字段
  - deps: T104
  - 覆盖: FR-013 / Decision 5

- [x] **T405 [Logging] 在 `promoteAtomic` 后写 operation_logs(action='promote', source='cron'|'sync'|'api')**
  - scope: 修改 `inbox-scoring-promotion.ts`:事务成功后(事务外)调 `OperationLogger.logInboxAction` 写入;失败仅 `console.error`,不抛错
  - verify: 集成测试:自动晋升一条,查询 operation_logs 含 action='promote' 且 source 正确
  - deps: T402, T404
  - 覆盖: FR-013 / US4-1 / US4-5

- [x] **T406 [Logging] 在 `InboxService.promoteInboxItem` 手动晋升路径写 operation_logs(source='admin-ui')**
  - scope: 修改 `src/lib/services/inbox.ts` L301 后,调 `OperationLogger.logInboxAction({ action:'promote', source:'admin-ui', userId:ctx.userId, ... })`;`promoteInboxItem` 签名加可选 `ctx?: { userId, source }` 参数,调用方(路由层)传入
  - verify: 集成测试:手动晋升一条,operation_logs 含 source='admin-ui';未传 ctx 时用 SYSTEM_USER_ID
  - deps: T404
  - 覆盖: FR-013 / US4-1

---

## Phase 5: 调度器 + API 路由

**目标**: 进程内 cron 启动入口、`POST /api/v1/ai/score`、`GET /api/v1/ai/feedback/digest` 骨架。

- [x] **T501 [Deps] 添加 `croner` 依赖**
  - scope: `rtk pnpm add croner` (固定版本 `^9.x`)
  - verify: package.json 含 croner;`import { Cron } from 'croner'` 不报错
  - deps: 无(可在 Phase 0 完成)
  - 覆盖: Decision 4

- [x] **T502 [Scheduler] 创建 `lib/scheduling/inbox-scoring-scheduler.ts`**
  - scope: 实现 plan.md "Module: inbox-scoring-scheduler" 的伪代码:`startInboxScoringScheduler`(`globalThis.__inboxScoringSchedulerStarted` 哨兵 + `new Cron('0 * * * *', { name, protect:true }, async () => { ... })`)与 `stopInboxScoringScheduler`;job handler 内读 `inbox_scoring_enabled` 开关 + try/catch 包死异常
  - verify: 单元测试调用两次 start,内部 `new Cron` 只执行一次
  - deps: T501, T304, T305
  - 覆盖: FR-008 / FR-009 / US3-1 / US3-2 / R2

- [x] **T503 [Scheduler] 新增 `src/instrumentation.ts` Next.js 启动钩子**
  - scope: 新建文件,实现 plan.md Decision 4 伪代码:`export async function register()`,判断 `NEXT_RUNTIME==='nodejs'` 且 `DISABLE_INBOX_SCORING_CRON !== '1'` 且 `NODE_ENV !== 'test'` 且 `NEXT_PHASE !== 'phase-production-build'` 时,动态 import + 调 `startInboxScoringScheduler`
  - verify: 启动 `rtk pnpm dev`,日志含 `[scheduler] inbox-scoring registered`;触发热重载,日志只出现一次(R2 验证)
  - deps: T502
  - 覆盖: FR-008 / R2

- [x] **T504 [API] 新建 `POST /api/v1/ai/score` 路由**
  - scope: 新建 `src/app/api/v1/ai/score/route.ts`,zod 入参 `{ inbox_id: string, force?: boolean }`,鉴权沿用现有 admin auth middleware,调 `InboxScoringService.runOne(BigInt(inbox_id), { force, source:'api' })`,返回 `{ scored, score?, promoted?, content_id?, error? }`;同时写 operation_logs(action='manual_rescore', source='api')
  - verify: curl POST 强制重评一条已 done 记录,断言 scoring_status 重新走 pending → done(US2-6 / M6)
  - deps: T306, T403, T405
  - 覆盖: FR-010 / US2-6 / M6

- [x] **T505 [API] 新建 `GET /api/v1/ai/feedback/digest` 骨架路由**
  - scope: 新建 `src/app/api/v1/ai/feedback/digest/route.ts`,zod 入参 `{ from?, to?, format? }`,F1 返回固定骨架 `{ range:{from,to}, actions:[], counts:{}, note:'F1 baseline; F2 will populate' }`
  - verify: curl GET 返回 200 与上述结构
  - deps: T104
  - 覆盖: FR-014 / US4-2

- [x] **T506 [API] 改造 `app/api/inbox/score-batch/route.ts` 内部转发**
  - scope: 修改路由,内部调 `InboxScoringService.runBatch({ limit, delayMs, source:'api' })`,接口契约不变(出入参 shape 同前)
  - verify: 旧调用 curl `/api/inbox/score-batch` 响应 shape 不变(R1 回归)
  - deps: T304
  - 覆盖: NFR-006 / R1

- [x] **T507 [Integration] 改造 `SyncOrchestrator` 调用点**
  - scope: 修改 `src/lib/services/sync-orchestrator.ts` L539,从 `scoreInboxItem(item.id)` 改为 `InboxScoringService.runOne(item.id, { source:'sync' })`(动态 import 保持不变)
  - verify: 跑一次 sync,日志显示同步后联动评分仍走通,且新评分项 scoring_status='done'
  - deps: T303
  - 覆盖: NFR-006 / R2 验证

---

## Phase 6: 测试与回归

**目标**: 覆盖 plan.md V1–V6 单元/集成测试 + M1–M6 手工验证 + R1–R5 回归。

- [x] **T601 [Test] 单元测试 V2:并发 CAS 抢占**
  - scope: 测试用 `Promise.all([runOne(id), runOne(id)])`,断言只一个 `scored:true`
  - verify: `rtk pnpm test inbox-scoring` 通过
  - deps: T303
  - 覆盖: V2 / US2-1

- [x] **T602 [Test] 单元测试 V3:sweep 回收**
  - scope: 已在 T302 部分实现,补充端到端断言
  - verify: 同上
  - deps: T302
  - 覆盖: V3 / US2-2

- [x] **T603 [Test] 单元测试 V4:retry 上限**
  - scope: 已在 T306 部分实现,补充断言"第 4 次 mock 抛错时记录不再被拾取"
  - verify: 同上
  - deps: T306
  - 覆盖: V4 / US2-3

- [x] **T604 [Test] 单元测试 V5+V6:事务回滚 + 防重复**
  - scope: V5 用 prisma mock 让 inbox_items.update 抛错,断言 contents.create 也被回滚;V6 给已有 content_id 的 inbox 强制重评,断言不重复创建
  - verify: 同上
  - deps: T402, T504
  - 覆盖: V5 / V6 / US1-4 / US1-8

- [ ] **T605 [Manual] 手工验证 M1–M6**
  - scope: 按 plan.md "手工验证" 节逐条执行:dev 启动日志 / 10 条样本压测 / 阈值切换 / disable 开关 / kill -9 恢复 / 强制重评
  - verify: M1–M6 通过; M2 按 10 条样本验证,接口暂未采集逐条 P95
  - deps: T504, T507
  - 覆盖: M1–M6 / NFR-001 / NFR-003 / US1-3 / US3-2

- [x] **T606 [Regression] 回归 R1–R5**
  - scope: 逐项验证:`/api/inbox/score-batch` 旧契约 / SyncOrchestrator 联动评分 / admin UI AI 评分页 / `pnpm lint && pnpm type-check` / `pnpm db:generate`
  - verify: 5 项全部通过
  - deps: T506, T507
  - 覆盖: R1–R5 / NFR-006

- [x] **T607 [Doc] 补 README / 运维说明**
  - scope: 在 `docs/automation-plan-admin.md` 或新建 `docs/inbox-ai-scoring-ops.md` 写:`DISABLE_INBOX_SCORING_CRON`、`INBOX_SCORING_SYSTEM_USER_ID` 环境变量、cron 频率调整方法、出现 `scoring_status='failed'` 怎么排查
  - verify: 文档可读,关键变量都覆盖
  - deps: T503
  - 覆盖: 运维可维护性

---

## 依赖与顺序

### 关键路径(必须串行)

```
Phase 0 (Spike,可跳过) → Phase 1 (Schema) → Phase 2 (Scorer 升级)
                                                    ↓
                                          Phase 3 (State machine)
                                                    ↓
                                          Phase 4 (Promotion + Logging)
                                                    ↓
                                          Phase 5 (Scheduler + API)
                                                    ↓
                                          Phase 6 (Test + Regression)
```

### 可并行任务

- **Phase 0** T001 / T002:完全独立
- **Phase 1** T102 / T103:都改 `schema.prisma`,顺序执行更稳
- **Phase 2** T205 单元测试:T204 完成后即可写,与 Phase 3 启动并行
- **Phase 4** T401:不依赖 Phase 2,可与 Phase 2 同时启动
- **Phase 5** T501 (croner 依赖) / T505 (digest 骨架):无 Phase 3/4 依赖,可在任何时候做
- **Phase 6** T606 (lint/type-check) 可在 Phase 5 完成后立即跑,与 T605 (手工验证) 并行

### 推荐执行节奏(对应"4–6 天"估算)

| 天 | 重点 |
|---|---|
| Day 1 | T001+T002 (Spike) + T101–T105 (Schema) + T501 (croner) |
| Day 2 | T201–T205 (Scorer 升级) + T401 (helper 抽取) |
| Day 3 | T301–T306 (State machine) |
| Day 4 | T402–T406 (Promotion + Logging) |
| Day 5 | T502–T507 (Scheduler + API) + T601–T604 (单元测试) |
| Day 6 | T605 (M1–M6 手工) + T606 (回归) + T607 (Doc) |

---

## 覆盖检查

### Functional Requirements 覆盖

| FR | 对应任务 |
|---|---|
| FR-001 (阈值判定自动晋升) | T305, T403 |
| FR-002 (单事务) | T402, T604 |
| FR-003 (独立 scoring_status) | T101, T102 |
| FR-004 (4 状态) | T102, T303 |
| FR-005 (CAS) | T303, T601 |
| FR-006 (重试上限 3) | T306, T603 |
| FR-007 (10 min sweep) | T302, T602 |
| FR-008 (Node 内 cron) | T502, T503 |
| FR-009 (可关闭开关) | T305, T502 |
| FR-010 (POST /ai/score) | T504 |
| FR-011 (阈值变更不回滚) | T605 (M3 手工验证) |
| FR-012 (防重 content_id) | T402, T604 |
| FR-013 (operation_logs 约定) | T404, T405, T406 |
| FR-014 (digest 骨架) | T505 |
| FR-015 (6 维输出) | T201, T202 |
| FR-016 (JSON 保留 6 维 + 4 外层) | T204 |
| FR-017 (contents.auto_promoted) | T103, T402 |

### User Story 覆盖

| US | 对应任务 |
|---|---|
| US1-1 高分自动晋升 | T403, T605 |
| US1-2 低分不晋升 | T403, T605 |
| US1-3 阈值可调 | T605 (M3) |
| US1-4 事务失败回滚 | T402, T604 |
| US1-5 阈值刚好等于 | T403 |
| US1-6 阈值缺失 | T305 |
| US1-7 评分为 0 | T205, T403 |
| US1-8 已有 content_id | T402, T604 |
| US2-1 并发抢占 | T303, T601 |
| US2-2 崩溃恢复 | T302, T602 |
| US2-3 失败重试 | T306, T603 |
| US2-4 状态独立 | T102 |
| US2-5 异常状态值 | T304 |
| US2-6 手动重评 | T504 |
| US3-1 兜底拾取 | T304, T502 |
| US3-2 调度关闭 | T305, T502 |
| US3-3 调度+同步并发 | T303, T507 |
| US3-4 空队列 | T304 |
| US4-1 反馈写入 | T405, T406 |
| US4-2 digest 骨架 | T505 |
| US4-5 反馈失败不阻塞 | T405 |

### Non-Functional & Risk 覆盖

| 项 | 对应任务 |
|---|---|
| NFR-001 P95 ≤ 30s | T605 (M2 100 条压测) |
| NFR-002 batch ≤ 50 | T305, T304 |
| NFR-003 processing 10 min 回收 | T302, T605 (M5) |
| NFR-004 延迟 500ms | T304 |
| NFR-005 可观测性 | T502 (日志) + T607 (文档) |
| NFR-006 向后兼容 | T203, T506, T507, T606 |
| R1 单实例约束 | T607 (文档化) |
| R2 dev 热重载 | T001, T502, T503 |
| R3 prompt scene 切换 | T201 (保留 summary_score) |
| R4 JSON 兼容 | T204 (字段存在性兼容) |
| R5 Karakeep 自动晋升不同步 | T402 (不调外部 API) + T607 (文档) |
| R6 sweep 间隙 10 min | T302 |
| R7 OperationLogger 失败吞错 | 沿用现状 |
| R8 LLM 输出格式回归 | T002 (spike), T306 (retry) |

---

## Notes

- **任务粒度**:平均 ≈ 25 条任务,粒度对齐"半天 ~ 一天" / 任务。粒度过粗(如"做完 Phase 3")无法落地;粒度过碎(如"加一行 import")管理成本高。
- **不在 tasks 范围**:Karakeep 摘要 prompt 优化(F7)、F2/F3/F4/F5/F6 任何内容。
- **回滚预案**:Phase 1 失败时 `pnpm prisma migrate reset` 或编写 down migration;Phase 5 失败时 `DISABLE_INBOX_SCORING_CRON=1` 关掉 cron 单独修。
- **Spike 跳过条件**:若团队已熟悉 croner + Next.js instrumentation,T001 可跳过;若 BestBlogs 风格 prompt 已有现成参考,T002 可压缩为 30 分钟验证。

---

## Stage Readiness

- **推荐下一步**:
  - **直接 `implement`**:任务边界清晰、依赖明确,可按 Phase 0–6 串行推进
  - 若希望进一步控节奏(按 Phase / Day 切回顾点),可先进入 `execute-plan` 拆出节奏检查清单
- **建议节奏**:实施期每完成一个 Phase 就跑一次回归(lint + type-check + 当前 phase 涉及的单元测试),不要积压到最后再统一回归
- **阻塞项**:无
- **前置确认**(实施前问自己):
  - ✅ Phase 0 spike 是否执行?若跳过,T001/T002 风险由后续任务隐式承担
  - ✅ 系统用户 ID 1 是否真实存在?若不是,需先确定 `INBOX_SCORING_SYSTEM_USER_ID` 的值
  - ✅ `pnpm prisma migrate dev` 是否会触发 dev DB 重置?若是生产 DB,要切到 `migrate deploy`

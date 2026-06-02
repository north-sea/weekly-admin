# Implementation Plan: Inbox AI 评分自动闭环

**Workspace**: `inbox-ai-scoring` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/inbox-ai-scoring/spec.md` (FR-001…FR-017, NFR-001…NFR-006)

> 本 plan 同时合并了 F0 schema-baseline。F0 不再单独立项,所有 schema 改动在本 plan 的 Data Model + Migration 节内一次落地。
> 上游决议:`docs/automation-plan-admin.md` (v2.2) K1–K8。

---

## Summary

把现有的 4 维评分服务(`inbox-scorer.ts`)升级为 **LLM 6 维 + 系统 3 维 = 100 分** 的混合评分,围绕它新增 **`scoring_status` 状态机 + 行级 CAS 抢占 + 失败重试上限 3 次 + 自动晋升原子事务 + Node 进程内 cron(每小时)**。所有变更对 `/api/inbox/score-batch` 和 `SyncOrchestrator` 现有调用保持向后兼容。

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  触发层(三种来源,统一入口)                                       │
│  ┌─────────────────────┐ ┌──────────────────┐ ┌───────────────┐│
│  │ A. SyncOrchestrator │ │ B. 进程内 cron   │ │ C. 手动 API   ││
│  │  (同步后联动评分)    │ │  (每小时兜底)    │ │ POST /ai/score││
│  └──────────┬──────────┘ └────────┬─────────┘ └───────┬───────┘│
│             │                     │                   │         │
│             └─────────────────────┴───────────────────┘         │
│                              ↓                                   │
│              InboxScoringService.run({ ids?, force? })           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  状态机 + CAS 抢占                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  pending ──CAS UPDATE──→ processing ──评分成功──→ done     │ │
│  │     ↑                         │                            │ │
│  │     │                         ├─失败(retry<3)─→ failed     │ │
│  │     │                         │                            │ │
│  │     └─10min 超时 sweep──processing────────────────┘        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  评分计算(scoreInboxItem 升级版)                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  LLM 6 维 (topic/content/depth/practical/innovation/     │    │
│  │  expression,各 0-10)                                     │    │
│  │      ↓ 加权 15/25/20/20/10/10                            │    │
│  │      ↓ ×4 → AI 质量(0-40)                                │    │
│  │      +                                                   │    │
│  │  source_trust(0-30) + completeness(0-20) +               │    │
│  │  timeliness(0-10)  + score_weight(数据源加权)            │    │
│  │      ↓                                                   │    │
│  │  final_score (0-100, 上限 100)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  晋升判定 + 原子事务                                              │
│  if (final_score >= ai_settings.inbox_promotion_threshold)       │
│      → prisma.$transaction([                                     │
│          contents.create({ ..., auto_promoted: true }),          │
│          inbox_items.update({                                    │
│            ai_score, ai_score_details, scoring_status: 'done',   │
│            status: 'promoted', auto_promoted: true, content_id   │
│          })                                                      │
│        ])                                                        │
│  else                                                            │
│      → inbox_items.update({                                      │
│          ai_score, ai_score_details, scoring_status: 'done'      │
│        })                                                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│  反馈采集 (operation_logs)                                        │
│  自动晋升 / 手动 promote / demote / feature / delete             │
│      → operation_details JSON 约定结构                           │
│      → 后续 F2 通过 GET /ai/feedback/digest 消费                 │
└──────────────────────────────────────────────────────────────────┘
```

涉及代码模块(从上到下数据流):

| 层 | 模块 | 文件(新增/修改) |
|---|---|---|
| 触发 | scheduler | `src/lib/scheduling/inbox-scoring-scheduler.ts` (新) + `src/instrumentation.ts` (新) |
| 入口 | InboxScoringService | `src/lib/services/inbox-scoring.ts` (新,统一入口) |
| 状态机 | scoring-status (内嵌) | 同上 |
| 评分 | scorer | `src/lib/ai/server/inbox-scorer.ts` (升级) |
| 晋升 | promotion | `src/lib/services/inbox-scoring-promotion.ts` (新) |
| API | manual score | `src/app/api/v1/ai/score/route.ts` (新) |
| API | feedback digest | `src/app/api/v1/ai/feedback/digest/route.ts` (新骨架) |
| 反馈 | operation_logs 接入 | 修改 `src/lib/services/inbox.ts` `promoteInboxItem` |
| 配置 | 默认 settings | 修改 `src/lib/services/ai-settings.ts` 增加 4 个默认 key |
| 配置 | prompt seed | 修改 `src/lib/services/ai-prompt.ts` 增加 `inbox_scoring` scene |
| 数据 | Prisma schema | 修改 `prisma/schema.prisma`(scoring_status / contents.auto_promoted) |
| 数据 | migration | 新增 `database/inbox_scoring_baseline.sql` + `scripts/migrate-db.ts` 增量(F1 仍用旧流程,F1.5 再切 prisma migrate) |

---

## Key Design Decisions

### Decision 1: LLM 评分输出 schema 升级路径

- **背景**: 现有 zod ScoreSchema 是 `{overall, clarity, accuracy, conciseness, reasons}`(基于现有 prompt scene `summary_score`)。FR-015 要求新输出 6 维(`topic/content/depth/practical/innovation/expression`)。
- **选项**:
  - A: 改 ScoreSchema,同时更换 prompt scene 名为 `inbox_scoring`,旧 `summary_score` 保留给"摘要质量评分"独立用途
  - B: 复用 `summary_score` scene,只改 prompt 内容和 ScoreSchema(原地升级,但语义混淆)
- **结论**: **A**。理由:
  1. 现有 `summary_score` 名字本就是评摘要质量(clarity/accuracy/conciseness),与"内容评分"语义不同
  2. F7 (Karakeep 摘要质量优化) 后续可能仍要独立的"摘要评分",名字保留有用
  3. AiPromptScene 是 union 类型,新增 `inbox_scoring` scene 后,代码层显式区分两个场景
- **影响**:
  - `AiPromptScene` union 加 `'inbox_scoring'`
  - `DEFAULT_AI_PROMPTS` 加一行 inbox_scoring 默认 prompt
  - `inbox-scorer.ts` 的 `getByScene('summary_score')` 改为 `getByScene('inbox_scoring')`
  - 旧的 `summary_score` 继续保留(目前没找到其他业务调用,但保留更安全,F7 可能复用)
- **来源**: `src/lib/services/ai-prompt.ts` L9 / `src/lib/ai/server/inbox-scorer.ts` L207

### Decision 2: ScoreSchema 输出 + 加权聚合的具体形式

- **背景**: 6 维加权后映射到现有 AI 质量分桶(0-40),需要明确权重和精度。
- **结论**: 采用以下伪代码:
  ```ts
  const ScoreSchema = z.object({
    dimensions: z.object({
      topic:       z.number().min(0).max(10),
      content:     z.number().min(0).max(10),
      depth:       z.number().min(0).max(10),
      practical:   z.number().min(0).max(10),
      innovation:  z.number().min(0).max(10),
      expression:  z.number().min(0).max(10),
    }),
    overall: z.number().min(0).max(10),  // LLM 自评的总分,仅做交叉验证
    reasons: z.array(z.string().min(1)).min(1).max(8),
  });

  const WEIGHTS = { topic: 15, content: 25, depth: 20, practical: 20, innovation: 10, expression: 10 };

  // 加权平均(0-10) → ×4 → AI 质量(0-40)
  function aggregateAiQuality(d: Dimensions): number {
    const weighted = (d.topic * 15 + d.content * 25 + d.depth * 20
                    + d.practical * 20 + d.innovation * 10 + d.expression * 10) / 100;
    return Math.round(weighted * 4);  // 0-40, 整数
  }
  ```
- **影响**:
  - 旧的 4 维输出(clarity/accuracy/conciseness)从 schema 移除
  - `ai_score_details.dimensions` 持久化原始 6 维,便于 F2 偏好学习
  - `ai_score_details.overall_llm` 持久化 LLM 自评(可选,辅助回归监控)
  - `ai_score_details.weight_version: 'v1'` 用于后续调权追溯
- **来源**: BestBlogs.dev 评分体系(spec.md K7)

### Decision 3: `scoring_status` 状态机的转移规则

- **背景**: FR-003/FR-004/FR-005/FR-007 要求独立状态字段 + CAS 抢占 + 10 min 超时回收。
- **结论**: 4 状态有限状态机:
  ```
        ┌─────────┐
   (新)→│ pending │
        └────┬────┘
             │ CAS: WHERE scoring_status='pending' AND id=?
             ↓
        ┌────────────┐
        │ processing │──────────────────────────────────────┐
        └────┬───────┘                                      │
             ├──评分成功──→ done                            │
             ├──失败 retry<3──→ failed (下轮重新拾取)        │
             └──失败 retry>=3──→ failed (永久)               │
             ↑
             │ sweep: WHERE scoring_status='processing'
             │        AND last_scored_at < now()-10min
             │        重置为 pending
             └────────────────────────────────────────────────┘

   (强制重评 API): 任意状态 → pending (重置 retry_count=0)
  ```
  - **CAS 抢占 SQL**(Prisma 的 updateMany 返回 `{ count }`):
    ```ts
    const result = await prisma.inbox_items.updateMany({
      where: { id: inboxId, scoring_status: 'pending' },
      data:  { scoring_status: 'processing' },
    });
    if (result.count === 0) return null;  // 已被其他进程抢走
    ```
  - **超时 sweep**(每次 cron 启动时执行一次,在 batch 拾取前):
    ```ts
    await prisma.$executeRaw`
      UPDATE inbox_items
         SET scoring_status='pending'
       WHERE scoring_status='processing'
         AND JSON_EXTRACT(ai_score_details, '$.last_scored_at') IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE,
               STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(ai_score_details, '$.last_scored_at')), '%Y-%m-%dT%H:%i:%s.%fZ'),
               NOW()
             ) >= ${timeoutMinutes}
    `;
    ```
    > **备选**: 加一个独立列 `scoring_started_at TIMESTAMP NULL`,SQL 简洁很多。下面 Data Model 节给出"是否新增此列"的权衡。
- **影响**: 中等。CAS 用 Prisma 现成的 `updateMany`,不引入额外 SQL 库。超时 sweep 是这块最复杂的点。
- **来源**: 通用 worker queue 设计

### Decision 4: Node 进程内 cron 的运行形态

- **背景**: FR-008 要求每小时一次,FR-009 要求可关闭。Next.js 没有原生 cron,且 dev 热重载会重启进程。
- **选项**:
  - A: `node-cron` (轻量,API 简单,但维护性一般)
  - B: `croner` (现代 TypeScript,无依赖,API 更直观)
  - C: 纯 `setInterval` + Date 计算下一次整点
- **结论**: **B (croner)**。理由:零依赖、原生 TS、明确的 `protect: true` 防重叠、`stop()` 清理简洁;比 node-cron 维护更活跃。
- **集成点**: Next.js 的 `instrumentation.ts`:
  ```ts
  // src/instrumentation.ts (Next.js 自动加载)
  export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;  // 跳过 edge runtime
    if (process.env.DISABLE_INBOX_SCORING_CRON === '1') return;
    const { startInboxScoringScheduler } = await import('@/lib/scheduling/inbox-scoring-scheduler');
    startInboxScoringScheduler();
  }
  ```
  - 哨兵防重复注册(dev 模式热重载):
    ```ts
    declare global {
      // eslint-disable-next-line no-var
      var __inboxScoringSchedulerStarted: boolean | undefined;
    }
    if (globalThis.__inboxScoringSchedulerStarted) return;
    globalThis.__inboxScoringSchedulerStarted = true;
    Cron('0 * * * *', { protect: true }, runScheduledScoring);
    ```
- **影响**:
  - 新增依赖 `croner`(~10KB,无依赖)
  - 新增 `src/instrumentation.ts`(项目此前没有)
  - 强单实例约束:**生产环境只能跑一个 admin 实例**(否则两个 cron 会各跑一次)。这与 NFR-006 兼容性互斥风险写到 Risks 节。
- **来源**: https://www.npmjs.com/package/croner / Next.js instrumentation 官方文档

### Decision 5: 操作日志的 OperationType 复用

- **背景**: FR-013 要求记录 promote/demote/feature/delete,但 DB 枚举 `operation_logs_operation_type` 只有 `CREATE/UPDATE/DELETE/LOGIN/LOGOUT`(见 prisma schema L359)。
- **结论**:
  - `operation_type` 沿用 DB 枚举:promote/demote/feature/unfeature 都映射为 `UPDATE`;delete 映射为 `DELETE`
  - 真正的语义放在 `operation_details.action` 字段,与 spec.md Key Entities 已约定的 JSON 结构一致
  - **不修改** DB 枚举(动 DB 枚举是侵入式改动,且现有日志会失去语义)
- **影响**:
  - F2 偏好学习侧聚合时按 `JSON_EXTRACT(operation_details, '$.action')` 过滤
  - 在 `operation_log.ts` 加一个语义层 helper:`logInboxAction(action: 'promote'|'demote'|...)` 自动决定 `operation_type`
- **来源**: `prisma/schema.prisma` L142-158, L359-365

### Decision 6: cron / sync 路径的"系统用户"

- **背景**: `OperationLogger.logOperation` 要 `userId`,但 cron 自动晋升时没有用户上下文。
- **结论**: 引入约定的"系统用户":
  - 默认 `userId = 1`(初始 admin),通过环境变量 `INBOX_SCORING_SYSTEM_USER_ID` 覆盖
  - `operation_details.source = 'cron' | 'sync' | 'api' | 'admin-ui'` 显式标识来源,便于 F2 区分自动 vs 人工
- **影响**: 不动 schema(`user_id` 是 NOT NULL,必须给值)。文档化"system user"约定。
- **来源**: `prisma/schema.prisma` L142

### Decision 7: 数据迁移的回填策略

- **背景**: 现有 inbox_items 已经有 `ai_score IS NOT NULL` 的记录(已被旧 4 维评分填过)。新增 `scoring_status` 时这些记录初始值是什么?
- **结论**:
  - `scoring_status` 默认 `'pending'`(列默认值)
  - migration 末尾追加一条 `UPDATE`:**已有 `ai_score IS NOT NULL` 的记录设为 `'done'`**,避免被新 cron 重复评分
  - 已有 `ai_score_details` JSON 缺少 6 维 `dimensions`,容忍这种"半旧" detail——FR-016 只要求**新写入**的记录有 6 维;F2 消费时按字段存在性兼容
  - `contents.auto_promoted` 默认 FALSE,所有历史 contents 都视为人工创建(与现实相符:历史晋升都是手动)
- **影响**: migration.sql 多两条 `UPDATE`,可逆(回滚靠 down migration)。

---

## Module Design

### Module: InboxScoringService(统一入口)

**职责**: 把"找候选 → CAS 抢占 → 评分 → 晋升判定 → 状态写回"封装成一个可被三处调用的服务,避免每个触发方各写一份。

**改动概述**: 新增 `src/lib/services/inbox-scoring.ts`,把 `inbox-scorer.ts` 的 `batchScoreInboxItems` 的现有职责拆解,scorer 只负责"算分",scoring service 负责状态机和事务编排。

**关键接口 / 行为**:

```text
class InboxScoringService {
  // 处理一批 pending 项(给 cron 用)
  static async runBatch(opts?: {
    limit?: number,         // 默认读 ai_settings.inbox_scoring_batch_size
    delayMs?: number,       // 默认 500
    source: 'cron'|'sync'|'api',
  }): Promise<BatchResult>

  // 处理指定 inbox 项(给 manual API / sync 联动用)
  static async runOne(inboxId: bigint, opts?: {
    force?: boolean,        // true: 任意状态都重置 → pending → 重评
    source: 'sync'|'api'|'admin-ui',
  }): Promise<{ scored: boolean, score?: number, promoted?: boolean }>

  // 内部: sweep 超时 processing
  private static async sweepStaleProcessing(): Promise<number>
}

伪流程 runOne(id, { force }):
  if (force) {
    UPDATE inbox_items SET scoring_status='pending',
      ai_score_details = JSON_SET(coalesce(ai_score_details,'{}'), '$.retry_count', 0)
    WHERE id=?
  }
  // CAS 抢占
  const claimed = updateMany({ id, scoring_status:'pending' } → 'processing')
  if (claimed.count === 0) return { scored: false }
  try {
    await markStarted(id)  // 写 ai_score_details.last_scored_at
    const result = await scoreInboxItem(id)  // 升级版 scorer
    if (result.totalScore >= threshold) await promoteAtomic(id, result)
    else                                 await markDone(id, result)
    return { scored: true, score: result.totalScore, promoted: ... }
  } catch (e) {
    await markFailed(id, e)  // retry_count++, scoring_status='failed'
    throw e
  }
```

**注意事项**:

- `SyncOrchestrator` L539 现有调用 `scoreInboxItem(item.id)` 改为 `InboxScoringService.runOne(item.id, { source: 'sync' })`,保留 NFR-006 兼容性
- `/api/inbox/score-batch` 路由内部改调 `InboxScoringService.runBatch({ source: 'api' })`,接口 contract 保持不变
- 评分异常不应让晋升事务卡死;CAS 失败要静默(返回 `scored:false`),不抛错(让并发的另一进程继续)

### Module: inbox-scorer(原地升级)

**职责**: 单条评分的纯计算函数,不再负责状态机。

**改动概述**:
- `ScoreSchema` 替换为 6 维 + overall + reasons(Decision 2)
- 入参增加可选 `prompt_scene`,默认 `'inbox_scoring'`(Decision 1)
- 计算 AI 质量改用 6 维加权聚合
- 写回逻辑搬到 InboxScoringService(scorer 仅返回结构化结果,不再 `prisma.update`)
- 保留 Karakeep 失败 → 0 分、无摘要 → 0 分的特殊规则
- 保留向后兼容:`scoreInboxItem` 仍 `export`,内部直接调 `InboxScoringService.runOne(id, { source: 'sync' })`,旧调用方不破

**关键接口 / 行为**:

```text
// 新签名(供 InboxScoringService 调用)
export async function calculateInboxScore(inboxId: bigint): Promise<{
  totalScore: number,        // 0-100
  details: AiScoreDetails,   // 完整 JSON,含 6 维 dimensions
  reasons: string[],
} | null>

// 旧签名(向后兼容,内部转发)
export async function scoreInboxItem(inboxId: bigint): Promise<InboxScore | null>
export async function batchScoreInboxItems(limit?, delayMs?): Promise<BatchScoreResult>
```

**注意事项**:
- `summarization_status !== 'success'` 仍触发零分快路径,但**也要写 scoring_status='done' + retry_count=0**(否则会被 cron 反复重评)
- LLM 调用 `serverGenerateJSON` 抛错时往上抛,由 InboxScoringService 包装为 `failed` 状态

### Module: inbox-scoring-promotion(自动晋升原子事务)

**职责**: 收到"评分 + 详情",在单个 `prisma.$transaction` 内插入 `contents` + 更新 `inbox_items`。

**改动概述**: 新增 `src/lib/services/inbox-scoring-promotion.ts`,职责对应 FR-002/FR-012/FR-017。

**关键接口 / 行为**:

```text
async function promoteAtomic(inboxId: bigint, scoreResult: ScoreResult): Promise<{ contentId: bigint }> {
  return await prisma.$transaction(async (tx) => {
    // 1. 防重复(FR-012): 已晋升则跳过
    const item = await tx.inbox_items.findUnique({
      where: { id: inboxId }, include: { data_source: true }
    });
    if (!item || item.content_id) {
      // 仅刷新 ai_score 但不创建 content
      await tx.inbox_items.update({ where:{id:inboxId},
        data:{ ai_score: scoreResult.totalScore, ai_score_details: scoreResult.details,
               scoring_status: 'done' } });
      return { contentId: item?.content_id ?? null };
    }
    // 2. 复用 InboxService.promoteInboxItem 的 content 构造逻辑
    //    (抽取为内部 helper buildContentDataForPromotion(item))
    const content = await tx.contents.create({
      data: {
        ...buildContentDataForPromotion(item),
        original_score: scoreResult.totalScore,
        ai_metadata: scoreResult.details,
        auto_promoted: true,        // FR-017
        status: 'ready',
      }
    });
    // 3. 更新 inbox
    await tx.inbox_items.update({
      where: { id: inboxId },
      data: {
        ai_score: scoreResult.totalScore,
        ai_score_details: scoreResult.details,
        scoring_status: 'done',
        status: 'promoted',
        auto_promoted: true,
        content_id: content.id,
      }
    });
    return { contentId: content.id };
  });
}

// 副作用(事务外)
//   - operation_logs 写入 'promote' (action='promote', source='cron'|'sync'|'api')
//   - Karakeep 双向同步(归档/移列表)——失败仅记日志,不阻塞
```

**注意事项**:
- Karakeep 双向同步现位于 `InboxService.promoteInboxItem` L310+,自动晋升路径**不做** Karakeep 同步(避免 cron 高频调外部 API 引入新故障面)。这一限制写到 Out of Scope / Risks。
- `buildContentDataForPromotion` 提取自 `InboxService.promoteInboxItem` L196-267,**不动**手动晋升路径;两边公用 helper

### Module: inbox-scoring-scheduler(进程内 cron)

**职责**: 注册每小时一次的兜底定时,以及响应 `inbox_scoring_enabled` 开关。

**改动概述**: 新增 `src/lib/scheduling/inbox-scoring-scheduler.ts` + `src/instrumentation.ts`。

**关键接口 / 行为**:

```text
import { Cron } from 'croner';

let job: Cron | null = null;

export function startInboxScoringScheduler(): void {
  if (globalThis.__inboxScoringSchedulerStarted) return;
  globalThis.__inboxScoringSchedulerStarted = true;

  job = new Cron('0 * * * *', { name: 'inbox-scoring', protect: true }, async () => {
    const enabled = await AiSettingsService.get('inbox_scoring_enabled');
    if (enabled?.value === false) {
      logger.info('[scheduler] inbox scoring disabled, skip');
      return;
    }
    const t0 = Date.now();
    const result = await InboxScoringService.runBatch({ source: 'cron' });
    logger.info('[scheduler] cycle done', { ...result, elapsedMs: Date.now() - t0 });
  });
}

export function stopInboxScoringScheduler(): void {
  job?.stop(); job = null;
  globalThis.__inboxScoringSchedulerStarted = false;
}
```

**注意事项**:
- `protect: true` 让 croner 在上一轮未结束时跳过本轮(防 LLM 慢 + 多轮叠加)
- 用 `globalThis` 哨兵防 dev 模式热重载重复注册
- **不在测试 / build 时启动**:`process.env.NODE_ENV === 'test'` 直接 return;`process.env.NEXT_PHASE === 'phase-production-build'` 也跳过
- 失败异常不要冒泡到 cron runtime(croner 默认会重试),用 try/catch 包死

### Module: API 路由

**新增 `POST /api/v1/ai/score`** (`src/app/api/v1/ai/score/route.ts`)

```text
入参 zod:
  { inbox_id: bigint(string),  // 兼容 BigInt
    force?: boolean (默认 false) }

行为:
  - 鉴权:沿用现有 admin auth middleware
  - 调 InboxScoringService.runOne(inbox_id, { force, source: 'api' })
  - 同步等待结果,返回 { scored, score, promoted, content_id?, error? }
  - 操作记录: 写 operation_logs(action='manual_rescore', source='api')
```

**新增 `GET /api/v1/ai/feedback/digest`** (`src/app/api/v1/ai/feedback/digest/route.ts`)

```text
入参 zod:
  { from?: ISODate, to?: ISODate, format?: 'json' (默认) }

F1 阶段返回骨架(F2 完善):
  {
    range: { from, to },
    actions: [],          // F1 空数组
    counts: {},           // F1 空对象
    note: 'F1 baseline; F2 will populate aggregates'
  }
```

**注意事项**:
- 现有路由根目录是 `/api/inbox/...`,新引入 `/api/v1/...` 命名空间用于"API 契约稳定区"。`/api/inbox/score-batch` 保留(向后兼容)
- BigInt 在 JSON 响应里要 stringify;统一用现有 `lib/utils/serialize-bigint`(若不存在则在 plan 实施时一并新增)

### Module: AiSettingsService(默认值补全)

**改动**: `DEFAULT_AI_SETTINGS` 增加 4 个 key:

```ts
const DEFAULT_AI_SETTINGS = {
  [AUTO_SCORE_SETTING_KEY]:          { enabled: true },           // 已存在
  inbox_promotion_threshold:         { value: 70 },               // 新
  inbox_scoring_enabled:             { value: true },             // 新
  inbox_scoring_batch_size:          { value: 50 },               // 新
  inbox_scoring_processing_timeout_minutes: { value: 10 },        // 新
};
```

加 normalize 函数处理 number/boolean,不抛错时用默认值兜底(FR-008/FR-009 要求"配置缺失走默认")。

### Module: AiPromptService(新增 inbox_scoring scene)

**改动**: `AiPromptScene` union 加 `'inbox_scoring'`,`DEFAULT_AI_PROMPTS` 加 inbox_scoring 默认 prompt:

```text
prompt 模板要求:
- 输入变量: title, source_url?, summary, content
- 输出 JSON: { dimensions: { topic, content, depth, practical, innovation, expression }, overall, reasons }
- 每维 0-10,允许小数
- reasons 1-8 条,每条不超过 50 字
- 严禁输出非 JSON 内容
```

具体 prompt 文本在实施期定稿(可参考 BestBlogs 公开 prompt + 现有 summary_score 模板)。Tasks 阶段会列出"prompt 起草"任务。

### Module: InboxService.promoteInboxItem(写 operation_logs)

**改动**: 在 `src/lib/services/inbox.ts` L301 的 inbox_items.update 之后,加一条 operation_logs 写入:

```text
await OperationLogger.logOperation({
  userId: ctx.userId ?? SYSTEM_USER_ID,
  operationType: 'UPDATE',
  resourceType: 'inbox_item',
  resourceId: id.toString(),
  operationDetails: {
    action: 'promote',
    ai_score_at_action: item.ai_score ?? null,
    content_id: Number(content.id),
    inbox_item_id: Number(id),
    reason: input.reason,
    source: 'admin-ui',  // 调用方带,默认 admin-ui
  },
});
```

同样模式扩展到:`demoteContent` / `setFeatured` / `softDelete`(F1 范围内梳理是否已有这些方法,若无则只覆盖 promote;其他作为 follow-up)。

---

## Data Model

### Schema Diff

**Prisma schema 改动**:

```prisma
model inbox_items {
  // ... 既有字段不变
  scoring_status      String?     @default("pending") @db.VarChar(20)  // 新增

  @@index([scoring_status, created_at])  // 新增复合索引,服务 cron 拾取
}

model contents {
  // ... 既有字段不变
  auto_promoted        Boolean?    @default(false)                       // 新增

  @@index([auto_promoted, created_at])  // 新增,服务 F2 样本筛选
}
```

> **关于 "是否新增 `scoring_started_at` 列"**: Decision 3 备选方案。最终**不新增**,理由:
> 1. `ai_score_details.last_scored_at` 已能承载"最近一次评分时间",做 sweep 时复用
> 2. 少加一列减少 migration 风险
> 3. 性能担忧不存在:processing 状态记录数极少(<batch_size),全表 sweep 可接受
> 若实施期发现 SQL 复杂度太高,允许调整为新增列(plan 不锁死实现)

### `ai_score_details` JSON Shape (新版)

```ts
type AiScoreDetails = {
  // === 6 维 LLM 输出(Decision 2,FR-016)===
  dimensions: {
    topic: number;       // 0-10
    content: number;
    depth: number;
    practical: number;
    innovation: number;
    expression: number;
  };
  overall_llm: number;   // LLM 自评(0-10),用于一致性监控

  // === 加权后的 4 个外层分桶 ===
  ai_quality: number;    // 0-40,由 dimensions 加权 ×4
  source_trust: number;  // 0-30
  completeness: number;  // 0-20
  timeliness: number;    // 0-10
  score_weight: number;  // 数据源加权(沿用现状)

  // === 状态机元数据 ===
  retry_count: number;       // 默认 0
  error?: string;            // 最近一次失败原因
  last_scored_at?: string;   // ISO 时间戳,sweep 用
  scored_at?: string;        // 成功完成时间

  // === 调用元数据 ===
  model?: string;            // LLM 模型名
  prompt_version?: string;   // prompt 版本(如 'inbox_scoring/v1')
  weight_version: string;    // 'v1' (Decision 2)

  // === 评分理由(沿用)===
  reasons?: string[];
};
```

**向后兼容**: 旧记录(只有 `ai_quality/source_trust/completeness/timeliness/score_weight/reasons`)保留,前端展示 / F2 消费按字段存在性兼容。新评分一律写新版完整结构。

### `scoring_status` 状态枚举

字段类型:VARCHAR(20),允许的值:`'pending' | 'processing' | 'done' | 'failed'`。**不**用 Prisma enum(K6 决议:JSON/字符串更灵活,后续若加 'paused' 之类无须 migration)。

异常值容错: spec.md US2-5 要求"非预期值视为 pending",在 `runBatch` SQL 拾取条件加 `OR scoring_status NOT IN ('processing','done','failed')` 即可。

### Migration SQL(单文件)

```sql
-- database/inbox_scoring_baseline.sql

-- 1. 状态机字段
ALTER TABLE `inbox_items`
  ADD COLUMN `scoring_status` VARCHAR(20) NULL DEFAULT 'pending';
CREATE INDEX `idx_inbox_scoring_status` ON `inbox_items`(`scoring_status`, `created_at`);

-- 2. 自动晋升标记
ALTER TABLE `contents`
  ADD COLUMN `auto_promoted` BOOLEAN NULL DEFAULT FALSE;
CREATE INDEX `idx_contents_auto_promoted` ON `contents`(`auto_promoted`, `created_at`);

-- 3. 历史已评分项标记为 done(避免被新 cron 重复评分)
UPDATE `inbox_items`
   SET `scoring_status` = 'done'
 WHERE `ai_score` IS NOT NULL;

-- 4. ai_settings seed 4 个 F1 key(如已存在不动)
INSERT INTO `ai_settings` (`key`, `value`)
VALUES
  ('inbox_promotion_threshold',                JSON_OBJECT('value', 70)),
  ('inbox_scoring_enabled',                     JSON_OBJECT('value', true)),
  ('inbox_scoring_batch_size',                  JSON_OBJECT('value', 50)),
  ('inbox_scoring_processing_timeout_minutes',  JSON_OBJECT('value', 10))
ON DUPLICATE KEY UPDATE `value` = `ai_settings`.`value`;

-- 5. ai_prompts 新增 inbox_scoring 占位(prompt 文本由代码层 DEFAULT_AI_PROMPTS 接管,
--    本条仅占位,确保 scene 唯一约束不冲突;实际 prompt 在代码 import 时 ensure)
-- (无需 SQL,代码层 AiPromptService 首次访问时 create-if-missing)
```

> **回滚方案**:手动执行反向 DROP COLUMN + DROP INDEX + DELETE FROM ai_settings WHERE key IN (...)。
> **落库方式**:F1 用 `database/inbox_scoring_baseline.sql` + `scripts/migrate-db.ts` 增量幂等逻辑(与项目现有模式一致)。F1.5 上线后统一切 prisma migrate。

---

## Project Structure

```text
admin/
├── prisma/
│   ├── schema.prisma                              # 修改: 加 scoring_status / contents.auto_promoted + 索引
├── database/
│   └── inbox_scoring_baseline.sql                  # 新增: F1 schema 变更 SQL(旧流程)
├── src/
│   ├── instrumentation.ts                         # 新增: cron 启动入口
│   ├── lib/
│   │   ├── ai/
│   │   │   └── server/
│   │   │       └── inbox-scorer.ts                # 修改: 6 维 ScoreSchema + 拆纯计算
│   │   ├── scheduling/                            # 新增目录
│   │   │   └── inbox-scoring-scheduler.ts         # 新增
│   │   └── services/
│   │       ├── inbox-scoring.ts                    # 新增: 统一入口 + 状态机
│   │       ├── inbox-scoring-promotion.ts          # 新增: 自动晋升原子事务
│   │       ├── inbox.ts                            # 修改: promoteInboxItem 加 operation_logs 写入
│   │       ├── ai-settings.ts                      # 修改: 默认值 + normalize
│   │       └── ai-prompt.ts                        # 修改: AiPromptScene + DEFAULT_AI_PROMPTS 加 inbox_scoring
│   └── app/
│       └── api/
│           ├── inbox/
│           │   └── score-batch/
│           │       └── route.ts                    # 修改: 内部转 InboxScoringService.runBatch
│           └── v1/
│               └── ai/
│                   ├── score/
│                   │   └── route.ts                # 新增: POST 手动评分
│                   └── feedback/
│                       └── digest/
│                           └── route.ts            # 新增: GET F2 骨架
└── package.json                                    # 修改: 加 croner 依赖
```

---

## Risks and Tradeoffs

- **R1 — 单实例约束**: 进程内 cron 在多实例部署下会重复触发(每个实例都有自己的 cron)。当前 admin 部署是单实例,F5 admin-docker-deploy 也按单实例规划。**缓解**:CAS 抢占已能避免重复评分(只是浪费一次 SQL),但批拾取会有 N 倍读放大。文档化"admin 限 1 实例"约束。
- **R2 — Next.js dev 热重载重复注册**: 已用 `globalThis` 哨兵 + croner `name` 防重复;但若哨兵 import 路径在 hot reload 时被重置,仍可能多注册。**缓解**:开发环境提供 `DISABLE_INBOX_SCORING_CRON=1` 关闭 dev 自动启,改为手工 `POST /api/v1/ai/score` 触发。
- **R3 — 旧 prompt scene 切换**: 改 scene 名后,若 admin UI 有"prompt 编辑器"页面引用 `summary_score`,会出现"找不到"。**缓解**:保留 `summary_score` scene + DB 行,只在 inbox-scorer 改用 `inbox_scoring`;Tasks 阶段加一条"全文 grep summary_score 引用,确认 UI 不破"。
- **R4 — JSON shape 兼容**: 历史 `ai_score_details` 不含 `dimensions`,F2 偏好学习要按存在性兼容。**缓解**:Decision 2 注释明确;可在 dashboard 上加"已升级 / 未升级"分桶展示。
- **R5 — Karakeep 双向同步在自动晋升路径缺失**: 自动晋升不会触发 Karakeep 归档(防外部 API 故障扩散)。**取舍**:用户接受短期"内容已晋升但 Karakeep 未归档"的不一致,后续可通过定时同步任务找齐。Out of Scope 已记。
- **R6 — 进程崩溃 + sweep 间隙**: 若进程崩溃恰在 `markStarted` 后、`scoreInboxItem` 开始前,这条记录会保持 processing 至少 10 分钟。**取舍**:接受 10 min 延迟(NFR-003 已声明);若要降低需增加 retry-on-startup,plan 不做。
- **R7 — `OperationLogger.logOperation` 失败的处理**: 现状 `try/catch` 吞错(operation-log.ts L91-94),与 spec US4-5 一致。无新风险。
- **R8 — LLM 输出格式回归**: 升级到 6 维后,LLM 偶尔会输出 4 维(回退到 summary_score 风格)。zod safeParse 失败 → throw → markFailed。**缓解**:retry 3 次内 LLM 通常能纠正;Tasks 阶段加"100 条样本预跑"任务。

---

## Verification Strategy

### 单元 / 集成测试

- [V1] `inbox-scorer.calculateInboxScore`: mock `serverGenerateJSON` 返回 6 维 mock,断言加权聚合公式正确
- [V2] `InboxScoringService.runOne` 并发 CAS: 同一 id 起两个并发调用,断言只一个成功(`scored:true`)
- [V3] sweepStaleProcessing: 插入 processing 且 last_scored_at = now()-15min 的记录,跑 sweep,断言被重置为 pending
- [V4] retry_count 机制: 让 scoreInboxItem 抛错 4 次,断言第 4 次后 scoring_status='failed' 且不再被 runBatch 拾取
- [V5] promoteAtomic 事务回滚: 在 contents.create 后注入 inbox_items.update 失败,断言 contents 行也被回滚
- [V6] FR-012 防重: 给已有 content_id 的 inbox 强制重评,断言不重复创建 content

### 手工验证

- [M1] dev 启动 admin,日志显示 `[scheduler] inbox-scoring registered`,`[scheduler] cycle done` 每整点出现一次
- [M2] 10 条真实样本压测: 评分通过率 ≥ 95%,单条 P95 ≤ 30s(NFR-001)
- [M3] 改 `ai_settings.inbox_promotion_threshold = 80`,新评分按 80 阈值执行;已晋升的不动(US1-3)
- [M4] `ai_settings.inbox_scoring_enabled = false` → 下一轮 cron 仅写日志,不评分(US3-2)
- [M5] kill -9 admin 进程后,该轮 processing 中的记录在 10 分钟内被回收(NFR-003)
- [M6] `POST /api/v1/ai/score` 强制重评一条已 done 的记录,断言 retry_count 归零、重新进入 pending → done

### 回归

- [R1] `/api/inbox/score-batch` 旧接口契约不变(同样的入参 / 出参 shape)
- [R2] `SyncOrchestrator` 同步后联动评分仍 work(NFR-006)
- [R3] 现有 admin UI "AI 评分"展示页不破(`ai_score_details` 多了字段,少字段的旧记录仍能渲染)
- [R4] `pnpm lint && pnpm type-check` 通过
- [R5] `pnpm db:generate` 生成的 client 含新字段

---

## Stage Readiness

- 是否需要 `data-model.md`:**不需要**。理由:F1 的数据模型变化都是单点的(2 个新列 + 1 个 JSON shape + 1 个状态机),已在本 plan Data Model 节内充分展开;独立文件会与 plan.md 重复。
- 下一步建议:`tasks`
- 阻塞项:无
- 实施前可选的 spike:
  - **S1 (可选)**: 30 分钟跑通 croner + instrumentation.ts 的最小 Hello World,验证哨兵防重复确实生效。若失败,降级到 setInterval。
  - **S2 (可选)**: 起草 inbox_scoring prompt 第一版,跑 5 条样本,看 LLM 是否能稳定输出 6 维 JSON。若不能,prompt 模板需迭代。

---

## Design Artifacts

| 产物 | 是否需要 | 说明 |
|------|---------|------|
| plan.md | ✅ 必须 | 本文件 |
| data-model.md | ❌ 不需要 | 数据变更已并入 plan |
| tasks.md | ⏭️ 后续阶段生成 | 由 `tasks` 阶段产出 |
| acceptance.md | ⏭️ 后续阶段生成 | 用于最终验收结论 |
| `database/inbox_scoring_baseline.sql` | ⏭️ 实施期 | F1 schema 变更 SQL(旧流程) |

---

## Notes

- **prompt 文本定稿**: Decision 1 + Module AiPromptService 都把 prompt 文本下放到实施期(Tasks 阶段一条独立任务)。spec 不锁 prompt 字面量。
- **system user**: `INBOX_SCORING_SYSTEM_USER_ID` 环境变量 + 默认 1。如部署时初始 admin 不是 id=1,需运维显式设置。
- **观测性**: 所有日志走 `console.log` 即可(项目现状无统一 logger)。Tasks 阶段考虑是否加一个 `lib/logger.ts` 薄封装,留 hook 给后续接入 pino/winston。
- **F2 的契约**: `GET /api/v1/ai/feedback/digest` F1 返回空骨架。F2 spec 阶段会定字段,届时本 API 升级 schema 但保持 endpoint 不变。
- **package.json 改动**: 新增 `"croner": "^9.x"` 一项依赖。无 lock 升级或破坏性升级。

---

## Sources

| 决策 | 来源 | 备注 |
|------|------|------|
| Decision 1 (prompt scene 拆) | `src/lib/services/ai-prompt.ts` L9 / `src/lib/ai/server/inbox-scorer.ts` L207 | 代码现状 |
| Decision 2 (6+3 加权) | spec.md K7 / BestBlogs.dev | 设计决议 |
| Decision 3 (状态机) | spec.md FR-003..FR-007 | 设计决议 |
| Decision 4 (croner) | https://www.npmjs.com/package/croner | 选型 |
| Decision 5 (operation_type 复用) | `prisma/schema.prisma` L142-158, L359-365 | 代码现状 |
| Decision 6 (system user) | `prisma/schema.prisma` L142(`user_id` NOT NULL) | 代码现状 |
| Decision 7 (历史回填) | `prisma/schema.prisma` L287-291 + 现实推断 | 代码现状 |

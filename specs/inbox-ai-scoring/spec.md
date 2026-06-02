# Feature Specification: Inbox AI 评分自动闭环

**Workspace**: `inbox-ai-scoring`
**Created**: 2026-05-22
**Status**: Draft
**Input**: 用户描述: "让 Karakeep 进来的内容自动 AI 评分 + 阈值自动晋升 + 失败可重试,把人工筛选 4-6h/周压缩到 0.5-1h/周"

> 本 spec 仅覆盖 F1 (inbox-ai-scoring)。F0 schema-baseline 作为前置基线在 plan 阶段一并落地。
> 上游文档:`docs/automation-plan-admin.md` (v2.2) 的 Feature 拆分章节 + K1–K8 决议。

---

## 现状摘要(写 spec 前的范围级只读探索结论)

代码库已有部分实现,本 spec **不重做以下能力**:

| 组件 | 现状 | 文件 |
|---|---|---|
| AI 评分核心 | ✅ 已实现 (4 维:AI 质量 40 + 来源可信度 30 + 完整度 20 + 时效性 10) | `src/lib/ai/server/inbox-scorer.ts` |
| 批量评分入口 | ✅ 已实现 | `src/app/api/inbox/score-batch/route.ts` |
| 同步后自动评分 | ✅ 已实现 (`SyncOrchestrator` 调用 `scoreInboxItem`) | `src/lib/services/sync-orchestrator.ts` L539 |
| 手动晋升 | ✅ 已实现 (`InboxService.promoteInboxItem`,均 `auto_promoted=false`) | `src/lib/services/inbox.ts` L190 |
| Prompt 管理 | ✅ 已实现 (`AiPromptService` + `ai_prompts` 表 scene-based) | `src/lib/services/ai-prompt.ts` |
| 配置项管理 | ✅ 已实现 (`AiSettingsService` + `ai_settings` KV 表) | `src/lib/services/ai-settings.ts` |

代码库**尚未实现**的 gap (本 spec 全部覆盖):

| 能力 | 现状 | F1 目标 |
|---|---|---|
| **自动晋升** | 不存在,所有晋升都是手动 | 评分 ≥ 阈值自动晋升 |
| **晋升阈值配置** | 无 | `ai_settings['inbox_promotion_threshold']`,默认 70 |
| **评分状态机** | 不存在;`summarization_status` 仅用于 Karakeep 摘要抓取,语义独立 | 新增独立字段 `scoring_status` |
| **并发幂等** | 无,批量评分依赖单进程 | 行级 CAS 抢占 + 重试上限 |
| **失败重试** | 失败只记日志,不重试 | 失败状态机 + 上限 3 次 + 超限不再自动取 |
| **定时调度** | 仅同步时联动评分 | 独立 cron (每小时一次)兜底未评分项 |
| **手动重评 API** | 仅有 score-batch (一次性) | `POST /api/v1/ai/score` 支持指定 inbox_id / 强制覆盖 |
| **反馈数据采集** | `operation_logs` 已存在但未约定 details 结构 | 约定 `operation_details` JSON schema 供后续 F2 使用 |

**关键决策已确认 (clarify 阶段已收口)**:

- **评分维度**: 采用 **6+3 混合方案** — LLM 给 6 维细分(BestBlogs 风格:选题/内容/技术深度/实用/创新/表达),加权聚合后映射为现有"AI 质量(40)"分;来源可信度(30)/完整度(20)/时效性(10) 三个外层维度保持不变。对外仍是 100 分制,与现存晋升阈值 / `original_score` 字段 100% 兼容。
- **调度形态**: **仅 Node 进程内 cron** (无外部触发依赖,不引入 BullMQ/n8n)。
- **`scoring_status`**: **新增独立字段**,不复用 `summarization_status`(后者继续表示 Karakeep 摘要抓取状态)。
- **`contents.auto_promoted`**: 新增,与 `inbox_items.auto_promoted` 对应,便于 F2 偏好学习直接从 `contents` 侧筛选样本。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 评分后自动晋升 (Priority: P1)

作为周刊运营者,我希望 AI 评分 ≥ 阈值的 inbox 内容自动晋升到 `contents` 表(status=ready),
这样我不必每周从几百条 inbox 里手动挑选高分内容。

**Why this priority**: 这是 F1 的核心闭环价值。没有自动晋升,前面所有评分工作都只是数据,
人工筛选成本不会下降。

**Acceptance Scenarios**:

1. **[US1-1] 高分自动晋升**
   **Given** inbox_items 中存在一条 `status='pending'` 且 `ai_score=NULL` 的记录
   并且 `ai_settings['inbox_promotion_threshold']=70`
   **When** 评分流程对该条目执行评分,产生 `ai_score=82`
   **Then**
   - `inbox_items.ai_score=82`,`auto_promoted=true`,`scoring_status='done'`,`status='promoted'`,`content_id` 指向新 content
   - `inbox_items.ai_score_details` 包含 6 维原始打分 + 加权后的 AI 质量分 + 外层 4 维 (详见 Key Entities)
   - `contents` 表新增一条记录:`status='ready'`,`auto_promoted=true`,`original_score=82`,`ai_metadata` 完整复制 `ai_score_details`
   - 整个过程在单事务中完成

2. **[US1-2] 低分不晋升**
   **Given** 同上,但 `ai_score=58`
   **When** 评分完成
   **Then**
   - `inbox_items.ai_score=58`,`auto_promoted=false`,`status` 保持 `pending`
   - `contents` 表无新增

3. **[US1-3] 阈值可调**
   **Given** 系统已运行,`ai_settings['inbox_promotion_threshold']=70`
   **When** 管理员通过 admin UI 或 API 把阈值改为 80
   **Then** 之后新评分的项目按 80 阈值判定,**已晋升的不回滚**

**Edge Cases**:

- **[US1-4] 评分时晋升事务失败**
  评分写回成功但 content 插入失败 → 整体回滚,`inbox_items.ai_score` 也不应留下"评分但未晋升"的中间态
- **[US1-5] 阈值刚好等于评分**
  `ai_score=70`,`threshold=70` → 视为"≥",晋升
- **[US1-6] 阈值配置缺失**
  `ai_settings` 中无 `inbox_promotion_threshold` → 使用代码兜底默认值 70,不抛错
- **[US1-7] 评分为 0**
  Karakeep 爬取失败或无摘要导致 `ai_score=0` → 不晋升 (现状已有此规则,本 spec 不改)
- **[US1-8] inbox_item 已有 content_id**
  已经晋升过的条目再次进入评分流程 → 跳过,不重复创建 content

---

### User Story 2 - 评分状态机与并发安全 (Priority: P1)

作为系统,我需要在多进程/多次定时任务并发时,保证同一条 inbox_item 不被重复评分,
失败可识别可重试,且进程崩溃后能恢复未完成的任务。

**Why this priority**: 没有状态机,定时调度上线后会出现"同一条目被评分两次""失败任务永远卡住""LLM API 限流后不能回退"。
P1 与 US1 并列,因为没有可靠的状态机,自动晋升也不可信。

**Acceptance Scenarios**:

1. **[US2-1] 并发抢占**
   **Given** 同一条 inbox_item 同时被两个评分进程拾取
   **When** 两个进程同时执行 CAS 抢占 (UPDATE WHERE status='pending')
   **Then** 只有一个进程成功 (受影响行数=1),另一个跳过该条目

2. **[US2-2] 进程崩溃恢复**
   **Given** 一条 inbox_item 处于 `scoring_status='processing'` 状态,但进程已崩溃
   **When** 下一轮定时调度运行,发现该条目 `processing` 状态超过 N 分钟 (建议 N=10)
   **Then** 状态被重置为 `pending`,进入下一轮重试

3. **[US2-3] 失败重试**
   **Given** 一条 inbox_item 评分时 LLM API 报错
   **When** 评分流程捕获错误
   **Then**
   - 状态置为 `failed`,`ai_score_details.error` 记录错误信息
   - `ai_score_details.retry_count` +1
   - 若 `retry_count < 3`,下次定时调度会重新拾取
   - 若 `retry_count >= 3`,该条目保持 `failed` 不再自动拾取,需手动重评

4. **[US2-4] 状态字段语义独立**
   **Given** 现状 `summarization_status` 已用于 Karakeep 摘要抓取状态
   **When** 引入评分状态
   **Then** 评分状态使用**独立字段** `scoring_status` (F0 新增),不污染原有语义

**Edge Cases**:

- **[US2-5] 异常状态出现** 数据库出现非预期的 `scoring_status` 值 → 视为 `pending` 处理,记录告警日志
- **[US2-6] 已评分项手动触发** 通过 `POST /api/v1/ai/score` 强制重评一条已评分的条目 → 允许,重置状态机并重新评分

---

### User Story 3 - 定时调度兜底未评分项 (Priority: P2)

作为运维,我希望即使同步流程未触发评分(例如同步关闭、评分被跳过),也有兜底机制
确保所有 `pending` 状态的 inbox_items 在 1 小时内被评分。

**Why this priority**: P2 是因为同步联动评分已经覆盖了绝大部分流量,定时调度是兜底。
但兜底必须有,否则会有"漏网之鱼"长期堆积。

**Acceptance Scenarios**:

1. **[US3-1] 兜底拾取**
   **Given** inbox_items 中有 50 条 `status='pending'` 且 `ai_score=NULL` 的记录
   **When** 定时任务 (每小时 0 分) 触发
   **Then**
   - 拾取最多 N 条 (建议 N=50,可配置)
   - 按 `created_at ASC` 排序,先进先出
   - 调用现有 `batchScoreInboxItems` 完成评分

2. **[US3-2] 调度可关闭**
   **Given** 运维需要临时关闭自动评分 (例如调试 prompt)
   **When** 设置 `ai_settings['inbox_scoring_enabled']=false`
   **Then** 定时任务下一轮不执行评分,仅记录日志

**Edge Cases**:

- **[US3-3] 调度与同步并发** 同步流程也在评分时,定时调度跑起来 → 通过 US2 的 CAS 保证不重复
- **[US3-4] 调度无 pending 项** 队列为空 → 静默退出,不告警

---

### User Story 4 - 反馈数据采集为 F2 铺路 (Priority: P3)

作为系统,我希望用户在 admin 后台对 inbox_item 或 content 的关键操作 (晋升/删除/featured) 被结构化记录到
`operation_logs`,供后续 F2 (preference-learning) 提取偏好。

**Why this priority**: P3 是因为 F2 才真正消费这些数据,F1 阶段先把"约定"立起来,避免后续返工。

**Acceptance Scenarios**:

1. **[US4-1] 反馈写入约定**
   **Given** 用户在 admin UI 手动晋升一条 `ai_score=58` 的低分内容
   **When** 调用 `InboxService.promoteInboxItem`
   **Then**
   - 写入 `operation_logs`:
     - `resource_type='inbox_item'`
     - `resource_id='<inbox_id>'`
     - `operation_type` 复用现有枚举 (如 `update`)
     - `operation_details` JSON 包含 `{action: 'promote', ai_score_at_action: 58, content_id: <new>, source: 'admin-ui'}`

2. **[US4-2] 反馈摘要接口 (为 F2 准备契约,F1 可仅返回空骨架)**
   **Given** F1 已上线
   **When** `GET /api/v1/ai/feedback/digest?from=2026-05-01&to=2026-05-22` 被调用
   **Then** 返回结构化 JSON (具体字段在 F2 定稿,F1 至少返回空数组与时间范围)

**Edge Cases**:

- **[US4-5] 反馈表写入失败** operation_logs 写入失败不应阻塞晋升主流程 → 失败仅记日志

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在评分完成后,根据 `ai_settings['inbox_promotion_threshold']` 判断是否自动晋升
- **FR-002**: 自动晋升必须在单事务中完成 inbox_items 更新 + contents 插入,失败整体回滚
- **FR-003**: 系统必须引入独立的评分状态字段 `scoring_status`,不复用 `summarization_status`
- **FR-004**: 评分状态机必须包含至少 4 种状态:`pending`/`processing`/`done`/`failed`
- **FR-005**: 系统必须通过行级 CAS (UPDATE WHERE 条件) 保证同一条目不被并发评分
- **FR-006**: 失败的评分任务必须支持自动重试,上限 3 次,通过 `ai_score_details.retry_count` 追踪
- **FR-007**: `processing` 状态超过 10 分钟必须被视为崩溃,自动重置为 `pending`
- **FR-008**: 系统必须提供独立的定时调度 (Node 进程内 cron,每小时一次),兜底未评分项;不依赖外部触发器
- **FR-009**: 定时调度必须可通过 `ai_settings['inbox_scoring_enabled']` 全局关闭
- **FR-010**: 系统必须提供 `POST /api/v1/ai/score` 接口,支持指定 inbox_id 手动评分/重评
- **FR-011**: 阈值变更不回滚已晋升数据
- **FR-012**: 已晋升过的 inbox_item (`content_id IS NOT NULL`) 不重复创建 content
- **FR-013**: 所有手动晋升/删除/featured 操作必须按约定结构写入 `operation_logs.operation_details`
- **FR-014**: 系统必须提供 `GET /api/v1/ai/feedback/digest` 接口骨架 (F1 可返回空数据,字段契约由 F2 完善)
- **FR-015**: 评分 prompt 必须返回 6 维细分 (`topic`/`content`/`depth`/`practical`/`innovation`/`expression`),每维 0–10;系统按 BestBlogs 权重 (15/25/20/20/10/10) 加权聚合,再 ×4 映射到现有 AI 质量(0–40)分桶
- **FR-016**: `ai_score_details` JSON 必须保留 6 维原始打分 (`dimensions.{topic,content,depth,practical,innovation,expression}`)、加权后的 AI 质量分、以及外层 4 维 (ai_quality / source_trust / completeness / timeliness),供 F2 偏好学习消费
- **FR-017**: 自动晋升时,`contents.auto_promoted` 必须置为 `true`(与 `inbox_items.auto_promoted` 对齐),手动晋升保持 `false`

### Non-Functional Requirements

- **NFR-001 (性能)**: 单条评分 P95 ≤ 30s (含 LLM 调用)
- **NFR-002 (吞吐)**: 定时调度单次处理上限 50 条,可通过配置调整
- **NFR-003 (可靠性)**: 进程崩溃后,所有 `processing` 状态条目在 10 分钟内被回收
- **NFR-004 (限流)**: 批量评分各项之间默认延迟 500ms,可配置 (与现状一致)
- **NFR-005 (可观测性)**: 评分失败、晋升成功/失败、状态回收事件必须可在日志中检索
- **NFR-006 (向后兼容)**: 现有 `/api/inbox/score-batch` 和 `SyncOrchestrator` 的评分调用必须继续工作

### Key Entities

- **inbox_items** (现有表)
  - 关键字段:`ai_score` / `ai_score_details` (JSON) / `auto_promoted` / `status` / `content_id`
  - **新增字段**:
    - `scoring_status` VARCHAR(20) (新增):评分状态机,与 `summarization_status` 解耦;取值 `pending`/`processing`/`done`/`failed`
  - **JSON 内字段(非新列)**:
    - `ai_score_details.dimensions` — 6 维原始打分 `{topic, content, depth, practical, innovation, expression}` 各 0–10
    - `ai_score_details.ai_quality` — 6 维加权聚合后 ×4 的 AI 质量分(0–40)
    - `ai_score_details.source_trust` / `completeness` / `timeliness` — 外层维度分(沿用现有逻辑)
    - `ai_score_details.weight_version` — 6 维权重版本号(便于后续调权追溯)
    - `ai_score_details.retry_count` — 失败重试计数
    - `ai_score_details.error` — 最近一次失败原因
    - `ai_score_details.last_scored_at` — 最近评分时间戳
    - `ai_score_details.model` / `prompt_version` — LLM 调用元数据
  - **不新增**:`ai_dimensions` / `ai_summary` / `ai_key_points` 独立列(已驳回,见 K2/K3/K4)

- **contents** (现有表)
  - 自动晋升时写入:`status='ready'` / `original_score` / `ai_metadata` (复用)
  - **新增字段**:
    - `auto_promoted` BOOLEAN DEFAULT FALSE (新增):标记内容是否由自动晋升流程创建,F2 偏好学习直接以此筛样本(避免回查 inbox_items)

- **ai_settings** (现有 KV 表)
  - 新增配置项:
    - `inbox_promotion_threshold` (数字,默认 70)
    - `inbox_scoring_enabled` (布尔,默认 true)
    - `inbox_scoring_batch_size` (数字,默认 50)
    - `inbox_scoring_processing_timeout_minutes` (数字,默认 10)

- **ai_prompts** (现有表)
  - `scene='inbox_scoring'` 已在使用 (`AiPromptService`),保持现状

- **operation_logs** (现有表)
  - `operation_details` JSON 结构约定 (本 spec 新增):
    ```ts
    {
      action: 'promote' | 'demote' | 'feature' | 'unfeature' | 'delete' | 'reject',
      ai_score_at_action: number | null,
      content_id?: number,
      inbox_item_id?: number,
      reason?: string,
      source: 'admin-ui' | 'api' | 'cron'
    }
    ```

- **(无新表)** — 与 K1 决议一致

---

## Business Metrics *(optional — 上线后度量)*

- **BM-001**: 上线后 4 周内,人工每周耗时从 4-6h 降至 ≤ 2h (中间态目标,F3 上线后再降)
- **BM-002**: 自动晋升准确率 ≥ 80% (人工 7 天内 demote 比例 ≤ 20%)
- **BM-003**: pending 队列峰值积压 ≤ 100 条 (定时调度有效)
- **BM-004**: 评分失败率 ≤ 5%,重试后最终失败率 ≤ 1%

---

## Out of Scope

明确不在 F1 范围内:

- ❌ **偏好学习** — Hermes 技能层,属于 F2
- ❌ **周刊草稿自动生成** — 属于 F3
- ❌ **n8n Karakeep 同步工作流** — 属于 F4 (注:同步本身可能已部分存在,F4 时盘点)
- ❌ **Admin 容器化部署** — 属于 F5
- ❌ **Quail 发布** — 属于 F6
- ❌ **失败告警通道选型** — 通知机制 (企微/飞书/站内) 推迟到 F3 spec 一并定
- ❌ **Karakeep 摘要 prompt 优化** — 当前 Karakeep 抓取的摘要在去掉截图后文字质量待提升,推迟到独立 feature (建议命名 `F7 karakeep-summary-quality`,F1 上线后跟进)
- ❌ **Twitter / 短文本来源抓取问题** — Karakeep 对 Twitter 帖子等内容抓取不充分,F1 暂时接受现状,不在本 feature 内修;若 LLM 评分输入不足,允许评分为 0 / 摘要为空
- ❌ **截图自动生成 / 修复 Karakeep 截图问题** — 与本 feature 正交

---

## Clarifications (已收口)

进入 plan 阶段前已确认的关键决议:

- **Q1 — 4 维 vs 6 维**:**采用 6+3 混合**。LLM 给 6 维细分 (`topic`/`content`/`depth`/`practical`/`innovation`/`expression`),按 BestBlogs 权重 15/25/20/20/10/10 加权聚合后 ×4 映射到现有 AI 质量(0–40)分桶;外层 source_trust(30) / completeness(20) / timeliness(10) 维持现状。对外仍 100 分制,与 `inbox_promotion_threshold=70` / `original_score` 字段无缝衔接。FR-015、FR-016 已固化此约束。
- **Q2 — `scoring_status` 还是复用 `summarization_status`**:**新增独立字段**。`summarization_status` 继续表示 Karakeep 摘要抓取状态(`success` / 失败),与"评分进度"是两件事,混用会损害可读性。F0 schema-baseline 同步加这个字段。
- **Q3 — 调度承载方式**:**仅 Node 进程内 cron**。不引入外部触发(系统级 crontab / n8n / BullMQ),保持 admin 自包含。重启丢任务的风险通过 FR-007 (10 分钟 processing 超时回收) 兜底,不另开队列。
- **Q4 — 手动 vs 自动晋升的 `auto_promoted` 区分**:**严格区分**。`auto_promoted=true` 仅由自动晋升路径写入,手动晋升保持 `false`。`InboxService.promoteInboxItem` 现状已满足。
- **Q5 — `contents` 是否补 `auto_promoted` 列**:**补**。理由:F2 偏好学习需要在 `contents` 侧筛"自动晋升后人工 demote"的负样本,加列比每次 JOIN inbox_items 更直观。F0 schema-baseline 加这一列。

---

## Stage Readiness

- **下一步建议**: `plan`
  - 理由:Q1–Q5 已全部收口,FR/Key Entities/Out of Scope 均已对齐确认结果,无遗留歧义,可直接进入技术方案设计。
- **F0 schema-baseline 需落地的 schema 改动 (plan 阶段并入)**:
  1. `inbox_items` 新增 `scoring_status VARCHAR(20) NOT NULL DEFAULT 'pending'` + 索引 `(scoring_status, created_at)`
  2. `contents` 新增 `auto_promoted BOOLEAN NOT NULL DEFAULT FALSE` + 索引 `(auto_promoted, created_at)`
  3. `ai_settings` seed 写入 4 个 key:`inbox_promotion_threshold=70`、`inbox_scoring_enabled=true`、`inbox_scoring_batch_size=50`、`inbox_scoring_processing_timeout_minutes=10`
  4. `ai_prompts` 中 `scene='inbox_scoring'` 的 prompt 升级为 6 维输出 schema (新增 prompt_version 字段或在 system prompt 中递增版本号)
- **阻塞项**: 无
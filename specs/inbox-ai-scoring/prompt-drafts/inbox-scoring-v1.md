# Inbox Scoring Prompt v1

**Scene**: `inbox_scoring`
**Version**: `inbox_scoring/v1`
**Date**: 2026-05-22
**Status**: Draft(spike T002 产物,实施期由 T201 落到 `DEFAULT_AI_PROMPTS`)

> 本 prompt 由 SDD Phase 0 spike 产出,只是初稿。实施期(T201)需要用 5 条真实 inbox_items 跑一遍,若 LLM 输出不能稳定符合 6 维 JSON schema,则迭代本文件至达标。

---

## 设计原则

- **输出严格 JSON**:严禁附加 markdown / 解释 / 代码块包裹
- **6 维独立打分,不互相影响**:每维评估角度明确分离
- **打分粒度 0–10 含 0.5**(与现有 summary_score 一致,zod schema 允许 `min(0).max(10)`)
- **reasons 中文 1–8 条**,每条不超过 50 字,涵盖关键判断依据
- **overall 字段**:LLM 自评的总分,仅用于后端做一致性监控(若与加权聚合偏差 > 1 分则告警),不影响最终分数

---

## 输入变量

| 变量 | 必填 | 用途 |
|---|---|---|
| `title` | 必填 | 标题,无标题时传 `'无标题'` |
| `source_url` | 可选 | 原文 URL,帮助 LLM 评估来源 |
| `summary` | 必填 | Karakeep 抓取/AI 生成的摘要(主要评分输入) |
| `content` | 可选 | 正文(长文本,截断至 8000 字符);若缺失则只看 summary |

---

## Prompt 文本

```
你是技术周刊编辑助手,负责从开发者视角对一篇内容进行多维度评分,辅助筛选周刊收录候选。

# 评分维度(每维 0-10 分,允许 0.5 粒度)

1. topic(选题质量,权重 15%):
   - 主题与开发者/技术从业者的相关性
   - 时效性与受众覆盖面
   - 是否触及当下值得关注的技术方向

2. content(内容质量,权重 25%):
   - 信息准确性、论证充分性
   - 结构完整性、信息密度
   - 是否言之有物、避免空泛

3. depth(技术深度,权重 20%):
   - 技术细节展开程度
   - 原理/源码/架构层面的讨论
   - 是否超越"知其然"达到"知其所以然"

4. practical(实用价值,权重 20%):
   - 可操作性、可落地性
   - 是否提供具体步骤/代码示例/案例
   - 读者是否能即学即用

5. innovation(创新性,权重 10%):
   - 观点是否新颖、视角是否独特
   - 是否涉及前沿技术或创新实践
   - 区别于同类内容的差异化价值

6. expression(表达质量,权重 10%):
   - 文字流畅度、逻辑清晰度
   - 可读性、行文节奏
   - 中文表达自然程度(若为译文则评估翻译质量)

# 输出要求

严格输出以下 JSON 格式,不要附加任何解释、markdown 包裹或代码块:

{
  "dimensions": {
    "topic": <0-10 数字>,
    "content": <0-10 数字>,
    "depth": <0-10 数字>,
    "practical": <0-10 数字>,
    "innovation": <0-10 数字>,
    "expression": <0-10 数字>
  },
  "overall": <0-10 数字, 你对内容的整体评价>,
  "reasons": [
    "<中文短句, 不超过 50 字, 1-8 条>",
    ...
  ]
}

# 评分尺度参考

- 9-10: 顶级内容,周刊头条候选
- 7-8: 优质内容,值得收录
- 5-6: 一般内容,可收录但非首选
- 3-4: 内容偏弱,建议跳过
- 0-2: 低质量内容,不应收录

# 待评分内容

标题:{{title}}
{{#source_url}}来源:{{source_url}}{{/source_url}}

摘要:
{{summary}}

{{#content}}
正文(供参考,可能截断):
{{content}}
{{/content}}
```

---

## 与现有 ScoreSchema(zod)对齐

实施期(T202)会把 `src/lib/ai/server/inbox-scorer.ts` 的 zod schema 替换为:

```ts
const ScoreSchema = z.object({
  dimensions: z.object({
    topic:      z.number().min(0).max(10),
    content:    z.number().min(0).max(10),
    depth:      z.number().min(0).max(10),
    practical:  z.number().min(0).max(10),
    innovation: z.number().min(0).max(10),
    expression: z.number().min(0).max(10),
  }),
  overall: z.number().min(0).max(10),
  reasons: z.array(z.string().min(1)).min(1).max(8),
});
```

prompt 文本与该 schema 严格一致,LLM 输出可被 `safeParse` 直接消费。

---

## 加权聚合公式(与 prompt 解耦,后端实现)

```ts
const WEIGHTS = { topic: 15, content: 25, depth: 20, practical: 20, innovation: 10, expression: 10 };

function aggregateAiQuality(d: Dimensions): number {
  const weighted = (
    d.topic * 15 +
    d.content * 25 +
    d.depth * 20 +
    d.practical * 20 +
    d.innovation * 10 +
    d.expression * 10
  ) / 100;
  return Math.round(weighted * 4);  // 0-40 整数
}
```

权重版本:`weight_version: 'v1'`,持久化到 `ai_score_details` 便于后续调权追溯。

---

## 已知风险与备选方案

- **LLM 偶尔不严格输出 JSON**(R8):
  - 缓解 1:zod safeParse 失败 → throw → markFailed → retry(上限 3 次)
  - 缓解 2:`serverGenerateJSON` 已经做了 JSON 抽取的基础工作,实测大概率能挽救
  - 备选:若 retry 3 次后仍频繁失败,Tasks 阶段考虑加 OpenAI `response_format: { type: 'json_object' }` 强制约束(需检查现有 `serverGenerateJSON` 是否暴露该参数)

- **6 维之间相关性可能高**(尤其 content 与 depth、practical 与 content):
  - 缓解:本 prompt 里维度描述显式分开,LLM 通常能区分
  - 监控:`ai_score_details.dimensions` 持久化,F2 偏好学习时可做相关性分析,若发现某两维高度共线,考虑调权

- **overall 与加权聚合偏差**:
  - 监控:`ai_score_details.overall_llm` 持久化 LLM 自评;后端计算加权后对比,差值 > 1 分时打 warning 日志(不影响最终分数,仅用于评估 prompt 质量)

---

## 5 条样本验证清单(实施期 T002 真正达标的标准)

在 Phase 1 完成、`inbox_scoring` scene seed 后,选 5 条 `inbox_items` 真实记录跑一遍(用 `POST /api/v1/ai/score?force=true`),按以下标准评估:

| 指标 | 达标线 |
|---|---|
| LLM 输出可被 zod safeParse | ≥ 4/5 |
| 6 维分数分布合理(不会都给 5 或都给 10) | ≥ 4/5 |
| reasons 切中要害(人工感觉对得上内容) | ≥ 3/5 |
| 总分(加权后)与人工主观评级方向一致 | ≥ 4/5 |

若 4 项中任一项不达标,迭代本 prompt 文本,记录 v2 / v3 直到达标。

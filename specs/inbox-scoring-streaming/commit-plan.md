# Commit Plan: Inbox 评分流式调用

**Feature**: inbox-scoring-streaming  
**Date**: 2026-06-12  
**Branch**: main  
**Status**: 待用户确认

---

## Included Files

建议提交的文件和归属依据：

### Core Implementation
- `package.json` - 新增 openai@6.42.0 依赖
- `pnpm-lock.yaml` - 依赖锁文件更新
- `src/lib/ai/server/client.ts` - 新增 classifyAiError + serverGenerateJSONStream
- `src/lib/ai/server/inbox-scorer.ts` - 切换到流式调用
- `src/lib/ai/server/__tests__/client.test.ts` - 新增流式单测

### Verification Tools
- `scripts/verify-streaming-probe.ts` - Phase 4/5 验证探针脚本

### SDD Artifacts
- `specs/inbox-scoring-streaming/` - 完整 SDD 产物目录
  - `spec.md` - 需求规格
  - `plan.md` - 实现方案
  - `tasks.md` - 任务列表
  - `context-manifest.md` - 上下文清单
  - `phase4-verification-guide.md` - Phase 4 验证指南
  - `acceptance.md` - 验收记录

**总计**: 8 个文件/目录，覆盖实现、测试、验证工具和 SDD 文档

---

## Excluded Files

明确不提交的文件和排除理由：

- `.claude/settings.local.json` - 个人本地配置，不应提交到代码库
- `specs/.active` - Git 已跟踪但未修改（根据 git status，只有 M 标记的是修改）

---

## Needs User Decision

无。所有修改文件归属明确。

---

## Risks

### 1. 依赖锁文件 (Low)
- **文件**: `pnpm-lock.yaml`
- **风险**: 锁文件较大（可能数百 KB），包含完整依赖树
- **缓解**: 这是标准 pnpm 行为，必须提交以保证依赖一致性

### 2. 新增外部依赖 (Medium)
- **文件**: `package.json` (openai@6.42.0)
- **风险**: 引入新的 npm 包，增加供应链风险
- **缓解**: OpenAI SDK 是官方维护包，社区广泛使用，风险可控

### 3. SDD 产物目录较大 (Low)
- **文件**: `specs/inbox-scoring-streaming/` 目录
- **风险**: 包含多个文档文件，可能增大 repo 体积
- **缓解**: SDD 文档是 feature 必要产物，便于后续维护和回溯

---

## Commit Batches

### Batch 1: 依赖和基础设施
**Scope**: SDK 安装和类型定义

**Files**:
- `package.json`
- `pnpm-lock.yaml`

**Commit Message**:
```
feat(ai): 安装 OpenAI SDK 支持流式调用

- 新增 openai@6.42.0 依赖
- 用于 Anthropic 流式 API 兼容层

Related: inbox-scoring-streaming Phase 1
```

---

### Batch 2: 核心实现
**Scope**: 流式函数和错误映射

**Files**:
- `src/lib/ai/server/client.ts`
- `src/lib/ai/server/inbox-scorer.ts`
- `src/lib/ai/server/__tests__/client.test.ts`

**Commit Message**:
```
feat(ai): 实现 inbox 评分流式调用

核心改动:
- 新增 classifyAiError: 映射 OpenAI SDK 错误到 AiCallError
- 新增 serverGenerateJSONStream: 流式 JSON 生成函数
- inbox-scorer 切换到流式调用
- 新增 21 个流式单测

解决问题:
- opus 模型同步调用超时 (524/429)
- 批量评分占槽位久易撞并发限制

测试覆盖:
- 流式累积、中断恢复、错误分类
- 全量测试通过 (65 files / 281 tests)

Related: inbox-scoring-streaming Phase 1-3
```

---

### Batch 3: 验证工具
**Scope**: Phase 4/5 验证探针

**Files**:
- `scripts/verify-streaming-probe.ts`

**Commit Message**:
```
feat(tools): 添加流式调用验证探针

用途:
- Phase 4 本地验证 100xlabs 兼容层
- Phase 5 NAS 生产验证 opus TTFT

特性:
- 独立脚本，不依赖 server-only
- 支持环境变量配置 baseURL 和模型
- 输出性能指标 (TTFT, 总耗时)

使用方式见: specs/inbox-scoring-streaming/phase4-verification-guide.md

Related: inbox-scoring-streaming Phase 4
```

---

### Batch 4: SDD 文档
**Scope**: 完整 SDD 产物

**Files**:
- `specs/inbox-scoring-streaming/spec.md`
- `specs/inbox-scoring-streaming/plan.md`
- `specs/inbox-scoring-streaming/tasks.md`
- `specs/inbox-scoring-streaming/context-manifest.md`
- `specs/inbox-scoring-streaming/phase4-verification-guide.md`
- `specs/inbox-scoring-streaming/acceptance.md`

**Commit Message**:
```
docs(sdd): inbox 评分流式调用 SDD 产物

包含:
- spec.md: 需求规格 (P1 场景、验收标准)
- plan.md: 实现方案 (ADR-001/002/003)
- tasks.md: 任务列表 (Phase 1-5, 11/13 完成)
- context-manifest.md: 上下文清单
- phase4-verification-guide.md: Phase 4 验证指南
- acceptance.md: 验收记录 (CONDITIONAL PASS)

Feature Traits: multi-stage-workflow, artifact-handoff, user-visible-output
Verdict: CONDITIONAL PASS (Phase 5 NAS 验证延后)

Related: inbox-scoring-streaming Closeout
```

---

## Execution Plan

如用户确认提交，执行顺序：

```bash
# Batch 1: 依赖
git add package.json pnpm-lock.yaml
git commit -m "feat(ai): 安装 OpenAI SDK 支持流式调用

- 新增 openai@6.42.0 依赖
- 用于 Anthropic 流式 API 兼容层

Related: inbox-scoring-streaming Phase 1"

# Batch 2: 核心实现
git add src/lib/ai/server/client.ts src/lib/ai/server/inbox-scorer.ts src/lib/ai/server/__tests__/client.test.ts
git commit -m "feat(ai): 实现 inbox 评分流式调用

核心改动:
- 新增 classifyAiError: 映射 OpenAI SDK 错误到 AiCallError
- 新增 serverGenerateJSONStream: 流式 JSON 生成函数
- inbox-scorer 切换到流式调用
- 新增 21 个流式单测

解决问题:
- opus 模型同步调用超时 (524/429)
- 批量评分占槽位久易撞并发限制

测试覆盖:
- 流式累积、中断恢复、错误分类
- 全量测试通过 (65 files / 281 tests)

Related: inbox-scoring-streaming Phase 1-3"

# Batch 3: 验证工具
git add scripts/verify-streaming-probe.ts
git commit -m "feat(tools): 添加流式调用验证探针

用途:
- Phase 4 本地验证 100xlabs 兼容层
- Phase 5 NAS 生产验证 opus TTFT

特性:
- 独立脚本，不依赖 server-only
- 支持环境变量配置 baseURL 和模型
- 输出性能指标 (TTFT, 总耗时)

使用方式见: specs/inbox-scoring-streaming/phase4-verification-guide.md

Related: inbox-scoring-streaming Phase 4"

# Batch 4: SDD 文档
git add specs/inbox-scoring-streaming/
git commit -m "docs(sdd): inbox 评分流式调用 SDD 产物

包含:
- spec.md: 需求规格 (P1 场景、验收标准)
- plan.md: 实现方案 (ADR-001/002/003)
- tasks.md: 任务列表 (Phase 1-5, 11/13 完成)
- context-manifest.md: 上下文清单
- phase4-verification-guide.md: Phase 4 验证指南
- acceptance.md: 验收记录 (CONDITIONAL PASS)

Feature Traits: multi-stage-workflow, artifact-handoff, user-visible-output
Verdict: CONDITIONAL PASS (Phase 5 NAS 验证延后)

Related: inbox-scoring-streaming Closeout"
```

---

## User Confirmation Required

**请确认是否执行提交**:

1. ✅ **立即提交全部 4 个 batch** - 我将按上述顺序执行提交
2. ⚠️ **只提交部分 batch** - 请指定要提交的 batch 编号
3. ⏸️ **暂不提交** - 将 commit plan 保存为文档，稍后手动提交

**注意事项**:
- 提交后不会自动 push，需手动执行 `git push`
- `.claude/settings.local.json` 不会被提交
- 所有提交遵循 Conventional Commits 规范

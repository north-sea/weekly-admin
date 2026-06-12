# Phase 4 本地探针验证指南

## T010: 100xlabs 兼容层验证

### 前置条件
- 有效的 AI API Key（100xlabs 或 Anthropic）
- 网络可访问目标 API 端点

### 验证步骤

#### 1. 验证 100xlabs 兼容层

```bash
AI_BASE_URL=https://sub.100xlabs.space \
AI_API_KEY=<your-100xlabs-key> \
pnpm tsx scripts/verify-streaming-probe.ts
```

**预期结果**:
- ✅ 返回正常 JSON 结构
- ✅ 无兼容层转换错误
- ✅ Schema 解析成功
- ✅ 流式不超时（总耗时 < 30s）

**观察指标**:
- 首 token 延迟 (TTFT)：预期 13-15s（opus 模型）或 2-3s（haiku 模型）
- 总耗时：预期 30-35s（opus）
- 累积耗时：总耗时 - TTFT

#### 2. 对比验证 Anthropic 官方 API

如果 100xlabs 验证失败，切换到 Anthropic 官方 API 排查是兼容层问题还是网络/配置问题：

```bash
AI_BASE_URL=https://api.anthropic.com \
AI_API_KEY=<your-anthropic-key> \
pnpm tsx scripts/verify-streaming-probe.ts
```

#### 3. 故障排查

**如果遇到连接错误**:
- 检查 API Key 是否有效
- 检查网络是否可访问目标 URL（`curl -I <base-url>`）
- 检查是否需要代理

**如果返回 HTML 错误页**:
- 查看错误分类应为 `transient`
- 确认 detail 字段被截断（不超过 300 字符）
- 这是预期行为，classifyAiError 会正确映射

**如果 JSON 解析失败**:
- 查看原始响应内容
- 确认是否包含 markdown 代码块（应被自动清理）
- 确认是否有 `.0` 等坏格式（应被 repairLooseJson 修复）

---

## T011: 首 token 延迟模拟验证

### 验证步骤

#### 1. 真实 opus 调用（慢模型 TTFT 验证）

```bash
AI_BASE_URL=https://sub.100xlabs.space \
AI_API_KEY=<your-key> \
AI_TEXT_MODEL=claude-opus-4-20250514 \
pnpm tsx scripts/verify-streaming-probe.ts
```

**预期 TTFT**: 13-15 秒
**预期总耗时**: 30-35 秒
**验证要点**: 首 token 延迟长但不超时

#### 2. haiku 对比验证（快模型 TTFT）

```bash
AI_BASE_URL=https://sub.100xlabs.space \
AI_API_KEY=<your-key> \
AI_TEXT_MODEL=claude-3-5-haiku-20241022 \
pnpm tsx scripts/verify-streaming-probe.ts
```

**预期 TTFT**: 2-3 秒
**预期总耗时**: 5-8 秒
**验证要点**: 快模型流式响应更快

---

## 验证完成标准

T010 和 T011 完成后，应满足：

1. ✅ 流式调用成功返回 JSON（非 HTML 错误页）
2. ✅ 无兼容层转换错误（100xlabs 或 Anthropic 官方都通过）
3. ✅ TTFT 在预期范围内（opus 13-15s，haiku 2-3s）
4. ✅ 总耗时不超时（< 30s 阈值）
5. ✅ JSON 解析和 schema 验证通过
6. ✅ 错误分类正确（transient/invalid_response/auth/unknown）

---

## 跳过 Phase 4 的条件

如果满足以下任一条件，可以跳过 Phase 4 本地探针：

1. **无可用 API Key**：项目使用数据库配置，本地环境无法访问
2. **网络限制**：无法访问目标 API 端点
3. **时间约束**：Phase 1-3 已完成核心实现和兼容性验证

跳过后的影响：
- Phase 5 NAS 生产验证会覆盖真实流式行为
- Phase 1-3 已验证函数签名、错误映射、单测覆盖
- 风险可控：流式逻辑已有单测保护

---

## 下一步

完成 Phase 4 后，进入 **Phase 5: NAS 生产验证**（T012-T013）
或跳过 Phase 4，直接进入 **Verify 阶段**做代码审查和架构检查。

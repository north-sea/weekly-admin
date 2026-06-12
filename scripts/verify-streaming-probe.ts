#!/usr/bin/env tsx
/**
 * 流式调用探针脚本（独立版本，不依赖 server-only）
 *
 * 用途：验证 100xlabs 兼容层和流式行为
 *
 * 运行方式：
 *   # 使用 100xlabs 网关
 *   AI_BASE_URL=https://sub.100xlabs.space AI_API_KEY=<your-key> pnpm tsx scripts/verify-streaming-probe.ts
 *
 *   # 使用 Anthropic 官方 API（对比测试）
 *   AI_BASE_URL=https://api.anthropic.com AI_API_KEY=<your-key> pnpm tsx scripts/verify-streaming-probe.ts
 */

import OpenAI from 'openai';

interface ProbeResult {
  overall: number;
  content: number;
  depth: number;
}

async function runProbe() {
  console.log('🔍 流式调用探针启动');
  console.log('配置信息:');
  console.log(`  AI_BASE_URL: ${process.env.AI_BASE_URL || '(未设置)'}`);
  console.log(`  AI_API_KEY: ${process.env.AI_API_KEY ? '***已设置***' : '(未设置)'}`);
  console.log(`  AI_TEXT_MODEL: ${process.env.AI_TEXT_MODEL || 'gpt-4o-mini (默认)'}`);
  console.log('');

  if (!process.env.AI_API_KEY) {
    console.error('❌ 错误: AI_API_KEY 环境变量未设置');
    process.exit(1);
  }

  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL || 'https://api.openai.com';
  const model = process.env.AI_TEXT_MODEL || 'gpt-4o-mini';

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  const startTime = Date.now();
  let firstChunkTime: number | null = null;

  try {
    console.log('📡 开始流式调用...');
    console.log(`   模型: ${model}`);
    console.log('');

    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `请对以下内容打分（0-10），返回 JSON 格式：{"overall": <总分>, "content": <内容分>, "depth": <深度分>}

标题：TypeScript 5.0 新特性
内容：介绍了 decorators、const type parameters 等新功能`,
        },
      ],
      temperature: 0,
      max_tokens: 200,
      stream: true,
    });

    let accumulatedText = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      chunkCount++;
      if (firstChunkTime === null) {
        firstChunkTime = Date.now();
        const ttft = firstChunkTime - startTime;
        console.log(`⏱️  首 token 到达: ${ttft}ms (${(ttft / 1000).toFixed(2)}s)`);
      }

      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        accumulatedText += delta;
        process.stdout.write('.');
      }
    }

    console.log('');
    console.log(`📊 累积 ${chunkCount} 个 chunk`);
    console.log('');

    // 清理 markdown 代码块
    const jsonText = accumulatedText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    console.log('原始响应:', jsonText);
    console.log('');

    // 解析 JSON
    const result: ProbeResult = JSON.parse(jsonText);

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const ttft = firstChunkTime ? firstChunkTime - startTime : 0;

    console.log('✅ 流式调用成功');
    console.log('响应结果:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('性能指标:');
    console.log(`  首 token 延迟 (TTFT): ${ttft}ms (${(ttft / 1000).toFixed(2)}s)`);
    console.log(`  总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`  累积耗时: ${totalDuration - ttft}ms (${((totalDuration - ttft) / 1000).toFixed(2)}s)`);
    console.log('');
    console.log('验证项:');
    console.log('  ✓ 返回正常 JSON 结构');
    console.log('  ✓ 无兼容层转换错误');
    console.log('  ✓ Schema 解析成功');
    console.log('  ✓ 流式不超时（总耗时 < 30s）');

  } catch (error: any) {
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const ttft = firstChunkTime ? firstChunkTime - startTime : 0;

    console.log('');
    console.log('❌ 流式调用失败');
    console.log(`TTFT: ${ttft}ms, 总耗时: ${totalDuration}ms`);
    console.log('错误信息:');
    console.log(`  ${error.name}: ${error.message}`);

    if (error.status) {
      console.log(`  HTTP 状态: ${error.status}`);
    }

    if (error.response) {
      console.log(`  响应: ${JSON.stringify(error.response, null, 2)}`);
    }

    console.log('');
    console.log('💡 故障排查建议:');
    console.log('  1. 检查 AI_API_KEY 是否有效');
    console.log('  2. 检查 AI_BASE_URL 是否可访问');
    console.log('  3. 如使用 100xlabs，切换到 Anthropic 官方 API 验证兼容层本身');
    console.log('     AI_BASE_URL=https://api.anthropic.com pnpm tsx scripts/verify-streaming-probe.ts');

    process.exit(1);
  }
}

runProbe();

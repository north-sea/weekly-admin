import 'dotenv/config';
import Module from 'node:module';

const moduleWithPrivateLoad = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = moduleWithPrivateLoad._load;

moduleWithPrivateLoad._load = function loadWorkerModule(request, parent, isMain) {
  if (request === 'server-only') {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

async function main() {
  const { serverGenerateText } = await import('@/lib/ai/server/client');
  const { z } = await import('zod');

  const ScoreSchema = z.object({
    dimensions: z.object({
      topic: z.number().min(0).max(10),
      content: z.number().min(0).max(10),
      depth: z.number().min(0).max(10),
      practical: z.number().min(0).max(10),
      innovation: z.number().min(0).max(10),
      expression: z.number().min(0).max(10),
    }),
    overall: z.number().min(0).max(10),
    reasons: z.array(z.string().min(1)).min(1).max(8),
  });

  console.log('测试完整评分流程（使用 serverGenerateText + JSON.parse）\n');

  try {
    const text = await serverGenerateText({
      configId: 6, // wong
      messages: [{
        role: 'user',
        content: `你是一个内容评分助手。返回 JSON 格式的评分。

评分维度（0-10分）：
- topic: 主题价值
- content: 内容质量
- depth: 深度
- practical: 实用性
- innovation: 创新性
- expression: 表达质量

返回格式：
{
  "dimensions": {
    "topic": 数字,
    "content": 数字,
    "depth": 数字,
    "practical": 数字,
    "innovation": 数字,
    "expression": 数字
  },
  "overall": 数字,
  "reasons": ["理由1", "理由2"]
}

标题：GitHub - lazygophers/ccplugin
URL：https://github.com/lazygophers/ccplugin
摘要：一个 Go 语言插件`
      }],
      system: 'Return ONLY valid JSON.',
      temperature: 0,
      maxTokens: 512
    });

    console.log('✅ Got text response');
    console.log('Raw text:');
    console.log(text);
    console.log('\n---\n');

    const jsonText = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    console.log('Cleaned text:');
    console.log(jsonText);
    console.log('\n---\n');

    const parsed = JSON.parse(jsonText);
    console.log('Parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('\n---\n');

    const validated = ScoreSchema.safeParse(parsed);
    if (validated.success) {
      console.log('✅ Zod validation PASSED');
      console.log(JSON.stringify(validated.data, null, 2));
    } else {
      console.log('❌ Zod validation FAILED');
      console.log('Errors:', JSON.stringify(validated.error.errors, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.kind) console.error('Kind:', error.kind);
    if (error.detail) console.error('Detail:', error.detail);
  }
}

main().catch(console.error);

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
  const { serverGenerateJSONStream } = await import('@/lib/ai/server/client');

  console.log('测试评分请求（使用 wong 渠道）\n');

  try {
    const result = await serverGenerateJSONStream({
      configId: 6, // wong 渠道
      system: `你是一个内容评分助手。评估技术文章的质量并返回 JSON 格式的评分。

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
}`,
      messages: [
        { role: 'user', content: '标题：GitHub - lazygophers/ccplugin\nURL：https://github.com/lazygophers/ccplugin\n摘要：一个 Go 语言插件' }
      ],
      maxTokens: 512
    });

    console.log('✅ 成功！返回结果：');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ 失败:', error.message);
    if (error.kind) console.error('错误类型:', error.kind);
    if (error.detail) console.error('详情:', error.detail);
  }
}

main().catch(console.error);

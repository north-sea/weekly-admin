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

  console.log('测试评分请求（使用烁渠道 configId=5）\n');

  try {
    const result = await serverGenerateJSONStream({
      configId: 5, // 烁渠道
      system: `你是一个内容评分助手。返回 JSON 格式的评分。`,
      messages: [
        { role: 'user', content: '标题：测试\n摘要：这是一个测试' }
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

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
  const { prisma } = await import('@/lib/db');
  const { decrypt } = await import('@/lib/crypto');
  const OpenAI = (await import('openai')).default;

  const config = await prisma.ai_configs.findUnique({ where: { id: 5 } });
  if (!config) {
    console.error('渠道 5 不存在');
    process.exit(1);
  }

  const apiKey = decrypt(config.api_key_encrypted);
  console.log('测试 OpenAI SDK 流式模式（模拟评分场景）\n');

  const client = new OpenAI({
    apiKey,
    baseURL: config.base_url,
  });

  try {
    console.log('调用流式 API...');
    const stream = await client.chat.completions.create({
      model: config.text_model,
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON.' },
        { role: 'user', content: 'Generate a JSON object with fields: name (string) and score (number 0-10)' },
      ],
      temperature: 0,
      max_tokens: 200,
      stream: true,
    });

    console.log('开始接收流式数据...');
    let accumulatedText = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      chunkCount++;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        accumulatedText += delta;
        console.log(`Chunk ${chunkCount}:`, JSON.stringify(delta));
      }
    }

    console.log('\n✅ 流式接收完成');
    console.log('总 chunk 数:', chunkCount);
    console.log('累积文本长度:', accumulatedText.length);
    console.log('累积文本:', accumulatedText);

    if (accumulatedText.length === 0) {
      console.error('\n❌ 警告：累积文本为空！');
    } else {
      const jsonText = accumulatedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      console.log('\n清理后的文本:', jsonText);

      try {
        const parsed = JSON.parse(jsonText);
        console.log('✅ JSON 解析成功:', parsed);
      } catch (e: any) {
        console.error('❌ JSON 解析失败:', e.message);
      }
    }
  } catch (error: any) {
    console.error('❌ 流式调用失败:', error.message);
    console.error('Stack:', error.stack);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

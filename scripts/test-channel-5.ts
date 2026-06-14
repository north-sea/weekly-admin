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

  async function testChannel5() {
  // 获取渠道 5 配置
  const config = await prisma.ai_configs.findUnique({
    where: { id: 5 },
  });

  if (!config) {
    console.error('渠道 5 不存在');
    process.exit(1);
  }

  console.log('渠道 5 配置:');
  console.log('  Provider:', config.provider);
  console.log('  Base URL:', config.base_url);
  console.log('  Model:', config.text_model);

  const apiKey = decrypt(config.api_key_encrypted);
  console.log('  API Key:', apiKey.slice(0, 20) + '...');

  // 创建 OpenAI 客户端
  const client = new OpenAI({
    apiKey,
    baseURL: config.base_url,
  });

  console.log('\n测试 1: 简单文本生成');
  try {
    const completion = await client.chat.completions.create({
      model: config.text_model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello World"' },
      ],
      temperature: 0,
      max_tokens: 100,
    });

    console.log('✅ 成功');
    console.log('Response:', JSON.stringify(completion, null, 2));
  } catch (error: any) {
    console.error('❌ 失败');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Body:', await error.response.text?.());
    }
  }

  console.log('\n测试 2: JSON 输出');
  try {
    const completion = await client.chat.completions.create({
      model: config.text_model,
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON.' },
        { role: 'user', content: 'Generate a JSON object with fields: name (string) and score (number 0-10)' },
      ],
      temperature: 0,
      max_tokens: 200,
    });

    console.log('✅ 成功');
    console.log('Response:', JSON.stringify(completion, null, 2));

    const content = completion.choices[0]?.message?.content;
    if (content) {
      console.log('\n尝试解析 JSON:');
      try {
        const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
        console.log('✅ JSON 解析成功:', parsed);
      } catch (e: any) {
        console.error('❌ JSON 解析失败:', e.message);
        console.error('原始内容:', content);
      }
    }
  } catch (error: any) {
    console.error('❌ 失败');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Body:', await error.response.text?.());
    }
  }

  console.log('\n测试 3: 流式 JSON 输出（模拟评分场景）');
  try {
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

    let accumulatedText = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        accumulatedText += delta;
      }
    }

    console.log('✅ 流式接收成功');
    console.log('累积文本长度:', accumulatedText.length);
    console.log('累积文本:', accumulatedText);

    const jsonText = accumulatedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    console.log('\n清理后的文本:', jsonText);

    try {
      const parsed = JSON.parse(jsonText);
      console.log('✅ JSON 解析成功:', parsed);
    } catch (e: any) {
      console.error('❌ JSON 解析失败:', e.message);
      console.error('Hex dump (前 200 字符):');
      for (let i = 0; i < Math.min(200, jsonText.length); i++) {
        process.stdout.write(jsonText.charCodeAt(i).toString(16).padStart(2, '0') + ' ');
        if ((i + 1) % 16 === 0) process.stdout.write('\n');
      }
      console.log('');
    }
  } catch (error: any) {
    console.error('❌ 失败');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }

    await prisma.$disconnect();
  }

  await testChannel5();
}

main().catch(console.error);

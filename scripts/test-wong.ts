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

  const config = await prisma.ai_configs.findUnique({ where: { id: 6 } });
  if (!config) {
    console.error('渠道 6 (wong) 不存在');
    process.exit(1);
  }

  const apiKey = decrypt(config.api_key_encrypted);
  console.log('Base URL:', config.base_url);
  console.log('Model:', config.text_model);

  console.log('\n测试：使用 fetch 直接调用');
  try {
    const response = await fetch(`${config.base_url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.text_model,
        messages: [
          { role: 'user', content: 'Say hi' },
        ],
        temperature: 0,
        max_tokens: 50,
      }),
    });

    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));

    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('Response:', text);
  } catch (error: any) {
    console.error('❌ 异常:', error.message);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

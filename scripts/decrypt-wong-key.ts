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
  const { decrypt } = await import('@/lib/crypto');

  const encrypted = 't1gGBZ8RUexHBP54:XnoFl2othSWS4imdiQ7vMQ==:4kC5X4pN8DHpdLS0q0X4s+3BIOa6hoiLZ9jXFV0rDLsxZFlY1J5/kgv4Lx1y2cVa';

  try {
    const apiKey = decrypt(encrypted);
    console.log('API Key:', apiKey);
  } catch (error: any) {
    console.error('解密失败:', error.message);
  }
}

main().catch(console.error);

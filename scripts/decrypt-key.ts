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

  const config = await prisma.ai_configs.findUnique({ where: { id: 5 } });
  if (config) {
    const apiKey = decrypt(config.api_key_encrypted);
    console.log('Encrypted:', config.api_key_encrypted);
    console.log('Decrypted API Key:', apiKey);
  }
  await prisma.$disconnect();
}

main().catch(console.error);

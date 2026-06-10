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
  const { createAutomationWorker } = await import('@/lib/jobs/worker');
  const worker = createAutomationWorker();

  console.log('[automation-worker] Worker started');

  async function shutdown(signal: NodeJS.Signals) {
    console.log(`[automation-worker] Received ${signal}, closing worker`);
    try {
      await worker.close();
      console.log('[automation-worker] Worker closed');
      process.exit(0);
    } catch (error) {
      console.error('[automation-worker] Failed to close worker', error);
      process.exit(1);
    }
  }

  process.once('SIGINT', (signal) => {
    void shutdown(signal);
  });

  process.once('SIGTERM', (signal) => {
    void shutdown(signal);
  });
}

void main().catch((error) => {
  console.error('[automation-worker] Failed to start worker', error);
  process.exit(1);
});

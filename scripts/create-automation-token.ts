import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { generateAutomationToken } from '../src/lib/automation/auth';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
      continue;
    }

    args.set(key, next);
    i += 1;
  }
  return args;
}

function parseScopes(value: string | boolean | undefined) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing required --scopes value, for example: --scopes weekly:read,weekly:suggest');
  }
  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.get('name');
  const callerType = args.get('caller-type') ?? 'cron';
  const expiresAt = args.get('expires-at');

  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Missing required --name value');
  }
  if (typeof callerType !== 'string' || !callerType.trim()) {
    throw new Error('--caller-type must be a non-empty string');
  }

  const scopes = parseScopes(args.get('scopes'));
  const generated = generateAutomationToken();

  await prisma.automation_tokens.create({
    data: {
      name,
      token_hash: generated.tokenHash,
      token_prefix: generated.tokenPrefix,
      caller_type: callerType,
      scopes,
      expires_at: typeof expiresAt === 'string' ? new Date(expiresAt) : undefined,
    },
  });

  console.log('Automation token created. Store this token now; it will not be shown again.');
  console.log(`name=${name}`);
  console.log(`caller_type=${callerType}`);
  console.log(`token_prefix=${generated.tokenPrefix}`);
  console.log(`token=${generated.token}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

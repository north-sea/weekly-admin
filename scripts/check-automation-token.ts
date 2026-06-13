#!/usr/bin/env node
/**
 * 检查和创建 automation token for cron
 */

import { prisma } from '../src/lib/db';
import { generateAutomationToken } from '../src/lib/automation/auth';

async function main() {
  console.log('=== Automation Token Check ===\n');

  // 1. 查看现有 token
  const existingTokens = await prisma.automation_tokens.findMany({
    select: {
      id: true,
      name: true,
      token_prefix: true,
      caller_type: true,
      scopes: true,
      status: true,
      expires_at: true,
      last_used_at: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  });

  console.log(`📋 现有 Automation Tokens (${existingTokens.length} 个):\n`);

  if (existingTokens.length === 0) {
    console.log('  (无现有 token)\n');
  } else {
    existingTokens.forEach((token) => {
      console.log(`  [${token.id}] ${token.name}`);
      console.log(`    prefix: ${token.token_prefix}`);
      console.log(`    caller_type: ${token.caller_type}`);
      console.log(`    scopes: ${JSON.stringify(token.scopes)}`);
      console.log(`    status: ${token.status}`);
      console.log(`    expires_at: ${token.expires_at ?? 'never'}`);
      console.log(`    last_used_at: ${token.last_used_at ?? 'never'}`);
      console.log(`    created_at: ${token.created_at}`);
      console.log('');
    });
  }

  // 2. 检查是否有适合 cron 的 token (score:run scope)
  const cronToken = existingTokens.find((t) => {
    const scopes = Array.isArray(t.scopes) ? t.scopes : [];
    return (
      t.status === 'active' &&
      !t.expires_at &&
      scopes.includes('score:run') &&
      t.caller_type === 'cron'
    );
  });

  if (cronToken) {
    console.log(`✅ 找到适合的 cron token: [${cronToken.id}] ${cronToken.name}`);
    console.log('   使用其 token_prefix 在 .env 中查找完整 token，或创建新的。\n');
  } else {
    console.log('⚠️  未找到适合的 cron token (需要: caller_type=cron, status=active, scopes 包含 score:run)\n');
  }

  // 3. 提供创建示例
  console.log('---\n');
  console.log('💡 创建新 token 的 SQL 示例:\n');

  const { token, tokenHash, tokenPrefix } = generateAutomationToken();

  console.log('-- 1. 生成的 token (保存到 NAS 环境变量):');
  console.log(`CRON_API_TOKEN=${token}\n`);

  console.log('-- 2. 插入数据库的 SQL:');
  console.log(`INSERT INTO automation_tokens (
  name,
  token_hash,
  token_prefix,
  caller_type,
  scopes,
  status,
  created_at,
  updated_at
) VALUES (
  'Cron Scheduler',
  '${tokenHash}',
  '${tokenPrefix}',
  'cron',
  JSON_ARRAY('score:run'),
  'active',
  NOW(),
  NOW()
);\n`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * 手动触发一次 inbox 评分
 */

import { runInboxScoringSchedulerOnce } from '../src/lib/scheduling/inbox-scoring-scheduler';

async function main() {
  console.log('=== Manual Inbox Scoring Trigger ===\n');

  console.log('环境变量:');
  console.log(`  REDIS_URL: ${process.env.REDIS_URL ? '已设置' : '未设置'}`);
  console.log(`  CRON_API_TOKEN: ${process.env.CRON_API_TOKEN ? '已设置 (前15字符: ' + process.env.CRON_API_TOKEN.slice(0, 15) + '...)' : '未设置'}`);
  console.log('');

  try {
    const result = await runInboxScoringSchedulerOnce();

    if (result.queued) {
      console.log('✅ 评分任务已提交到队列:');
      console.log(`   runId: ${result.job.runId}`);
      console.log(`   status: ${result.job.status}`);
      console.log(`   idempotentReplay: ${result.job.idempotentReplay}`);
    } else {
      console.log(`⚠️  任务未提交: ${result.reason}`);
      if (result.reason === 'token_missing') {
        console.log('   CRON_API_TOKEN 仍然缺失');
      } else if (result.reason === 'disabled') {
        console.log('   评分功能已禁用');
      }
    }
  } catch (error) {
    console.error('❌ 触发失败:', error);
    process.exit(1);
  }
}

main();

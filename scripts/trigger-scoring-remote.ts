#!/usr/bin/env node
/**
 * 通过 SSH 在 NAS 容器内触发评分任务
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('=== 远程触发 Inbox 评分任务 ===\n');

  const script = `
const { runInboxScoringSchedulerOnce } = require('./dist/lib/scheduling/inbox-scoring-scheduler.js');

runInboxScoringSchedulerOnce().then(result => {
  console.log('Result:', JSON.stringify(result, null, 2));
}).catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
`;

  try {
    const { stdout, stderr } = await execAsync(
      `ssh nas "docker exec weekly-admin node -e '${script.replace(/'/g, "'\\''")}'"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    if (stdout) console.log(stdout);
    if (stderr) console.error('stderr:', stderr);
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

main();

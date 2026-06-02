import { Cron } from 'croner';
import { InboxScoringService } from '@/lib/services/inbox-scoring';
import { AiSettingsService } from '@/lib/services/ai-settings';

const SCHEDULER_KEY = '__inboxScoringSchedulerStarted';

declare global {
  var __inboxScoringCronJob: Cron | undefined;
  var __inboxScoringSchedulerStarted: boolean | undefined;
}

async function isEnabled(): Promise<boolean> {
  const record = await AiSettingsService.get('inbox_scoring_enabled');
  if (!record) return true;
  const val = record.value as { value?: boolean };
  return val?.value ?? true;
}

export function startInboxScoringScheduler(): void {
  const flags = globalThis as Record<string, unknown>;
  if (flags[SCHEDULER_KEY]) {
    return;
  }
  flags[SCHEDULER_KEY] = true;

  globalThis.__inboxScoringCronJob = new Cron('0 * * * *', { name: 'inbox-scoring', protect: true }, async () => {
    try {
      const enabled = await isEnabled();
      if (!enabled) {
        console.log('[inbox-scoring-scheduler] scoring disabled, skipping');
        return;
      }
      console.log('[inbox-scoring-scheduler] starting batch...');
      const result = await InboxScoringService.runBatch({ source: 'cron' });
      console.log(`[inbox-scoring-scheduler] done: ${result.scored} scored, ${result.failed} failed, ${result.skipped} skipped`);
    } catch (error) {
      console.error('[inbox-scoring-scheduler] unhandled error:', error);
    }
  });

  console.log('[inbox-scoring-scheduler] started (every hour at :00)');
}

export function stopInboxScoringScheduler(): void {
  if (globalThis.__inboxScoringCronJob) {
    globalThis.__inboxScoringCronJob.stop();
    globalThis.__inboxScoringCronJob = undefined;
  }
  const flags = globalThis as Record<string, unknown>;
  flags[SCHEDULER_KEY] = false;
  console.log('[inbox-scoring-scheduler] stopped');
}

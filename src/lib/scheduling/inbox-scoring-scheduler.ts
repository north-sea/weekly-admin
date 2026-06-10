import { Cron } from 'croner';

import { authenticateAutomationTokenValue, type AutomationCaller } from '@/lib/automation/auth';
import { submitAutomationJob, type QueuedAutomationJob } from '@/lib/jobs/submit';
import { AiSettingsService } from '@/lib/services/ai-settings';

const SCHEDULER_KEY = '__inboxScoringSchedulerStarted';

declare global {
  var __inboxScoringCronJob: Cron | undefined;
  var __inboxScoringSchedulerStarted: boolean | undefined;
}

type SchedulerLogger = Pick<typeof console, 'error' | 'info' | 'log' | 'warn'>;

export type InboxScoringSchedulerResult =
  | { queued: true; job: QueuedAutomationJob }
  | { queued: false; reason: 'disabled' | 'token_missing' };

type SchedulerDeps = {
  isEnabled?: () => Promise<boolean>;
  getToken?: () => string | null;
  authenticateToken?: typeof authenticateAutomationTokenValue;
  submitJob?: typeof submitAutomationJob;
  now?: () => Date;
  logger?: SchedulerLogger;
};

async function isEnabled(): Promise<boolean> {
  const record = await AiSettingsService.get('inbox_scoring_enabled');
  if (!record) return true;
  const val = record.value as { value?: boolean };
  return val?.value ?? true;
}

function getCronAutomationToken(): string | null {
  const token = process.env.CRON_API_TOKEN?.trim();
  return token || null;
}

function buildSchedulerIdempotencyKey(now: Date): string {
  return `cron:inbox-scoring:${now.toISOString().slice(0, 13)}`;
}

export async function runInboxScoringSchedulerOnce(deps: SchedulerDeps = {}): Promise<InboxScoringSchedulerResult> {
  const logger = deps.logger ?? console;
  const enabled = await (deps.isEnabled ?? isEnabled)();
  if (!enabled) {
    logger.log('[inbox-scoring-scheduler] scoring disabled, skipping');
    return { queued: false, reason: 'disabled' };
  }

  const token = (deps.getToken ?? getCronAutomationToken)();
  if (!token) {
    logger.warn('[inbox-scoring-scheduler] CRON_API_TOKEN missing, skipping queue submission');
    return { queued: false, reason: 'token_missing' };
  }

  const caller = await (deps.authenticateToken ?? authenticateAutomationTokenValue)(token, 'score:run') as AutomationCaller;
  const job = await (deps.submitJob ?? submitAutomationJob)({
    caller,
    jobName: 'score.run',
    idempotencyKey: buildSchedulerIdempotencyKey((deps.now ?? (() => new Date()))()),
    payload: { source: 'cron' },
  });

  logger.log('[inbox-scoring-scheduler] queued scoring job', {
    runId: job.runId,
    status: job.status,
    idempotentReplay: job.idempotentReplay,
  });
  return { queued: true, job };
}

export function startInboxScoringScheduler(): void {
  const flags = globalThis as Record<string, unknown>;
  if (flags[SCHEDULER_KEY]) {
    return;
  }
  flags[SCHEDULER_KEY] = true;

  globalThis.__inboxScoringCronJob = new Cron('0 * * * *', { name: 'inbox-scoring', protect: true }, async () => {
    try {
      await runInboxScoringSchedulerOnce();
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

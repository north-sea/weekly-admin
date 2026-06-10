import { describe, expect, it, vi } from 'vitest';

import type { AutomationCaller } from '@/lib/automation/auth';
import type { QueuedAutomationJob } from '@/lib/jobs/submit';
import { runInboxScoringSchedulerOnce } from './inbox-scoring-scheduler';

const caller: AutomationCaller = {
  tokenId: 7,
  name: 'cron',
  callerType: 'cron',
  tokenPrefix: 'wa_cron',
  scopes: ['score:run'],
};

const queuedJob: QueuedAutomationJob = {
  jobId: 'auto_1',
  runId: 'auto_1',
  status: 'queued',
  workflow: 'score',
  step: 'run',
  target: {
    targetType: 'inbox',
    targetId: 'score_batch',
    targetKey: 'inbox:score_batch',
  },
  statusUrl: '/api/v1/jobs/auto_1',
  idempotentReplay: false,
  caller: {
    type: 'cron',
    tokenPrefix: 'wa_cron',
  },
};

function buildLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  };
}

describe('inbox scoring scheduler', () => {
  it('skips queue submission when scoring is disabled', async () => {
    const submitJob = vi.fn();
    const logger = buildLogger();

    await expect(runInboxScoringSchedulerOnce({
      isEnabled: async () => false,
      submitJob,
      logger,
    })).resolves.toEqual({ queued: false, reason: 'disabled' });

    expect(submitJob).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('[inbox-scoring-scheduler] scoring disabled, skipping');
  });

  it('skips queue submission when CRON_API_TOKEN is missing', async () => {
    const authenticateToken = vi.fn();
    const submitJob = vi.fn();
    const logger = buildLogger();

    await expect(runInboxScoringSchedulerOnce({
      isEnabled: async () => true,
      getToken: () => null,
      authenticateToken,
      submitJob,
      logger,
    })).resolves.toEqual({ queued: false, reason: 'token_missing' });

    expect(authenticateToken).not.toHaveBeenCalled();
    expect(submitJob).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('[inbox-scoring-scheduler] CRON_API_TOKEN missing, skipping queue submission');
  });

  it('authenticates the cron token and enqueues a score job without executing scoring inline', async () => {
    const authenticateToken = vi.fn(async () => caller);
    const submitJob = vi.fn(async () => queuedJob);
    const logger = buildLogger();

    await expect(runInboxScoringSchedulerOnce({
      isEnabled: async () => true,
      getToken: () => 'wa_cron_secret',
      authenticateToken,
      submitJob,
      now: () => new Date('2026-06-08T03:15:00.000Z'),
      logger,
    })).resolves.toEqual({ queued: true, job: queuedJob });

    expect(authenticateToken).toHaveBeenCalledWith('wa_cron_secret', 'score:run');
    expect(submitJob).toHaveBeenCalledWith({
      caller,
      jobName: 'score.run',
      idempotencyKey: 'cron:inbox-scoring:2026-06-08T03',
      payload: { source: 'cron' },
    });
    expect(logger.log).toHaveBeenCalledWith('[inbox-scoring-scheduler] queued scoring job', {
      runId: 'auto_1',
      status: 'queued',
      idempotentReplay: false,
    });
  });
});

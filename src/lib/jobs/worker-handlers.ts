import { DataSourceService } from '@/lib/services/data-source';
import { SyncOrchestrator } from '@/lib/services/sync-orchestrator';
import { InboxScoringService } from '@/lib/services/inbox-scoring';
import type { AutomationRunSuccess } from '@/lib/automation/run';
import type { AutomationJobName } from './definitions';

type SyncPayload = {
  sourceId?: number;
  type?: 'rss' | 'karakeep' | 'webhook' | 'manual';
  max_items?: number;
  similarity_check?: boolean;
  auto_preprocess?: boolean;
  incremental?: boolean;
  only_due?: boolean;
};

type ScorePayload = {
  limit?: number;
  delay?: number;
  source?: 'cron' | 'sync' | 'api';
};

export class AutomationJobExecutionError extends Error {
  constructor(
    message: string,
    public readonly summary: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AutomationJobExecutionError';
  }
}

export async function executeAutomationJob(
  jobName: AutomationJobName,
  payload: Record<string, unknown>
): Promise<AutomationRunSuccess<Record<string, unknown>>> {
  switch (jobName) {
    case 'sync.run':
      return executeSyncJob(payload as SyncPayload);
    case 'score.run':
      return executeScoreJob(payload as ScorePayload);
    default:
      throw new Error(`Unsupported worker job: ${jobName}`);
  }
}

async function executeSyncJob(payload: SyncPayload): Promise<AutomationRunSuccess<Record<string, unknown>>> {
  const sources = payload.sourceId
    ? [await DataSourceService.getDataSourceById(payload.sourceId)]
    : await DataSourceService.listDataSources({ type: payload.type, enabled: true });
  const runnableSources = sources.filter((source): source is NonNullable<typeof source> => Boolean(source));
  const selectedSources = payload.only_due
    ? runnableSources.filter(isSourceDue)
    : runnableSources;

  const results = [];
  let okCount = 0;
  let failedCount = 0;

  for (const source of selectedSources) {
    try {
      const result = await SyncOrchestrator.syncDataSource(source.id, {
        max_items: payload.max_items,
        similarity_check: payload.similarity_check,
        auto_preprocess: payload.auto_preprocess,
        incremental: payload.incremental,
      });
      okCount += 1;
      results.push({ source_id: source.id, name: source.name, ok: true, result });
    } catch (error) {
      failedCount += 1;
      results.push({
        source_id: source.id,
        name: source.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    status: 'succeeded',
    total_sources: selectedSources.length,
    ok_count: okCount,
    failed_count: failedCount,
    results,
  };

  if (selectedSources.length > 0 && okCount === 0 && failedCount > 0) {
    throw new AutomationJobExecutionError('All sync sources failed', {
      ...summary,
      status: 'failed',
    });
  }

  const status = selectedSources.length === 0
    ? 'empty'
    : failedCount > 0
      ? 'partial_success'
      : 'succeeded';

  return {
    status,
    result: {
      ...summary,
      status,
    },
  };
}

async function executeScoreJob(payload: ScorePayload): Promise<AutomationRunSuccess<Record<string, unknown>>> {
  const options: {
    limit?: number;
    delayMs?: number;
    source: 'cron' | 'sync' | 'api';
  } = {
    source: payload.source ?? 'api',
  };
  if (payload.limit !== undefined) options.limit = payload.limit;
  if (payload.delay !== undefined) options.delayMs = payload.delay;

  const result = await InboxScoringService.runBatch(options);
  const status = result.scored === 0 && result.failed === 0
    ? 'empty'
    : result.failed > 0
      ? 'partial_success'
      : 'succeeded';

  if (result.failed > 0 && result.scored === 0) {
    throw new AutomationJobExecutionError('Inbox scoring batch failed', {
      status: 'failed',
      ...result,
    });
  }

  return {
    status,
    result: {
      status,
      ...result,
    },
  };
}

function isSourceDue(source: { sync_interval_minutes?: number | null; last_synced_at?: Date | null }): boolean {
  if (!source.sync_interval_minutes) return false;
  if (!source.last_synced_at) return true;
  const dueAt = new Date(source.last_synced_at.getTime() + source.sync_interval_minutes * 60 * 1000);
  return Date.now() >= dueAt.getTime();
}

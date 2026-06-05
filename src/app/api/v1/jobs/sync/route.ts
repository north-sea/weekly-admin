import { NextRequest } from 'next/server';
import { z } from 'zod';

import { DataSourceService } from '@/lib/services/data-source';
import { SyncOrchestrator } from '@/lib/services/sync-orchestrator';
import { automationErrorToResponse, getRequiredIdempotencyKey, runAutomationRoute } from '@/lib/automation/http';

const BodySchema = z.object({
  sourceId: z.number().int().positive().optional(),
  type: z.enum(['rss', 'karakeep', 'webhook', 'manual']).optional(),
  max_items: z.number().int().min(1).max(500).optional(),
  similarity_check: z.boolean().optional(),
  auto_preprocess: z.boolean().optional(),
  incremental: z.boolean().optional(),
  only_due: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const idempotencyKey = getRequiredIdempotencyKey(request);

    return runAutomationRoute(request, {
      scope: 'sync:run',
      workflow: 'sync',
      step: 'run',
      targetType: body.sourceId ? 'data_source' : 'data_sources',
      targetId: body.sourceId,
      idempotencyKey,
      requestPayload: body,
      handler: async () => {
        const sources = body.sourceId
          ? [await DataSourceService.getDataSourceById(body.sourceId)]
          : await DataSourceService.listDataSources({ type: body.type, enabled: true });
        const runnableSources = sources.filter((source): source is NonNullable<typeof source> => Boolean(source));

        const results = [];
        let okCount = 0;
        let failedCount = 0;
        for (const source of runnableSources) {
          if (body.only_due) {
            if (!source.sync_interval_minutes || !source.last_synced_at) continue;
            const dueAt = new Date(source.last_synced_at.getTime() + source.sync_interval_minutes * 60 * 1000);
            if (Date.now() < dueAt.getTime()) continue;
          }

          try {
            const result = await SyncOrchestrator.syncDataSource(source.id, {
              max_items: body.max_items,
              similarity_check: body.similarity_check,
              auto_preprocess: body.auto_preprocess,
              incremental: body.incremental,
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

        const status = runnableSources.length === 0 || results.length === 0
          ? 'empty'
          : failedCount > 0
            ? 'partial_success'
            : 'succeeded';

        return {
          status,
          result: {
            status,
            total_sources: runnableSources.length,
            ok_count: okCount,
            failed_count: failedCount,
            results,
          },
        };
      },
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { DataSourceService } from '@/lib/services/data-source';
import { SyncOrchestrator } from '@/lib/services/sync-orchestrator';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const SyncAllSchema = z.object({
  type: z.enum(['rss', 'karakeep', 'webhook', 'manual']).optional(),
  max_items: z.number().int().min(1).max(500).optional(),
  similarity_check: z.boolean().optional(),
  auto_preprocess: z.boolean().optional(),
  incremental: z.boolean().optional(),
  only_due: z.boolean().optional(), // 只同步到期的数据源
  wait: z.boolean().optional(), // 同步完成后再返回（用于 cron 可观测）
});

// POST /api/sources/sync-all - 同步所有启用的数据源
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json().catch(() => ({}));
    const options = SyncAllSchema.parse(body);

    let sources = await DataSourceService.listDataSources({
      type: options.type,
      enabled: true,
    });

    // 如果 only_due=true，只同步到期的数据源
    if (options.only_due) {
      const now = new Date();
      sources = sources.filter((source) => {
        // 如果没有设置同步间隔，跳过
        if (!source.sync_interval_minutes) return false;
        // 如果从未同步过，需要同步
        if (!source.last_synced_at) return true;
        // 检查是否到期
        const dueTime = new Date(source.last_synced_at.getTime() + source.sync_interval_minutes * 60 * 1000);
        return now >= dueTime;
      });
    }

    const total = sources.length;
    const startedAt = new Date().toISOString();

    const syncOptions = {
      max_items: options.max_items,
      similarity_check: options.similarity_check,
      incremental: options.incremental,
      auto_preprocess: options.auto_preprocess,
    };

    if (options.wait) {
      const results: Array<{ source_id: number; name: string; ok: boolean; result?: unknown; error?: string }> = [];
      let okCount = 0;
      let failedCount = 0;

      for (const source of sources) {
        try {
          const result = await SyncOrchestrator.syncDataSource(source.id, syncOptions);
          results.push({ source_id: source.id, name: source.name, ok: true, result });
          okCount += 1;
        } catch (error) {
          results.push({
            source_id: source.id,
            name: source.name,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
          failedCount += 1;
        }
      }

      return createNextSuccessResponse({
        started: true,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        total_sources: total,
        ok_count: okCount,
        failed_count: failedCount,
        results,
      });
    }

    void (async () => {
      const results = [];
      for (const source of sources) {
        try {
          const result = await SyncOrchestrator.syncDataSource(source.id, syncOptions);
          results.push({ source_id: source.id, name: source.name, ok: true, result });
        } catch (error) {
          results.push({
            source_id: source.id,
            name: source.name,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      console.log('同步全部数据源完成', { total, startedAt, finishedAt: new Date().toISOString(), results });
    })().catch((error) => {
      console.error('同步全部数据源异步任务失败:', error);
    });

    return createNextSuccessResponse({
      started: true,
      total,
      started_at: startedAt,
      message: '已开始同步，请稍后刷新查看结果',
    });
  } catch (error) {
    console.error('同步全部数据源失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('SYNC_ALL_SOURCES_ERROR', '同步全部数据源失败', 500);
  }
}

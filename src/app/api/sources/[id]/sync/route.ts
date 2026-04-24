import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { SyncOrchestrator } from '@/lib/services/sync-orchestrator';
import { z } from 'zod';

const SyncOptionsSchema = z.object({
  max_items: z.number().int().min(1).max(500).optional(),
  similarity_check: z.boolean().optional(),
  incremental: z.boolean().optional(),
  auto_preprocess: z.boolean().optional(),
});

// POST /api/sources/:id/sync - 同步单个数据源到 inbox_items
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const sourceId = Number(id);
    if (!Number.isFinite(sourceId)) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的 id', 400);
    }

    const body = await request.json().catch(() => ({}));
    const options = SyncOptionsSchema.parse(body);

    const result = await SyncOrchestrator.syncDataSource(sourceId, options);
    return createNextSuccessResponse(result);
  } catch (error) {
    console.error('同步数据源失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('SYNC_SOURCE_ERROR', '同步数据源失败', 500);
  }
}

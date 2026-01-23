import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { RssSourceUpdateSchema } from '@/lib/validations/rss';
import { deleteRssSource, updateRssSource } from '@/lib/rss/source-service';

type Params = { id: string };

// PUT /api/rss/sources/:id - 更新 RSS 源
export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const sourceId = Number(id);
    if (!Number.isFinite(sourceId)) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的 RSS 源 ID', 400);
    }

    const body = await request.json();
    const validated = RssSourceUpdateSchema.parse(body);
    const updated = await updateRssSource(sourceId, validated);
    return createNextSuccessResponse(updated);
  } catch (error) {
    console.error('更新 RSS 源失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('UPDATE_RSS_SOURCE_ERROR', '更新 RSS 源失败', 500);
  }
}

// DELETE /api/rss/sources/:id - 删除 RSS 源
export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const sourceId = Number(id);
    if (!Number.isFinite(sourceId)) {
      return createNextErrorResponse('VALIDATION_ERROR', '无效的 RSS 源 ID', 400);
    }

    const deleted = await deleteRssSource(sourceId);
    return createNextSuccessResponse(deleted);
  } catch (error) {
    console.error('删除 RSS 源失败:', error);
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('DELETE_RSS_SOURCE_ERROR', '删除 RSS 源失败', 500);
  }
}


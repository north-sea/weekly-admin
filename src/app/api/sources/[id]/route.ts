import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { DataSourceService } from '@/lib/services/data-source';
import { DataSourceUpdateSchema } from '@/lib/validations/data-source';

// GET /api/sources/:id - 数据源详情
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const source = await DataSourceService.getDataSourceById(sourceId);
    if (!source) return createNextErrorResponse('NOT_FOUND', '数据源不存在', 404);

    return createNextSuccessResponse(source);
  } catch (error) {
    console.error('获取数据源详情失败:', error);
    return createNextErrorResponse('GET_SOURCE_ERROR', '获取数据源详情失败', 500);
  }
}

// PATCH /api/sources/:id - 更新数据源
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();
    const validated = DataSourceUpdateSchema.parse(body);
    const updated = await DataSourceService.updateDataSource(sourceId, validated);
    return createNextSuccessResponse(updated);
  } catch (error) {
    console.error('更新数据源失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('UPDATE_SOURCE_ERROR', '更新数据源失败', 500);
  }
}

// DELETE /api/sources/:id - 删除数据源
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    await DataSourceService.deleteDataSource(sourceId);
    return createNextSuccessResponse({ deleted: true });
  } catch (error) {
    console.error('删除数据源失败:', error);
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('DELETE_SOURCE_ERROR', '删除数据源失败', 500);
  }
}


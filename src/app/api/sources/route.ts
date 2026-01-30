import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { DataSourceSchema } from '@/lib/validations/data-source';
import { DataSourceService } from '@/lib/services/data-source';

// GET /api/sources - 数据源列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const enabledRaw = searchParams.get('enabled');
    const enabled =
      enabledRaw === null ? undefined : enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : undefined;

    const sources = await DataSourceService.listDataSources({
      type: type as any,
      enabled,
    });
    return createNextSuccessResponse(sources);
  } catch (error) {
    console.error('获取数据源列表失败:', error);
    return createNextErrorResponse('GET_SOURCES_ERROR', '获取数据源列表失败', 500);
  }
}

// POST /api/sources - 创建数据源
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = DataSourceSchema.parse(body);
    const created = await DataSourceService.createDataSource(validated);
    return createNextSuccessResponse(created, 201);
  } catch (error) {
    console.error('创建数据源失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('CREATE_SOURCE_ERROR', '创建数据源失败', 500);
  }
}


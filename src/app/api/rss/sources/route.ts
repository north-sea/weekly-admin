import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { RssSourceSchema } from '@/lib/validations/rss';
import { createRssSource, listRssSources } from '@/lib/rss/source-service';

// GET /api/rss/sources - RSS 源列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const sources = await listRssSources();
    return createNextSuccessResponse(sources);
  } catch (error) {
    console.error('获取 RSS 源列表失败:', error);
    return createNextErrorResponse('GET_RSS_SOURCES_ERROR', '获取 RSS 源列表失败', 500);
  }
}

// POST /api/rss/sources - 创建 RSS 源
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const body = await request.json();
    const validated = RssSourceSchema.parse(body);
    const created = await createRssSource(validated);
    return createNextSuccessResponse(created, 201);
  } catch (error) {
    console.error('创建 RSS 源失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
    }
    if (error instanceof Error) {
      return createNextErrorResponse('BUSINESS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('CREATE_RSS_SOURCE_ERROR', '创建 RSS 源失败', 500);
  }
}


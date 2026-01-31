import { NextRequest } from 'next/server';
import { TagService } from '@/lib/services/tag';
import { TagAliasSchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';
import { createNextSuccessResponse, createNextErrorResponse } from '@/lib/utils/serialization';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tags/[id]/aliases - 获取标签别名
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签ID', 400);
    }

    const tag = await TagService.getTagById(tagId);

    if (!tag) {
      return createNextErrorResponse('NOT_FOUND', '标签不存在', 404);
    }

    return createNextSuccessResponse({ aliases: tag.aliases || [] });
  } catch (error) {
    console.error('获取标签别名失败:', error);
    return createNextErrorResponse('GET_ALIASES_FAILED', '获取标签别名失败', 500);
  }
}

// PUT /api/tags/[id]/aliases - 更新标签别名
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签ID', 400);
    }

    const body = await request.json();
    const validatedData = TagAliasSchema.parse(body);

    const tag = await TagService.updateTagAliases(tagId, validatedData.aliases);

    return createNextSuccessResponse(tag);
  } catch (error) {
    console.error('更新标签别名失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return createNextErrorResponse('VALIDATION_ERROR', '数据验证失败', 400, error.message);
      }
      return createNextErrorResponse('UPDATE_ALIASES_ERROR', error.message, 400);
    }
    return createNextErrorResponse('UPDATE_ALIASES_FAILED', '更新标签别名失败', 500);
  }
}

// POST /api/tags/[id]/aliases - 添加单个别名
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签ID', 400);
    }

    const body = await request.json();
    const { alias } = body;

    if (!alias || typeof alias !== 'string' || alias.trim().length === 0) {
      return createNextErrorResponse('VALIDATION_ERROR', '别名不能为空', 400);
    }

    const tag = await TagService.getTagById(tagId);
    if (!tag) {
      return createNextErrorResponse('NOT_FOUND', '标签不存在', 404);
    }

    const currentAliases = tag.aliases || [];
    if (currentAliases.includes(alias.trim())) {
      return createNextErrorResponse('DUPLICATE_ALIAS', '别名已存在', 400);
    }

    const newAliases = [...currentAliases, alias.trim()];
    const updatedTag = await TagService.updateTagAliases(tagId, newAliases);

    return createNextSuccessResponse(updatedTag, 201);
  } catch (error) {
    console.error('添加标签别名失败:', error);
    if (error instanceof Error) {
      return createNextErrorResponse('ADD_ALIAS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('ADD_ALIAS_FAILED', '添加标签别名失败', 500);
  }
}

// DELETE /api/tags/[id]/aliases - 删除单个别名
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const tagId = parseInt(id, 10);

    if (isNaN(tagId)) {
      return createNextErrorResponse('INVALID_ID', '无效的标签ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const alias = searchParams.get('alias');

    if (!alias) {
      return createNextErrorResponse('VALIDATION_ERROR', '请指定要删除的别名', 400);
    }

    const tag = await TagService.getTagById(tagId);
    if (!tag) {
      return createNextErrorResponse('NOT_FOUND', '标签不存在', 404);
    }

    const currentAliases = tag.aliases || [];
    const newAliases = currentAliases.filter((a) => a !== alias);

    if (newAliases.length === currentAliases.length) {
      return createNextErrorResponse('ALIAS_NOT_FOUND', '别名不存在', 404);
    }

    const updatedTag = await TagService.updateTagAliases(tagId, newAliases);

    return createNextSuccessResponse(updatedTag);
  } catch (error) {
    console.error('删除标签别名失败:', error);
    if (error instanceof Error) {
      return createNextErrorResponse('DELETE_ALIAS_ERROR', error.message, 400);
    }
    return createNextErrorResponse('DELETE_ALIAS_FAILED', '删除标签别名失败', 500);
  }
}

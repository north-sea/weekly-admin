import { NextRequest, NextResponse } from 'next/server';
import { TagService } from '@/lib/services/tag';
import { TagSchema, TagQuerySchema } from '@/lib/validations/tag';
import { authenticateRequest } from '@/lib/auth';

// GET /api/tags - 获取标签列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = TagQuerySchema.parse(queryParams);
    const tags = await TagService.getTagList(validatedQuery);
    
    return NextResponse.json(tags);
  } catch (error) {
    console.error('获取标签列表失败:', error);
    return NextResponse.json(
      { error: '获取标签列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/tags - 创建标签
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = TagSchema.parse(body);
    
    const tag = await TagService.createTag(validatedData);
    
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('创建标签失败:', error);
    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: '数据验证失败', details: error.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '创建标签失败' },
      { status: 500 }
    );
  }
}
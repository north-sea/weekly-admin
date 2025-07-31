import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content';
import { ContentSchema, ContentQuerySchema } from '@/lib/validations/content';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/content - 获取内容列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = ContentQuerySchema.parse(queryParams);
    const result = await ContentService.getContentList(validatedQuery);
    
    // 处理 BigInt 序列化问题
    const serializedResult = prepareApiResponse(result);
    return NextResponse.json(serializedResult);
  } catch (error) {
    console.error('获取内容列表失败:', error);
    return NextResponse.json(
      { error: '获取内容列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/content - 创建内容
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = ContentSchema.parse(body);
    
    const content = await ContentService.createContent(validatedData, authResult.user.id, request);
    
    // 处理 BigInt 序列化问题
    const serializedContent = prepareApiResponse(content);
    return NextResponse.json(serializedContent, { status: 201 });
  } catch (error) {
    console.error('创建内容失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '创建内容失败' },
      { status: 500 }
    );
  }
}
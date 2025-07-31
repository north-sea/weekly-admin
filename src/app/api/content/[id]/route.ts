import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content';
import { ContentUpdateSchema } from '@/lib/validations/content';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/content/[id] - 获取单个内容
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的内容ID' }, { status: 400 });
    }

    const content = await ContentService.getContentById(id);
    if (!content) {
      return NextResponse.json({ error: '内容不存在' }, { status: 404 });
    }

    // 处理 BigInt 序列化问题
    const serializedContent = prepareApiResponse(content);
    return NextResponse.json({ success: true, data: serializedContent });
  } catch (error) {
    console.error('获取内容失败:', error);
    return NextResponse.json(
      { error: '获取内容失败' },
      { status: 500 }
    );
  }
}

// PUT /api/content/[id] - 更新内容
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的内容ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = ContentUpdateSchema.parse({ ...body, id });
    
    const content = await ContentService.updateContent(validatedData, authResult.user.id, request);
    
    // 处理 BigInt 序列化问题
    const serializedContent = prepareApiResponse(content);
    return NextResponse.json({ success: true, data: serializedContent });
  } catch (error) {
    console.error('更新内容失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '更新内容失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/content/[id] - 删除内容
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的内容ID' }, { status: 400 });
    }

    await ContentService.deleteContent(id, authResult.user.id, request);
    
    return NextResponse.json({ message: '内容删除成功' });
  } catch (error) {
    console.error('删除内容失败:', error);
    return NextResponse.json(
      { error: '删除内容失败' },
      { status: 500 }
    );
  }
}
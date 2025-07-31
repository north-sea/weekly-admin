import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/content';
import { BatchOperationSchema } from '@/lib/validations/content';
import { authenticateRequest } from '@/lib/auth';

// POST /api/content/batch - 批量操作内容
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = BatchOperationSchema.parse(body);
    
    await ContentService.batchOperation(validatedData, authResult.user.id, request);
    
    return NextResponse.json({ message: '批量操作执行成功' });
  } catch (error) {
    console.error('批量操作失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '批量操作失败' },
      { status: 500 }
    );
  }
}
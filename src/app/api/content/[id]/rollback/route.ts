import { NextRequest, NextResponse } from 'next/server';
import { VersionService } from '@/lib/services/version';
import { authenticateRequest } from '@/lib/auth';
import { OperationLogger } from '@/lib/middleware/operation-logger';
import { z } from 'zod';

const RollbackSchema = z.object({
  versionNumber: z.number().int().positive('版本号必须是正整数')
});

// POST /api/content/[id]/rollback - 回滚到指定版本
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const contentId = parseInt(idParam);
    if (isNaN(contentId)) {
      return NextResponse.json({ error: '无效的内容ID' }, { status: 400 });
    }

    const body = await request.json();
    const { versionNumber } = RollbackSchema.parse(body);

    await VersionService.rollbackToVersion(
      BigInt(contentId),
      versionNumber,
      authResult.user.id
    );
    
    // 记录回滚操作日志
    try {
      await OperationLogger.logContentOperation(
        authResult.user.id,
        'UPDATE',
        contentId,
        {
          title: `回滚到版本 ${versionNumber}`,
          changes: { rollback: { to: versionNumber } }
        },
        request
      );
    } catch (error) {
      console.error('Failed to log rollback operation:', error);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `成功回滚到版本 ${versionNumber}` 
    });
  } catch (error) {
    console.error('版本回滚失败:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', details: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: '版本回滚失败' },
      { status: 500 }
    );
  }
}
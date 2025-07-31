import { NextRequest, NextResponse } from 'next/server';
import { VersionService } from '@/lib/services/version';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/content/[id]/versions - 获取内容版本历史
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
    const contentId = parseInt(idParam);
    if (isNaN(contentId)) {
      return NextResponse.json({ error: '无效的内容ID' }, { status: 400 });
    }

    const versions = await VersionService.getVersionHistory(BigInt(contentId));
    
    // 处理 BigInt 序列化问题
    const serializedVersions = prepareApiResponse(versions);
    return NextResponse.json({ success: true, data: serializedVersions });
  } catch (error) {
    console.error('获取版本历史失败:', error);
    return NextResponse.json(
      { error: '获取版本历史失败' },
      { status: 500 }
    );
  }
}
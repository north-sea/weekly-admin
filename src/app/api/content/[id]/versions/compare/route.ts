import { NextRequest, NextResponse } from 'next/server';
import { VersionService } from '@/lib/services/version';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/content/[id]/versions/compare?old=1&new=2 - 比较两个版本
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

    const { searchParams } = new URL(request.url);
    const oldVersionParam = searchParams.get('old');
    const newVersionParam = searchParams.get('new');
    
    if (!oldVersionParam || !newVersionParam) {
      return NextResponse.json({ error: '缺少版本参数' }, { status: 400 });
    }
    
    const oldVersion = parseInt(oldVersionParam);
    const newVersion = parseInt(newVersionParam);
    
    if (isNaN(oldVersion) || isNaN(newVersion)) {
      return NextResponse.json({ error: '无效的版本号' }, { status: 400 });
    }

    const comparison = await VersionService.compareVersions(
      BigInt(contentId),
      oldVersion,
      newVersion
    );
    
    if (!comparison) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }
    
    // 处理 BigInt 序列化问题
    const serializedComparison = prepareApiResponse(comparison);
    return NextResponse.json({ success: true, data: serializedComparison });
  } catch (error) {
    console.error('版本比较失败:', error);
    return NextResponse.json(
      { error: '版本比较失败' },
      { status: 500 }
    );
  }
}
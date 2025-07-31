import { NextRequest, NextResponse } from 'next/server';
import { VersionService } from '@/lib/services/version';
import { authenticateRequest } from '@/lib/auth';
import { prepareApiResponse } from '@/lib/utils/serialization';

// GET /api/content/[id]/versions/[versionNumber] - 获取特定版本
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionNumber: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam, versionNumber: versionParam } = await params;
    const contentId = parseInt(idParam);
    const versionNumber = parseInt(versionParam);
    
    if (isNaN(contentId) || isNaN(versionNumber)) {
      return NextResponse.json({ error: '无效的参数' }, { status: 400 });
    }

    const version = await VersionService.getVersion(BigInt(contentId), versionNumber);
    
    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }
    
    // 处理 BigInt 序列化问题
    const serializedVersion = prepareApiResponse(version);
    return NextResponse.json({ success: true, data: serializedVersion });
  } catch (error) {
    console.error('获取版本失败:', error);
    return NextResponse.json(
      { error: '获取版本失败' },
      { status: 500 }
    );
  }
}
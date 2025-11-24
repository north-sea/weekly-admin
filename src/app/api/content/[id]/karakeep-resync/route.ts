import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import { ContentService } from '@/lib/services/content';
import { createResyncJob, progressResyncJob } from '@/lib/services/karakeep-resync';

const MIN_ATTEMPTS = 6;
const MAX_ATTEMPTS = 30;

function normalizeAttempts(raw?: number): number {
  if (!raw || Number.isNaN(raw)) return 12;
  return Math.min(Math.max(raw, MIN_ATTEMPTS), MAX_ATTEMPTS);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const contentId = parseInt(id, 10);
    if (Number.isNaN(contentId)) {
      return createNextErrorResponse('INVALID_ID', '无效的内容ID', 400);
    }

    const body = await request.json().catch(() => ({}));
    const refreshScreenshot = Boolean(body.refreshScreenshot);
    const maxAttempts = normalizeAttempts(body.maxAttempts);

    const content = await ContentService.getContentById(contentId);
    if (!content) {
      return createNextErrorResponse('NOT_FOUND', '内容不存在', 404);
    }

    const karakeepIdAttr = content.attributes?.find(attr => attr.attribute_name === 'karakeep_id');
    const karakeepId = karakeepIdAttr?.attribute_value;
    if (!karakeepId) {
      return createNextErrorResponse('NO_KARAKEEP_ID', '内容未绑定 Karakeep ID', 400);
    }

    if (!content.source_url) {
      return createNextErrorResponse('NO_SOURCE_URL', '缺少 source_url，无法通知 Karakeep', 400);
    }

    const job = await createResyncJob({
      contentId,
      karakeepId,
      sourceUrl: content.source_url,
      refreshScreenshot,
      screenshotLocked: content.screenshot_api === 'manual',
      maxAttempts,
    });

    return createNextSuccessResponse(job);
  } catch (error: any) {
    console.error('启动 Karakeep 重跑失败:', error);
    return createNextErrorResponse('RESYNC_START_FAILED', '启动 Karakeep 重跑失败', 500, error?.message);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return createNextErrorResponse('UNAUTHORIZED', '未授权访问', 401);
    }

    const { id } = await params;
    const contentId = parseInt(id, 10);
    if (Number.isNaN(contentId)) {
      return createNextErrorResponse('INVALID_ID', '无效的内容ID', 400);
    }

    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    if (!jobId) {
      return createNextErrorResponse('MISSING_JOB_ID', '缺少 jobId', 400);
    }

    const job = await progressResyncJob(jobId);
    if (!job) {
      return createNextErrorResponse('JOB_NOT_FOUND', '未找到对应的任务', 404);
    }

    if (job.contentId !== contentId) {
      return createNextErrorResponse('JOB_MISMATCH', '任务与内容不匹配', 400);
    }

    return createNextSuccessResponse(job);
  } catch (error: any) {
    console.error('查询 Karakeep 重跑状态失败:', error);
    return createNextErrorResponse('RESYNC_STATUS_FAILED', '查询 Karakeep 重跑状态失败', 500, error?.message);
  }
}

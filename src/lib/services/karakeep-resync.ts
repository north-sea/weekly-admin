import { randomUUID } from 'crypto';
import { getKarakeepApi } from '@/lib/services/karakeep-api';
import { prisma } from '@/lib/db';
import { KarakeepBookmark } from './karakeep-api';

type ResyncPhase = 'updating' | 'waiting' | 'applying' | 'success' | 'failed';

export interface KarakeepResyncJob {
  jobId: string;
  contentId: number;
  karakeepId: string;
  phase: ResyncPhase;
  attempt: number;
  maxAttempts: number;
  refreshScreenshot: boolean;
  screenshotLocked: boolean;
  message?: string;
  summarizationStatus?: string;
  taggingStatus?: string;
  appliedSummary?: string | null;
  appliedImage?: string | null;
  updatedAt: string;
}

interface CreateJobParams {
  contentId: number;
  karakeepId: string;
  sourceUrl: string;
  refreshScreenshot: boolean;
  screenshotLocked: boolean;
  maxAttempts?: number;
}

const jobs = new Map<string, KarakeepResyncJob>();

const nowIso = () => new Date().toISOString();

/**
 * 创建并初始化一次 Karakeep 重跑任务
 */
export async function createResyncJob(params: CreateJobParams): Promise<KarakeepResyncJob> {
  const {
    contentId,
    karakeepId,
    sourceUrl,
    refreshScreenshot,
    screenshotLocked,
    maxAttempts = 12,
  } = params;

  const jobId = randomUUID();
  const base: KarakeepResyncJob = {
    jobId,
    contentId,
    karakeepId,
    phase: 'updating',
    attempt: 0,
    maxAttempts,
    refreshScreenshot,
    screenshotLocked,
    updatedAt: nowIso(),
  };
  jobs.set(jobId, base);

  try {
    // 通知 Karakeep 更新 URL，触发重新 summary/截图
    const api = getKarakeepApi('重跑任务');
    if (!api) {
      const job = jobs.get(jobId)!;
      job.phase = 'failed';
      job.message = 'Karakeep 未配置，已跳过重跑任务';
      job.updatedAt = nowIso();
      jobs.set(jobId, job);
      return job;
    }

    await api.updateBookmark(karakeepId, {
      url: sourceUrl,
      archived: false,
    });

    const job = jobs.get(jobId)!;
    job.phase = 'waiting';
    job.updatedAt = nowIso();
    jobs.set(jobId, job);
    return job;
  } catch (error: any) {
    const job = jobs.get(jobId)!;
    job.phase = 'failed';
    job.message = error?.message || '更新 Karakeep 失败';
    job.updatedAt = nowIso();
    jobs.set(jobId, job);
    return job;
  }
}

async function applyBookmarkToContent(job: KarakeepResyncJob, bookmark: KarakeepBookmark): Promise<KarakeepResyncJob> {
  const summary = bookmark.summary || bookmark.content?.description || null;
  const nextImage = job.refreshScreenshot && !job.screenshotLocked
    ? (bookmark.content?.imageUrl || bookmark.content?.screenshotAssetId || null)
    : undefined;

  await prisma.contents.update({
    where: { id: BigInt(job.contentId) },
    data: {
      summary,
      ...(nextImage !== undefined ? { image_url: nextImage, screenshot_api: 'karakeep' } : {}),
    },
  });

  // 记录同步时间，便于前端展示
  const syncValue = nowIso();
  await prisma.content_attributes.upsert({
    where: {
      content_id_attribute_name: {
        content_id: BigInt(job.contentId),
        attribute_name: 'karakeep_synced_at',
      },
    },
    create: {
      content_id: BigInt(job.contentId),
      attribute_name: 'karakeep_synced_at',
      attribute_value: syncValue,
      attribute_type: 'date',
    },
    update: {
      attribute_value: syncValue,
      attribute_type: 'date',
    },
  });

  // 确保 karakeep_id 属性存在（兼容旧数据）
  await prisma.content_attributes.upsert({
    where: {
      content_id_attribute_name: {
        content_id: BigInt(job.contentId),
        attribute_name: 'karakeep_id',
      },
    },
    create: {
      content_id: BigInt(job.contentId),
      attribute_name: 'karakeep_id',
      attribute_value: job.karakeepId,
      attribute_type: 'string',
    },
    update: {
      attribute_value: job.karakeepId,
      attribute_type: 'string',
    },
  });

  const updated: KarakeepResyncJob = {
    ...job,
    phase: 'success',
    appliedSummary: summary ?? null,
    appliedImage: nextImage ?? null,
    updatedAt: nowIso(),
  };
  jobs.set(job.jobId, updated);
  return updated;
}

/**
 * 推进任务状态（轮询）
 */
export async function progressResyncJob(jobId: string): Promise<KarakeepResyncJob | null> {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (job.phase === 'success' || job.phase === 'failed') {
    return job;
  }

  if (job.phase === 'updating') {
    // 尚未完成初始化，直接返回
    return job;
  }

  if (job.attempt >= job.maxAttempts) {
    const failed: KarakeepResyncJob = {
      ...job,
      phase: 'failed',
      message: '轮询超时，Karakeep 仍未完成',
      updatedAt: nowIso(),
    };
    jobs.set(jobId, failed);
    return failed;
  }

  try {
    const api = getKarakeepApi('重跑任务轮询');
    if (!api) {
      const failed: KarakeepResyncJob = {
        ...job,
        phase: 'failed',
        message: 'Karakeep 未配置，无法轮询',
        updatedAt: nowIso(),
      };
      jobs.set(jobId, failed);
      return failed;
    }

    const nextAttempt = job.attempt + 1;
    const bookmark = await api.getBookmark(job.karakeepId);

    const nextJob: KarakeepResyncJob = {
      ...job,
      attempt: nextAttempt,
      summarizationStatus: bookmark.summarizationStatus,
      taggingStatus: bookmark.taggingStatus,
      updatedAt: nowIso(),
    };

    const summarizationDone = bookmark.summarizationStatus === 'success';
    const taggingDone = !bookmark.taggingStatus || bookmark.taggingStatus === 'success';

    if (summarizationDone && taggingDone) {
      nextJob.phase = 'applying';
      jobs.set(jobId, nextJob);
      const applied = await applyBookmarkToContent(nextJob, bookmark);
      return applied;
    }

    nextJob.phase = 'waiting';
    jobs.set(jobId, nextJob);
    return nextJob;
  } catch (error: any) {
    const failed: KarakeepResyncJob = {
      ...job,
      phase: 'failed',
      message: error?.message || '轮询失败',
      updatedAt: nowIso(),
    };
    jobs.set(jobId, failed);
    return failed;
  }
}

import { prisma } from '@/lib/db';

export type ImageStatus = 'ok' | 'needs_crop' | 'missing';

export type ImageCheckResult = {
  status: ImageStatus;
  url: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number;
  reason?: string;
};

// 目标比例 16:9
const TARGET_RATIO = 16 / 9;
const RATIO_TOLERANCE = 0.15; // 允许 15% 的误差

/**
 * 检测图片 URL 是否有效
 */
async function checkImageUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'WeeklyAdmin/1.0',
      },
    });

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      return { valid: false, error: `非图片类型: ${contentType}` };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, error: message };
  }
}

/**
 * 获取图片尺寸（通过下载图片头部信息）
 * 注意：这是一个简化实现，实际生产环境可能需要使用 sharp 等库
 */
async function getImageDimensions(
  url: string
): Promise<{ width: number; height: number } | null> {
  try {
    // 尝试从 URL 参数中获取尺寸（某些 CDN 会在 URL 中包含尺寸信息）
    const urlObj = new URL(url);
    const width = urlObj.searchParams.get('w') || urlObj.searchParams.get('width');
    const height = urlObj.searchParams.get('h') || urlObj.searchParams.get('height');

    if (width && height) {
      return { width: parseInt(width, 10), height: parseInt(height, 10) };
    }

    // 对于无法获取尺寸的情况，返回 null
    // 实际生产环境应该下载图片并使用 sharp 等库获取尺寸
    return null;
  } catch {
    return null;
  }
}

/**
 * 判断图片是否符合目标比例（16:9）
 */
function isAcceptableRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;

  const ratio = width / height;
  const diff = Math.abs(ratio - TARGET_RATIO) / TARGET_RATIO;

  return diff <= RATIO_TOLERANCE;
}

/**
 * 检测单个图片的状态
 */
export async function checkImageStatus(imageUrl: string | null): Promise<ImageCheckResult> {
  // 无图片 URL
  if (!imageUrl || !imageUrl.trim()) {
    return {
      status: 'missing',
      url: null,
      reason: '无图片 URL',
    };
  }

  // 检测 URL 是否有效
  const urlCheck = await checkImageUrl(imageUrl);
  if (!urlCheck.valid) {
    return {
      status: 'missing',
      url: imageUrl,
      reason: urlCheck.error,
    };
  }

  // 尝试获取图片尺寸
  const dimensions = await getImageDimensions(imageUrl);

  if (!dimensions) {
    // 无法获取尺寸，假设需要裁剪
    return {
      status: 'needs_crop',
      url: imageUrl,
      reason: '无法获取图片尺寸，建议检查',
    };
  }

  const { width, height } = dimensions;
  const aspectRatio = width / height;

  // 检查比例是否符合 16:9
  if (isAcceptableRatio(width, height)) {
    return {
      status: 'ok',
      url: imageUrl,
      width,
      height,
      aspectRatio,
    };
  }

  return {
    status: 'needs_crop',
    url: imageUrl,
    width,
    height,
    aspectRatio,
    reason: `比例 ${aspectRatio.toFixed(2)} 不符合 16:9`,
  };
}

/**
 * 检测并更新 inbox item 的图片状态
 */
export async function detectInboxItemImageStatus(inboxId: bigint): Promise<ImageCheckResult> {
  const item = await prisma.inbox_items.findUnique({
    where: { id: inboxId },
    select: { id: true, image_url: true },
  });

  if (!item) {
    throw new Error('收件箱条目不存在');
  }

  const result = await checkImageStatus(item.image_url);

  // 更新数据库
  await prisma.inbox_items.update({
    where: { id: inboxId },
    data: { image_status: result.status },
  });

  return result;
}

export type BatchImageCheckResult = {
  processed: number;
  ok: number;
  needs_crop: number;
  missing: number;
  errors: string[];
};

/**
 * 批量检测图片状态
 */
export async function batchDetectImageStatus(
  limit: number = 100
): Promise<BatchImageCheckResult> {
  // 查找未检测过图片状态的 pending 条目
  const items = await prisma.inbox_items.findMany({
    where: {
      status: 'pending',
      image_status: null,
    },
    select: { id: true, title: true, image_url: true },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  const result: BatchImageCheckResult = {
    processed: 0,
    ok: 0,
    needs_crop: 0,
    missing: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      const checkResult = await detectInboxItemImageStatus(item.id);
      result.processed += 1;

      if (checkResult.status === 'ok') result.ok += 1;
      else if (checkResult.status === 'needs_crop') result.needs_crop += 1;
      else result.missing += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`[${item.id}] ${item.title}: ${message}`);
    }
  }

  return result;
}

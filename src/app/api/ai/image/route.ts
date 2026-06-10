import { createNextErrorResponse } from '@/lib/utils/serialization';

export async function POST() {
  return createNextErrorResponse(
    'AI_IMAGE_RETIRED',
    'AI 图片生成功能已退役',
    410
  );
}

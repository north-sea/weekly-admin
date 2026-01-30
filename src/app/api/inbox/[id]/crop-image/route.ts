import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import { prisma } from '@/lib/db';

const CropParamsSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const inboxId = BigInt(id);

    const body = await request.json();
    const parsed = CropParamsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: '无效的裁剪参数', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { x, y, width, height } = parsed.data;

    // 获取 inbox item
    const item = await prisma.inbox_items.findUnique({
      where: { id: inboxId },
      select: { id: true, image_url: true },
    });

    if (!item) {
      return NextResponse.json({ error: '收件箱条目不存在' }, { status: 404 });
    }

    if (!item.image_url) {
      return NextResponse.json({ error: '该条目没有图片' }, { status: 400 });
    }

    // 下载原图
    const imageResponse = await fetch(item.image_url, {
      headers: { 'User-Agent': 'WeeklyAdmin/1.0' },
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `无法下载图片: ${imageResponse.status}` },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // 使用 sharp 裁剪图片
    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left: x, top: y, width, height })
      .resize(800, 450, { fit: 'fill' }) // 统一输出尺寸
      .jpeg({ quality: 85 })
      .toBuffer();

    // 转为 base64 data URL（简化实现，生产环境应上传到 OSS）
    const base64 = croppedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    // 更新数据库
    await prisma.inbox_items.update({
      where: { id: inboxId },
      data: {
        image_url: dataUrl,
        image_status: 'ok',
      },
    });

    return NextResponse.json({
      success: true,
      message: '图片裁剪成功',
      image_url: dataUrl,
    });
  } catch (error) {
    console.error('图片裁剪失败:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `裁剪失败: ${message}` }, { status: 500 });
  }
}

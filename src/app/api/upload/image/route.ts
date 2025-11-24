import { NextRequest, NextResponse } from 'next/server';

const VALID_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const uploadUrl = process.env.IMAGE_UPLOAD_URL;
    const token = process.env.IMAGE_UPLOAD_TOKEN;

    if (!uploadUrl || !token) {
      return NextResponse.json(
        { success: false, message: '图片上传服务未配置（缺少 IMAGE_UPLOAD_URL 或 IMAGE_UPLOAD_TOKEN）' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: '未找到上传的文件' },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, message: '不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式的图片' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: '图片大小不能超过 5MB' },
        { status: 400 }
      );
    }

    const forwardForm = new FormData();
    forwardForm.append('file', file, file.name);

    const upstream = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: forwardForm,
    });

    let data: any = null;
    try {
      data = await upstream.json();
    } catch (error) {
      // ignore parse error, will handle below
    }

    if (!upstream.ok || !data?.success) {
      const message =
        data?.message ||
        `上传失败，状态码 ${upstream.status}`;
      return NextResponse.json(
        { success: false, message },
        { status: upstream.status || 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

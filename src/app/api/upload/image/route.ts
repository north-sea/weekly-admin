import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, getCurrentUser } from '@/lib/auth';
import { normalizeImageUploadResponse } from '@/lib/services/image-upload-response';

const VALID_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const runtime = 'nodejs';

function getFileExtension(file: File): string {
  const ext = path.extname(file.name);
  if (ext) {
    return ext.toLowerCase();
  }

  switch (file.type) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/gif':
      return '.gif';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

function getDefaultFilename(type: string): string {
  switch (type) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'upload.jpg';
    case 'image/png':
      return 'upload.png';
    case 'image/gif':
      return 'upload.gif';
    case 'image/webp':
      return 'upload.webp';
    default:
      return 'upload-image';
  }
}

async function getRequestFile(req: NextRequest): Promise<File | null> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json();
    const filename =
      typeof body?.filename === 'string' && body.filename.trim()
        ? body.filename
        : getDefaultFilename(typeof body?.type === 'string' ? body.type : '');
    const fileType = typeof body?.type === 'string' ? body.type : 'application/octet-stream';
    const contentBase64 = typeof body?.contentBase64 === 'string' ? body.contentBase64 : '';

    if (!contentBase64) {
      return null;
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    if (buffer.length === 0) {
      return null;
    }

    return new File([buffer], filename, { type: fileType });
  }

  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length === 0) {
      return null;
    }

    const filenameHeader = req.headers.get('x-file-name');
    const filename = filenameHeader
      ? decodeURIComponent(filenameHeader)
      : getDefaultFilename(contentType);

    return new File([buffer], filename, { type: contentType });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  return file instanceof File ? file : null;
}

async function saveFileLocally(file: File) {
  const month = new Date().toISOString().slice(0, 7);
  const relativeDir = path.join('uploads', month);
  const absoluteDir = path.join(process.cwd(), 'public', relativeDir);
  const filename = `${Date.now()}-${randomUUID()}${getFileExtension(file)}`;
  const absolutePath = path.join(absoluteDir, filename);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    success: true,
    data: {
      url: `/${relativeDir}/${filename}`.replace(/\\/g, '/'),
      filename,
      size: file.size,
      type: file.type,
    },
    message: '图床暂不可用，已切换到本地开发存储',
  };
}

function canUseLocalFallback() {
  return process.env.NODE_ENV !== 'production';
}

export async function POST(req: NextRequest) {
  try {
    const authToken = extractTokenFromHeader(req);
    if (!authToken) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!(await getCurrentUser(authToken))) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const uploadUrl = process.env.IMAGE_UPLOAD_URL;
    const token = process.env.IMAGE_UPLOAD_TOKEN;

    const file = await getRequestFile(req);
    if (!file) {
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

    if (!uploadUrl || !token) {
      if (canUseLocalFallback()) {
        return NextResponse.json(await saveFileLocally(file));
      }

      return NextResponse.json(
        { success: false, message: '图片上传服务未配置（缺少 IMAGE_UPLOAD_URL 或 IMAGE_UPLOAD_TOKEN）' },
        { status: 500 }
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

    const upstreamText = await upstream.text();
    let data: unknown = upstreamText;
    try {
      data = upstreamText ? JSON.parse(upstreamText) : null;
    } catch {
      data = upstreamText;
    }

    const normalized = normalizeImageUploadResponse({
      upstreamStatus: upstream.status,
      payload: data,
      fallback: {
        filename: file.name,
        size: file.size,
        type: file.type,
      },
    });

    if (!normalized.success) {
      if (canUseLocalFallback()) {
        return NextResponse.json(await saveFileLocally(file));
      }

      return NextResponse.json(
        { success: false, message: normalized.message },
        { status: normalized.statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: normalized.data,
      message: normalized.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

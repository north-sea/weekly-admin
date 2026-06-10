import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'IMAGE_UPLOAD_RETIRED',
        message: '图片上传功能已退役',
      },
    },
    { status: 410 }
  );
}

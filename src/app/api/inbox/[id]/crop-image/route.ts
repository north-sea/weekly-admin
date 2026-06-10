import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INBOX_IMAGE_CROP_RETIRED',
        message: 'Inbox 图片裁剪功能已退役',
      },
    },
    { status: 410 }
  );
}

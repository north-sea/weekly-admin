import { NextResponse } from 'next/server';

import { getAutomationOpenApiDocument } from '@/lib/automation/openapi';

export async function GET() {
  return NextResponse.json(getAutomationOpenApiDocument());
}

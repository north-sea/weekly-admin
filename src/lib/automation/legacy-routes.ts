import type { NextResponse } from 'next/server';

export function markLegacyAutomationResponse(response: NextResponse): NextResponse {
  response.headers.set('X-Automation-Execution', 'legacy-sync');
  response.headers.set('X-Automation-Run-Recorded', 'false');
  return response;
}

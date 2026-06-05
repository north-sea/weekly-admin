import { NextResponse } from 'next/server';
import { createNextErrorResponse, createNextSuccessResponse } from '@/lib/utils/serialization';
import type { AutomationCaller } from './auth';
import type { AutomationRunStatus } from './run';

export type AutomationResponseMeta = {
  runId?: string;
  status?: AutomationRunStatus;
  idempotentReplay?: boolean;
  caller?: {
    type: string;
    tokenPrefix: string;
  };
};

export function createAutomationSuccessResponse<T>(
  data: T,
  meta: AutomationResponseMeta = {},
  status = 200
): NextResponse {
  return createNextSuccessResponse(data, status, meta);
}

export function createAutomationErrorResponse(
  code: string,
  message: string,
  status = 500,
  details?: unknown,
  meta: AutomationResponseMeta = {}
): NextResponse {
  const response = createNextErrorResponse(code, message, status, details);
  const body = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };

  return NextResponse.json(body, { status: response.status });
}

export function getCallerMeta(caller: AutomationCaller): AutomationResponseMeta['caller'] {
  return {
    type: caller.callerType,
    tokenPrefix: caller.tokenPrefix,
  };
}

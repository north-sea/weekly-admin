import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AutomationAuthError, authenticateAutomationRequest, type AutomationScope } from './auth';
import {
  createAutomationErrorResponse,
  createAutomationSuccessResponse,
  getCallerMeta,
} from './contracts';
import {
  AutomationRunConflictError,
  createRequestDigest,
  withAutomationRun,
  type AutomationRunSuccess,
  type AutomationRunTarget,
} from './run';
import {
  JobSubmissionError,
  submitAutomationJob,
  type QueuedAutomationJob,
} from '@/lib/jobs/submit';
import { JobRetryError } from '@/lib/jobs/retry';
import type { AutomationJobName } from '@/lib/jobs/definitions';

export function getRequiredIdempotencyKey(request: NextRequest): string {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value) {
    throw new AutomationRunConflictError('IDEMPOTENCY_PAYLOAD_CONFLICT', 'Idempotency-Key header is required');
  }
  return value;
}

export function getReadOnlyIdempotencyKey(request: NextRequest): string {
  return `readonly:${createRequestDigest({ url: request.url })}`;
}

export class AutomationRouteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AutomationRouteError';
  }
}

export async function runAutomationRoute<T>(
  request: NextRequest,
  options: AutomationRunTarget & {
    scope: AutomationScope;
    workflow: string;
    step: string;
    idempotencyKey: string;
    requestPayload?: unknown;
    handler: () => Promise<AutomationRunSuccess<T>>;
  }
): Promise<NextResponse> {
  try {
    const caller = await authenticateAutomationRequest(request, options.scope);
    const run = await withAutomationRun(
      {
        caller,
        workflow: options.workflow,
        step: options.step,
        idempotencyKey: options.idempotencyKey,
        requestPayload: options.requestPayload,
        targetType: options.targetType,
        targetId: options.targetId,
      },
      options.handler
    );

    return createAutomationSuccessResponse(run.result, {
      runId: run.runId,
      status: run.status,
      idempotentReplay: run.idempotentReplay,
      caller: getCallerMeta(caller),
    });
  } catch (error) {
    return automationErrorToResponse(error);
  }
}

export async function runQueuedAutomationRoute(
  request: NextRequest,
  options: {
    scope: AutomationScope;
    jobName: AutomationJobName;
    idempotencyKey: string;
    requestPayload?: Record<string, unknown>;
  }
): Promise<NextResponse> {
  try {
    const caller = await authenticateAutomationRequest(request, options.scope);
    const job = await submitAutomationJob({
      caller,
      jobName: options.jobName,
      idempotencyKey: options.idempotencyKey,
      payload: options.requestPayload ?? {},
    });

    return createAutomationSuccessResponse<QueuedAutomationJob>(job, {
      runId: job.runId,
      status: job.status,
      idempotentReplay: job.idempotentReplay,
      caller: job.caller,
    }, job.idempotentReplay ? 200 : 202);
  } catch (error) {
    return automationErrorToResponse(error);
  }
}

export function automationErrorToResponse(error: unknown): NextResponse {
  if (error instanceof AutomationAuthError) {
    return createAutomationErrorResponse(error.code, error.message, error.status);
  }

  if (error instanceof AutomationRunConflictError) {
    return createAutomationErrorResponse(error.code, error.message, 409);
  }

  if (error instanceof AutomationRouteError) {
    return createAutomationErrorResponse(error.code, error.message, error.status, error.details);
  }

  if (error instanceof JobSubmissionError) {
    return createAutomationErrorResponse(error.code, error.message, error.status, error.details);
  }

  if (error instanceof JobRetryError) {
    return createAutomationErrorResponse(error.code, error.message, error.status, error.details);
  }

  if (error instanceof z.ZodError) {
    return createAutomationErrorResponse('VALIDATION_ERROR', '参数验证失败', 400, error.issues);
  }

  const message = error instanceof Error ? error.message : 'Automation request failed';
  return createAutomationErrorResponse('INTERNAL_ERROR', message, 500);
}

import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AutomationCaller } from './auth';

export type AutomationRunStatus =
  | 'running'
  | 'succeeded'
  | 'partial_success'
  | 'skipped'
  | 'empty'
  | 'failed';

export type AutomationRunTarget = {
  targetType?: string;
  targetId?: string | number | bigint;
};

export type AutomationRunInput = AutomationRunTarget & {
  caller: AutomationCaller;
  workflow: string;
  step: string;
  idempotencyKey: string;
  requestPayload?: unknown;
  operationLog?: {
    userId: number;
    operationType?: 'CREATE' | 'UPDATE' | 'DELETE';
    resourceType?: string;
  };
};

export type AutomationRunSuccess<T> = {
  status: Exclude<AutomationRunStatus, 'running' | 'failed'>;
  result: T;
  externalSideEffect?: boolean;
  externalRef?: string;
};

export type AutomationRunResult<T> = {
  runId: string;
  status: AutomationRunStatus;
  result?: T;
  idempotentReplay: boolean;
};

export class AutomationRunConflictError extends Error {
  constructor(
    public readonly code: 'IDEMPOTENCY_PAYLOAD_CONFLICT' | 'IDEMPOTENCY_RUN_IN_PROGRESS',
    message: string
  ) {
    super(message);
    this.name = 'AutomationRunConflictError';
  }
}

export function createRunId(): string {
  return `auto_${crypto.randomUUID()}`;
}

export function createRequestDigest(payload: unknown): string {
  const normalized = stableStringify(payload ?? {});
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function findExistingRun(input: AutomationRunInput, requestDigest: string) {
  const existing = await prisma.automation_runs.findUnique({
    where: {
      token_id_workflow_step_idempotency_key: {
        token_id: input.caller.tokenId,
        workflow: input.workflow,
        step: input.step,
        idempotency_key: input.idempotencyKey,
      },
    },
  });

  if (!existing) return null;

  if (existing.request_digest !== requestDigest) {
    throw new AutomationRunConflictError(
      'IDEMPOTENCY_PAYLOAD_CONFLICT',
      'Idempotency key was already used with a different payload'
    );
  }

  if (existing.status === 'running') {
    throw new AutomationRunConflictError('IDEMPOTENCY_RUN_IN_PROGRESS', 'Idempotent run is still in progress');
  }

  return existing;
}

export async function withAutomationRun<T>(
  input: AutomationRunInput,
  handler: () => Promise<AutomationRunSuccess<T>>
): Promise<AutomationRunResult<T>> {
  const requestDigest = createRequestDigest(input.requestPayload);
  const existing = await findExistingRun(input, requestDigest);

  if (existing) {
    return {
      runId: existing.id,
      status: existing.status as AutomationRunStatus,
      result: existing.result_summary as T,
      idempotentReplay: true,
    };
  }

  const runId = createRunId();
  await prisma.automation_runs.create({
    data: {
      id: runId,
      token_id: input.caller.tokenId,
      caller_type: input.caller.callerType,
      workflow: input.workflow,
      step: input.step,
      target_type: input.targetType,
      target_id: input.targetId === undefined ? undefined : String(input.targetId),
      idempotency_key: input.idempotencyKey,
      request_digest: requestDigest,
      status: 'running',
    },
  });

  try {
    const outcome = await handler();
    await prisma.automation_runs.update({
      where: { id: runId },
      data: {
        status: outcome.status,
        result_summary: safeJson(outcome.result),
        external_side_effect: outcome.externalSideEffect ?? false,
        external_ref: outcome.externalRef,
        finished_at: new Date(),
      },
    });
    await mirrorOperationLog(input, runId, outcome.status, outcome.result);

    return {
      runId,
      status: outcome.status,
      result: outcome.result,
      idempotentReplay: false,
    };
  } catch (error) {
    await prisma.automation_runs.update({
      where: { id: runId },
      data: {
        status: 'failed',
        error_code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        error_message: error instanceof Error ? error.message : String(error),
        finished_at: new Date(),
      },
    });
    throw error;
  }
}

async function mirrorOperationLog<T>(
  input: AutomationRunInput,
  runId: string,
  status: AutomationRunStatus,
  result: T
) {
  if (!input.operationLog) return;

  try {
    await prisma.operation_logs.create({
      data: {
        user_id: input.operationLog.userId,
        operation_type: input.operationLog.operationType ?? 'CREATE',
        resource_type: input.operationLog.resourceType ?? `automation_${input.workflow}`,
        resource_id: input.targetId === undefined ? runId : String(input.targetId),
        operation_details: JSON.stringify({
          runId,
          workflow: input.workflow,
          step: input.step,
          status,
          callerType: input.caller.callerType,
          tokenPrefix: input.caller.tokenPrefix,
          result,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error('[automation-run] Failed to mirror operation log:', error);
  }
}

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const operationLogCreateMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    automation_runs: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    operation_logs: {
      create: (...args: unknown[]) => operationLogCreateMock(...args),
    },
  },
}));

import {
  AutomationRunConflictError,
  completeAutomationRun,
  createOrReplayQueuedAutomationRun,
  createRequestDigest,
  failAutomationRun,
  markAutomationRunRunning,
  withAutomationRun,
} from './run';
import type { AutomationCaller } from './auth';

const caller: AutomationCaller = {
  tokenId: 1,
  name: 'n8n',
  callerType: 'n8n',
  tokenPrefix: 'wa_n8n',
  scopes: ['weekly:read', 'weekly:suggest'],
};

describe('automation run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue({});
    updateMock.mockResolvedValue({});
    operationLogCreateMock.mockResolvedValue({});
  });

  it('creates a stable digest independent of key order', () => {
    expect(createRequestDigest({ b: 2, a: 1 })).toBe(createRequestDigest({ a: 1, b: 2 }));
  });

  it('creates and completes a new run', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const result = await withAutomationRun(
      {
        caller,
        workflow: 'weekly',
        step: 'suggest',
        idempotencyKey: 'idem-1',
        requestPayload: { weeklyIssueId: 1 },
      },
      async () => ({
        status: 'succeeded',
        result: { status: 'created', count: 1 },
      })
    );

    expect(result).toMatchObject({
      status: 'succeeded',
      result: { status: 'created', count: 1 },
      idempotentReplay: false,
    });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token_id: 1,
        workflow: 'weekly',
        step: 'suggest',
        idempotency_key: 'idem-1',
        status: 'running',
      }),
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: result.runId },
      data: expect.objectContaining({
        status: 'succeeded',
        result_summary: { status: 'created', count: 1 },
        finished_at: expect.any(Date),
      }),
    });
  });

  it('replays a completed idempotent run', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'auto_existing',
      status: 'succeeded',
      request_digest: createRequestDigest({ weeklyIssueId: 1 }),
      result_summary: { status: 'created' },
    });

    const handler = vi.fn();
    await expect(
      withAutomationRun(
        {
          caller,
          workflow: 'weekly',
          step: 'suggest',
          idempotencyKey: 'idem-1',
          requestPayload: { weeklyIssueId: 1 },
        },
        handler
      )
    ).resolves.toEqual({
      runId: 'auto_existing',
      status: 'succeeded',
      result: { status: 'created' },
      idempotentReplay: true,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('creates a queued automation run for worker execution', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const result = await createOrReplayQueuedAutomationRun({
      caller,
      workflow: 'score',
      step: 'run',
      idempotencyKey: 'score-1',
      requestPayload: { limit: 50 },
    });

    expect(result).toMatchObject({
      status: 'queued',
      idempotentReplay: false,
    });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workflow: 'score',
        step: 'run',
        idempotency_key: 'score-1',
        request_digest: createRequestDigest({ limit: 50 }),
        status: 'queued',
      }),
    });
  });

  it('replays queued or running idempotent runs without re-enqueue evidence changes', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'auto_existing',
      status: 'queued',
      request_digest: createRequestDigest({ limit: 50 }),
      result_summary: null,
    });

    await expect(
      createOrReplayQueuedAutomationRun({
        caller,
        workflow: 'score',
        step: 'run',
        idempotencyKey: 'score-1',
        requestPayload: { limit: 50 },
      })
    ).resolves.toEqual({
      runId: 'auto_existing',
      status: 'queued',
      result: null,
      idempotentReplay: true,
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('updates queued runs to running and terminal states', async () => {
    await markAutomationRunRunning('auto_1');
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'auto_1' },
      data: { status: 'running' },
    });

    await expect(
      completeAutomationRun('auto_1', {
        status: 'partial_success',
        result: { failed: 1, ok: 2 },
      })
    ).resolves.toMatchObject({
      runId: 'auto_1',
      status: 'partial_success',
      result: { failed: 1, ok: 2 },
    });

    expect(updateMock).toHaveBeenLastCalledWith({
      where: { id: 'auto_1' },
      data: expect.objectContaining({
        status: 'partial_success',
        result_summary: { failed: 1, ok: 2 },
        finished_at: expect.any(Date),
      }),
    });
  });

  it('marks queued worker runs failed', async () => {
    await failAutomationRun('auto_1', new TypeError('worker boom'));

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'auto_1' },
      data: expect.objectContaining({
        status: 'failed',
        error_code: 'TypeError',
        error_message: 'worker boom',
        finished_at: expect.any(Date),
      }),
    });
  });

  it('rejects idempotency key reuse with a different payload', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'auto_existing',
      status: 'succeeded',
      request_digest: createRequestDigest({ weeklyIssueId: 1 }),
      result_summary: { status: 'created' },
    });

    await expect(
      withAutomationRun(
        {
          caller,
          workflow: 'weekly',
          step: 'suggest',
          idempotencyKey: 'idem-1',
          requestPayload: { weeklyIssueId: 2 },
        },
        async () => ({ status: 'succeeded', result: {} })
      )
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
    } satisfies Partial<AutomationRunConflictError>);
  });

  it('marks run failed when handler throws', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(
      withAutomationRun(
        {
          caller,
          workflow: 'weekly',
          step: 'suggest',
          idempotencyKey: 'idem-1',
          requestPayload: { weeklyIssueId: 1 },
        },
        async () => {
          throw new Error('boom');
        }
      )
    ).rejects.toThrow('boom');

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: expect.stringMatching(/^auto_/) },
      data: expect.objectContaining({
        status: 'failed',
        error_code: 'Error',
        error_message: 'boom',
        finished_at: expect.any(Date),
      }),
    });
  });

  it('mirrors completed runs to operation_logs when requested', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const result = await withAutomationRun(
      {
        caller,
        workflow: 'weekly',
        step: 'suggest',
        idempotencyKey: 'idem-1',
        targetType: 'weekly_issue',
        targetId: 42,
        requestPayload: { weeklyIssueId: 42 },
        operationLog: {
          userId: 1,
          resourceType: 'automation_run',
        },
      },
      async () => ({
        status: 'succeeded',
        result: { status: 'created' },
      })
    );

    expect(operationLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 1,
        operation_type: 'CREATE',
        resource_type: 'automation_run',
        resource_id: '42',
        operation_details: expect.stringContaining(result.runId),
      }),
    });
  });

  it('does not fail the run when operation log mirror fails', async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    operationLogCreateMock.mockRejectedValueOnce(new Error('log failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      withAutomationRun(
        {
          caller,
          workflow: 'weekly',
          step: 'suggest',
          idempotencyKey: 'idem-1',
          requestPayload: { weeklyIssueId: 1 },
          operationLog: {
            userId: 1,
          },
        },
        async () => ({
          status: 'succeeded',
          result: { status: 'created' },
        })
      )
    ).resolves.toMatchObject({
      status: 'succeeded',
    });
    consoleSpy.mockRestore();
  });
});

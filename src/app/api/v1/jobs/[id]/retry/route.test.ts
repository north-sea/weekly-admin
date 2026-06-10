// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateAutomationRequestMock = vi.fn();
const retryAutomationRunMock = vi.fn();

vi.mock('@/lib/automation/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/auth')>('@/lib/automation/auth');
  return {
    ...actual,
    authenticateAutomationRequest: (...args: unknown[]) => authenticateAutomationRequestMock(...args),
  };
});

vi.mock('@/lib/jobs/retry', async () => {
  const actual = await vi.importActual<typeof import('@/lib/jobs/retry')>('@/lib/jobs/retry');
  return {
    ...actual,
    retryAutomationRun: (...args: unknown[]) => retryAutomationRunMock(...args),
  };
});

import { JobRetryError } from '@/lib/jobs/retry';
import { POST } from './route';

const caller = {
  tokenId: 7,
  name: 'cron',
  callerType: 'cron',
  tokenPrefix: 'wa_cron',
  scopes: ['score:run'],
};

const queuedJob = {
  jobId: 'auto_retry',
  runId: 'auto_retry',
  retryOfRunId: 'auto_1',
  status: 'queued',
  workflow: 'score',
  step: 'run',
  target: {
    targetType: 'inbox',
    targetId: 'score_batch',
    targetKey: 'inbox:score_batch',
  },
  statusUrl: '/api/v1/jobs/auto_retry',
  idempotentReplay: false,
  caller: {
    type: 'cron',
    tokenPrefix: 'wa_cron',
  },
};

describe('/api/v1/jobs/[id]/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateAutomationRequestMock.mockResolvedValue(caller);
  });

  it('retries a failed job and returns the queued retry run', async () => {
    retryAutomationRunMock.mockResolvedValueOnce(queuedJob);

    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/auto_1/retry', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wa_cron',
        'idempotency-key': 'retry-click-1',
      },
    }), { params: Promise.resolve({ id: 'auto_1' }) });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(retryAutomationRunMock).toHaveBeenCalledWith({
      runId: 'auto_1',
      caller,
      idempotencyKey: 'retry-click-1',
    });
    expect(body.data).toMatchObject({
      runId: 'auto_retry',
      retryOfRunId: 'auto_1',
      status: 'queued',
    });
    expect(body.meta).toMatchObject({
      runId: 'auto_retry',
      status: 'queued',
      idempotentReplay: false,
    });
  });

  it('requires an idempotency key', async () => {
    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/auto_1/retry', {
      method: 'POST',
      headers: { authorization: 'Bearer wa_cron' },
    }), { params: Promise.resolve({ id: 'auto_1' }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
    expect(retryAutomationRunMock).not.toHaveBeenCalled();
  });

  it('returns retry service errors', async () => {
    retryAutomationRunMock.mockRejectedValueOnce(
      new JobRetryError('RETRY_PAYLOAD_UNAVAILABLE', 'Original job payload is no longer retained', 409)
    );

    const response = await POST(new NextRequest('http://localhost/api/v1/jobs/auto_1/retry', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wa_cron',
        'idempotency-key': 'retry-click-1',
      },
    }), { params: Promise.resolve({ id: 'auto_1' }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('RETRY_PAYLOAD_UNAVAILABLE');
  });
});

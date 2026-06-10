// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authenticateRequestMock = vi.fn();
const runBatchMock = vi.fn();

vi.mock('@/lib/auth', () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequestMock(...args),
}));

vi.mock('@/lib/services/inbox-scoring', () => ({
  InboxScoringService: {
    runBatch: (...args: unknown[]) => runBatchMock(...args),
  },
}));

import { POST } from './route';

describe('/api/inbox/score-batch legacy compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps human JWT authentication', async () => {
    authenticateRequestMock.mockResolvedValueOnce({ success: false });

    const response = await POST(new NextRequest('http://localhost/api/inbox/score-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: 10 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(authenticateRequestMock).toHaveBeenCalledWith(expect.any(NextRequest));
    expect(runBatchMock).not.toHaveBeenCalled();
  });

  it('does not require automation idempotency headers and remains a legacy synchronous route', async () => {
    authenticateRequestMock.mockResolvedValueOnce({ success: true, user: { id: 1 } });
    runBatchMock.mockResolvedValueOnce({ scored: 2, failed: 0, skipped: 1, errors: [] });

    const response = await POST(new NextRequest('http://localhost/api/inbox/score-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: 2, delay: 0 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Automation-Execution')).toBe('legacy-sync');
    expect(response.headers.get('X-Automation-Run-Recorded')).toBe('false');
    expect(body.data).toEqual({ scored: 2, failed: 0, skipped: 1, errors: [] });
    expect(runBatchMock).toHaveBeenCalledWith({ limit: 2, delayMs: 0, source: 'api' });
  });
});

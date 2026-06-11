// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createAutomationErrorResponse, createAutomationSuccessResponse, getCallerMeta } from './contracts';

describe('automation contracts', () => {
  it('returns success envelope with automation metadata', async () => {
    const response = createAutomationSuccessResponse(
      { status: 'queued' },
      { runId: 'auto_1', status: 'queued', idempotentReplay: false }
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { status: 'queued' },
      meta: {
        runId: 'auto_1',
        status: 'queued',
        idempotentReplay: false,
      },
    });
  });

  it('returns error envelope with automation metadata', async () => {
    const response = createAutomationErrorResponse('AUTOMATION_SCOPE_FORBIDDEN', 'Forbidden', 403, undefined, {
      runId: 'auto_1',
      status: 'failed',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'AUTOMATION_SCOPE_FORBIDDEN',
        message: 'Forbidden',
      },
      meta: {
        runId: 'auto_1',
        status: 'failed',
      },
    });
  });

  it('exposes caller metadata without secrets', () => {
    expect(
      getCallerMeta({
        tokenId: 1,
        name: 'n8n',
        callerType: 'n8n',
        tokenPrefix: 'wa_visible',
        scopes: ['weekly:read'],
      })
    ).toEqual({
      type: 'n8n',
      tokenPrefix: 'wa_visible',
    });
  });
});

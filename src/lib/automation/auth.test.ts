// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    automation_tokens: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

import {
  AutomationAuthError,
  authenticateAutomationRequest,
  generateAutomationToken,
  hashAutomationToken,
} from './auth';

function requestWithToken(token?: string) {
  return new NextRequest('http://localhost/api/v1/test', {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

describe('automation auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({});
  });

  it('generates hash-only token metadata', () => {
    const generated = generateAutomationToken();

    expect(generated.token).toMatch(/^wa_/);
    expect(generated.tokenHash).toBe(hashAutomationToken(generated.token));
    expect(generated.tokenPrefix).toBe(generated.token.slice(0, 16));
    expect(generated.tokenHash).not.toContain(generated.token);
  });

  it('rejects missing bearer token', async () => {
    await expect(authenticateAutomationRequest(requestWithToken(), 'weekly:read')).rejects.toMatchObject({
      code: 'AUTOMATION_TOKEN_MISSING',
      status: 401,
    } satisfies Partial<AutomationAuthError>);
  });

  it('rejects invalid token without leaking the token', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(authenticateAutomationRequest(requestWithToken('wa_secret_value'), 'weekly:read')).rejects.toMatchObject({
      code: 'AUTOMATION_TOKEN_INVALID',
      message: 'Automation token is invalid',
    });
  });

  it('rejects inactive token', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 1,
      name: 'cron',
      token_prefix: 'wa_cron',
      caller_type: 'cron',
      scopes: ['weekly:read'],
      status: 'disabled',
      revoked_at: null,
      expires_at: null,
    });

    await expect(authenticateAutomationRequest(requestWithToken('wa_disabled'), 'weekly:read')).rejects.toMatchObject({
      code: 'AUTOMATION_TOKEN_INACTIVE',
      status: 401,
    });
  });

  it('rejects missing scope', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 1,
      name: 'cron',
      token_prefix: 'wa_cron',
      caller_type: 'cron',
      scopes: ['weekly:read'],
      status: 'active',
      revoked_at: null,
      expires_at: null,
    });

    await expect(authenticateAutomationRequest(requestWithToken('wa_no_scope'), 'weekly:publish')).rejects.toMatchObject({
      code: 'AUTOMATION_SCOPE_FORBIDDEN',
      status: 403,
    });
  });

  it('returns caller context and updates last_used_at best effort', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 7,
      name: 'n8n-prod',
      token_prefix: 'wa_n8n_prod',
      caller_type: 'n8n',
      scopes: ['weekly:read', 'weekly:suggest'],
      status: 'active',
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000),
    });

    await expect(authenticateAutomationRequest(requestWithToken('wa_valid'), 'weekly:suggest')).resolves.toEqual({
      tokenId: 7,
      name: 'n8n-prod',
      callerType: 'n8n',
      tokenPrefix: 'wa_n8n_prod',
      scopes: ['weekly:read', 'weekly:suggest'],
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { last_used_at: expect.any(Date) },
    });
  });
});

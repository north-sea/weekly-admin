// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyTokenMock = vi.fn();

vi.mock('./lib/auth-middleware', () => ({
  verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
}));

import { proxy } from './proxy';

describe('proxy API auth boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets /api/v1 routes reach their own automation auth layer', async () => {
    const response = await proxy(new NextRequest('http://localhost/api/v1/openapi.json'));

    expect(response.status).toBe(200);
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('keeps legacy API routes behind human auth at the proxy layer', async () => {
    const response = await proxy(new NextRequest('http://localhost/api/sources/sync-all'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });
});

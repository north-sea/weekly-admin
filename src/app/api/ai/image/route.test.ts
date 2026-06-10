import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('/api/ai/image route', () => {
  it('returns 410 because AI image generation is retired', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AI_IMAGE_RETIRED');
  });
});

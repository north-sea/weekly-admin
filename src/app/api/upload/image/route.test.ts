import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('/api/upload/image route', () => {
  it('returns 410 because image upload is retired', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('IMAGE_UPLOAD_RETIRED');
  });
});

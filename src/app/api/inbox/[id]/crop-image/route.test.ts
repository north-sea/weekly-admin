import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('/api/inbox/[id]/crop-image route', () => {
  it('returns 410 because inbox image cropping is retired', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INBOX_IMAGE_CROP_RETIRED');
  });
});

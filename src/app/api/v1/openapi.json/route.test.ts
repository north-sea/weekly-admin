// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('/api/v1/openapi.json', () => {
  it('exposes the automation contract document', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.openapi).toBe('3.1.0');
    expect(body.components.securitySchemes.AutomationBearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'automation-token',
    });
    expect(body['x-automation-scopes']).toEqual(expect.arrayContaining([
      'sync:run',
      'score:run',
      'weekly:read',
      'weekly:suggest',
      'weekly:publish',
      'ops:read',
    ]));
  });

  it('documents idempotency and response envelope for mutation endpoints', async () => {
    const body = await (await GET()).json();

    expect(body.paths['/jobs/sync'].post.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
      }),
    ]));
    expect(body.components.schemas.AutomationEnvelope.properties.meta.properties).toHaveProperty('runId');
    expect(body.components.responses.IdempotencyConflict.description).toContain('Idempotency');
  });

  it('documents digest as ops read automation and score as human manual compatibility', async () => {
    const body = await (await GET()).json();

    expect(body.paths['/ai/feedback/digest'].get.security).toEqual([
      { AutomationBearer: ['ops:read'] },
    ]);
    expect(body.paths['/ai/score'].post.security).toEqual([
      { HumanBearer: [] },
    ]);
    expect(body.paths['/ai/score'].post.description).toContain('Automation callers should use /jobs/score');
  });
});

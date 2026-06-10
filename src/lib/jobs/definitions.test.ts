import { describe, expect, it } from 'vitest';

import {
  AUTOMATION_QUEUE_NAME,
  getAutomationJobDefinition,
  getSubmittableAutomationJobDefinition,
} from './definitions';

describe('automation job definitions', () => {
  it('defines the shared automation queue name', () => {
    expect(AUTOMATION_QUEUE_NAME).toBe('automation');
  });

  it('maps source-specific sync to a data source target', () => {
    const definition = getSubmittableAutomationJobDefinition('sync.run');

    expect(definition).toMatchObject({
      workflow: 'sync',
      step: 'run',
      scope: 'sync:run',
      firstBatch: true,
      attempts: 2,
    });
    expect(definition.getTarget({ sourceId: 7 })).toEqual({
      targetType: 'data_source',
      targetId: '7',
      targetKey: 'data_source:7',
    });
  });

  it('maps all-source sync and score batch to stable targets', () => {
    expect(getSubmittableAutomationJobDefinition('sync.run').getTarget({})).toEqual({
      targetType: 'data_sources',
      targetId: 'all',
      targetKey: 'data_sources:all',
    });
    expect(getSubmittableAutomationJobDefinition('score.run').getTarget({ limit: 50 })).toEqual({
      targetType: 'inbox',
      targetId: 'score_batch',
      targetKey: 'inbox:score_batch',
    });
  });

  it('registers weekly job types as reserved but not submittable in this slice', () => {
    expect(getAutomationJobDefinition('weekly.publish')).toMatchObject({
      workflow: 'weekly',
      step: 'publish',
      firstBatch: false,
    });
    expect(() => getSubmittableAutomationJobDefinition('weekly.publish')).toThrow(
      'Automation job weekly.publish is reserved'
    );
  });
});

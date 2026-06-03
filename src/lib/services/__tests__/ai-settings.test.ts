// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const upsertMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    ai_settings: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

import { AiSettingsService } from '@/lib/services/ai-settings';

describe('AiSettingsService defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get 在 DB 缺少 F1 scoring key 时返回代码级默认值', async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(AiSettingsService.get('inbox_scoring_enabled')).resolves.toEqual({
      key: 'inbox_scoring_enabled',
      value: { value: true },
      updated_at: undefined,
    });
  });

  it('list 在 DB 为空时包含 F1 scoring 默认 keys 和旧 auto_score_on_sync', async () => {
    findManyMock.mockResolvedValueOnce([]);

    const records = await AiSettingsService.list();
    const byKey = new Map(records.map((record) => [record.key, record.value]));

    expect(byKey.get('auto_score_on_sync')).toEqual({ enabled: true });
    expect(byKey.get('inbox_promotion_threshold')).toEqual({ value: 70 });
    expect(byKey.get('inbox_scoring_enabled')).toEqual({ value: true });
    expect(byKey.get('inbox_scoring_batch_size')).toEqual({ value: 50 });
    expect(byKey.get('inbox_scoring_processing_timeout_minutes')).toEqual({ value: 10 });
  });

  it('DB 中已有值优先于默认值', async () => {
    findUniqueMock.mockResolvedValueOnce({
      key: 'inbox_promotion_threshold',
      value: { value: 80 },
      updated_at: new Date('2026-06-04T00:00:00Z'),
    });

    const record = await AiSettingsService.get('inbox_promotion_threshold');

    expect(record?.value).toEqual({ value: 80 });
  });
});

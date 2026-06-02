// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const updateManyMock = vi.fn();
const updateMock = vi.fn();
const findUniqueMock = vi.fn();
const findManyMock = vi.fn();
const executeRawMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    inbox_items: {
      updateMany: (...args: unknown[]) => updateManyMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    $executeRaw: (...args: unknown[]) => executeRawMock(...args),
  },
}));

const getSettingMock = vi.fn();
vi.mock('@/lib/services/ai-settings', () => ({
  AiSettingsService: {
    get: (...args: unknown[]) => getSettingMock(...args),
  },
}));

const scoreInboxItemMock = vi.fn();
vi.mock('@/lib/ai/server/inbox-scorer', () => ({
  scoreInboxItem: (...args: unknown[]) => scoreInboxItemMock(...args),
}));

const promoteAtomicMock = vi.fn();
vi.mock('@/lib/services/inbox-scoring-promotion', () => ({
  promoteAtomic: (...args: unknown[]) => promoteAtomicMock(...args),
}));

import { InboxScoringService } from '@/lib/services/inbox-scoring';

function settingValue<T>(value: T) {
  return { value: { value } };
}

describe('InboxScoringService.runOne', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'inbox_promotion_threshold') return settingValue(70);
      if (key === 'inbox_scoring_enabled') return settingValue(true);
      if (key === 'inbox_scoring_processing_timeout_minutes') return settingValue(10);
      return null;
    });
  });

  it('CAS 抢占失败时返回 scored:false 且不执行评分', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    const result = await InboxScoringService.runOne(BigInt(1));

    expect(result).toEqual({ scored: false });
    expect(scoreInboxItemMock).not.toHaveBeenCalled();
  });

  it('并发场景下只一个 runOne 实际执行评分（V2 / CAS）', async () => {
    let claimed = false;
    updateManyMock.mockImplementation(async ({ where }: { where: { scoring_status?: string } }) => {
      if (where?.scoring_status === 'pending') {
        if (claimed) return { count: 0 };
        claimed = true;
        return { count: 1 };
      }
      return { count: 1 };
    });
    scoreInboxItemMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ ai_score: 50, ai_score_details: { topic: 5 } });
    updateMock.mockResolvedValue({});

    const [a, b] = await Promise.all([
      InboxScoringService.runOne(BigInt(10)),
      InboxScoringService.runOne(BigInt(10)),
    ]);

    const winners = [a, b].filter((r) => r.scored);
    const losers = [a, b].filter((r) => !r.scored);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(scoreInboxItemMock).toHaveBeenCalledTimes(1);
  });

  it('评分得分 >= 阈值时调用 promoteAtomic', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    scoreInboxItemMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({
      ai_score: 85,
      ai_score_details: { topic: 8, content: 9, depth: 8, practical: 8, innovation: 9, expression: 8 },
    });
    promoteAtomicMock.mockResolvedValue({ promoted: true, content_id: BigInt(999) });

    const result = await InboxScoringService.runOne(BigInt(2));

    expect(promoteAtomicMock).toHaveBeenCalledWith(
      BigInt(2),
      85,
      expect.objectContaining({ topic: 8 }),
      { source: 'cron' },
    );
    expect(result.promoted).toBe(true);
    expect(result.content_id).toBe(BigInt(999));
  });

  it('评分得分 < 阈值时不晋升，状态置为 done', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    scoreInboxItemMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ ai_score: 50, ai_score_details: { topic: 5 } });
    updateMock.mockResolvedValue({});

    const result = await InboxScoringService.runOne(BigInt(3));

    expect(promoteAtomicMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: BigInt(3) },
      data: { scoring_status: 'done' },
    });
    expect(result).toEqual({ scored: true, score: 50 });
  });

  it('force=true 时先重置 status 为 pending', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    scoreInboxItemMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ ai_score: 30, ai_score_details: null });
    updateMock.mockResolvedValue({});

    await InboxScoringService.runOne(BigInt(4), { force: true });

    const firstCall = updateManyMock.mock.calls[0][0];
    expect(firstCall).toEqual({
      where: { id: BigInt(4) },
      data: { scoring_status: 'pending' },
    });
  });

  it('评分抛错时调用 markFailed，递增 retry_count', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    scoreInboxItemMock.mockRejectedValueOnce(new Error('LLM timeout'));
    findUniqueMock.mockResolvedValueOnce({ ai_score_details: { retry_count: 1 } });
    updateMock.mockResolvedValue({});

    const result = await InboxScoringService.runOne(BigInt(5));

    expect(result.scored).toBe(false);
    expect(result.error).toBe('LLM timeout');
    const updateCall = updateMock.mock.calls.at(-1)?.[0];
    expect(updateCall.data.ai_score_details.retry_count).toBe(2);
    expect(updateCall.data.scoring_status).toBe('pending');
  });

  it('retry_count 达到 3 时状态置为 failed（V4）', async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    scoreInboxItemMock.mockRejectedValueOnce(new Error('persistent error'));
    findUniqueMock.mockResolvedValueOnce({ ai_score_details: { retry_count: 2 } });
    updateMock.mockResolvedValue({});

    await InboxScoringService.runOne(BigInt(6));

    const updateCall = updateMock.mock.calls.at(-1)?.[0];
    expect(updateCall.data.scoring_status).toBe('failed');
    expect(updateCall.data.ai_score_details.retry_count).toBe(3);
  });
});

describe('InboxScoringService.sweepStaleProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'inbox_scoring_processing_timeout_minutes') return settingValue(10);
      return null;
    });
  });

  it('回收超时 processing 项，返回受影响行数（V3）', async () => {
    executeRawMock.mockResolvedValueOnce(3);

    const swept = await InboxScoringService.sweepStaleProcessing();

    expect(swept).toBe(3);
    expect(executeRawMock).toHaveBeenCalledOnce();
  });

  it('无超时项时返回 0', async () => {
    executeRawMock.mockResolvedValueOnce(0);

    const swept = await InboxScoringService.sweepStaleProcessing();

    expect(swept).toBe(0);
  });
});

describe('InboxScoringService.runBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'inbox_scoring_enabled') return settingValue(true);
      if (key === 'inbox_scoring_batch_size') return settingValue(50);
      if (key === 'inbox_scoring_processing_timeout_minutes') return settingValue(10);
      if (key === 'inbox_promotion_threshold') return settingValue(70);
      return null;
    });
    executeRawMock.mockResolvedValue(0);
  });

  it('开关关闭时直接返回，不查询 pending 项', async () => {
    getSettingMock.mockImplementationOnce(async () => settingValue(false));

    const result = await InboxScoringService.runBatch();

    expect(result).toEqual({ scored: 0, failed: 0, skipped: 0, errors: ['scoring disabled'] });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('过滤 retry_count >= 3 的项', async () => {
    findManyMock.mockResolvedValueOnce([
      { id: BigInt(1), ai_score_details: { retry_count: 3 } },
      { id: BigInt(2), ai_score_details: { retry_count: 1 } },
      { id: BigInt(3), ai_score_details: null },
    ]);
    updateManyMock.mockResolvedValue({ count: 1 });
    scoreInboxItemMock.mockResolvedValue(true);
    findUniqueMock.mockResolvedValue({ ai_score: 30, ai_score_details: null });
    updateMock.mockResolvedValue({});

    const result = await InboxScoringService.runBatch({ delayMs: 0 });

    expect(scoreInboxItemMock).toHaveBeenCalledTimes(2);
    expect(result.scored).toBe(2);
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/ai/server/client', () => ({ serverGenerateJSON: vi.fn() }));
vi.mock('@/lib/services/ai-prompt', () => ({ AiPromptService: { getByScene: vi.fn() } }));
vi.mock('@/lib/ai/server/prompt-template', () => ({ renderPromptTemplate: vi.fn() }));

import { aggregateAiQuality } from '../inbox-scorer';

describe('aggregateAiQuality', () => {
  it('全 10 分 → ai_quality = 40', () => {
    const d = { topic: 10, content: 10, depth: 10, practical: 10, innovation: 10, expression: 10 };
    expect(aggregateAiQuality(d)).toBe(40);
  });

  it('全 0 分 → ai_quality = 0', () => {
    const d = { topic: 0, content: 0, depth: 0, practical: 0, innovation: 0, expression: 0 };
    expect(aggregateAiQuality(d)).toBe(0);
  });

  it('全 5 分 → ai_quality = 20', () => {
    const d = { topic: 5, content: 5, depth: 5, practical: 5, innovation: 5, expression: 5 };
    expect(aggregateAiQuality(d)).toBe(20);
  });

  it('权重正确: content(25%) 权重最高', () => {
    const highContent = { topic: 0, content: 10, depth: 0, practical: 0, innovation: 0, expression: 0 };
    const highTopic = { topic: 10, content: 0, depth: 0, practical: 0, innovation: 0, expression: 0 };
    expect(aggregateAiQuality(highContent)).toBeGreaterThan(aggregateAiQuality(highTopic));
  });

  it('非整数输入正确四舍五入', () => {
    const d = { topic: 7.5, content: 8, depth: 6.5, practical: 7, innovation: 5, expression: 6 };
    const expected = Math.round(
      (7.5 * 15 + 8 * 25 + 6.5 * 20 + 7 * 20 + 5 * 10 + 6 * 10) / 100 * 4
    );
    expect(aggregateAiQuality(d)).toBe(expected);
  });
});

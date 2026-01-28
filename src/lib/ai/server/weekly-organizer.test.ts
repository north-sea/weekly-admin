import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  return {
    prisma: {
      weekly_issues: { findUnique: vi.fn() },
      weekly_content_items: { findMany: vi.fn() },
      contents: { findMany: vi.fn() },
    },
  };
});

vi.mock('@/lib/ai/server/client', () => {
  return { serverGenerateJSON: vi.fn() };
});

vi.mock('@/lib/services/ai-prompt', () => {
  return {
    AiPromptService: {
      getByScene: vi.fn(),
    },
  };
});

import { prisma } from '@/lib/db';
import { serverGenerateJSON } from '@/lib/ai/server/client';
import { AiPromptService } from '@/lib/services/ai-prompt';
import { organizeWeekly } from './weekly-organizer';

describe('organizeWeekly', () => {
  it('filters candidates by issue date range and passes candidates oldest-first', async () => {
    (AiPromptService.getByScene as any).mockResolvedValue({ prompt: '{{candidates}}' });
    (prisma.weekly_issues.findUnique as any).mockResolvedValue({
      id: 46,
      title: 'Issue 46',
      start_date: new Date('2025-01-01T00:00:00.000Z'),
      end_date: new Date('2025-01-07T00:00:00.000Z'),
    });
    (prisma.weekly_content_items.findMany as any).mockResolvedValue([
      { content_id: BigInt(101) },
      { content_id: BigInt(102) },
    ]);
    (prisma.contents.findMany as any).mockResolvedValue([
      {
        id: BigInt(201),
        title: 'B',
        summary: 's',
        source: 'x',
        source_url: null,
        category_id: null,
        original_score: 1,
        summary_score: 0,
        created_at: new Date('2025-01-02T10:00:00.000Z'),
      },
      {
        id: BigInt(202),
        title: 'C',
        summary: 's',
        source: 'x',
        source_url: null,
        category_id: null,
        original_score: 6,
        summary_score: 4,
        created_at: new Date('2025-01-03T09:00:00.000Z'),
      },
      {
        id: BigInt(203),
        title: 'A',
        summary: 's',
        source: 'x',
        source_url: null,
        category_id: null,
        original_score: 5,
        summary_score: 0,
        created_at: new Date('2025-01-01T12:00:00.000Z'),
      },
    ]);

    let capturedPrompt = '';
    (serverGenerateJSON as any).mockImplementation(async (options: any) => {
      capturedPrompt = options.messages?.[0]?.content ?? '';
      return {
        intro: 'intro',
        items: [
          { content_id: 202, section: '文章' },
          { content_id: 201, section: '工具' },
          { content_id: 203, section: '资源' },
        ],
      };
    });

    const result = await organizeWeekly({ weeklyIssueId: 46, maxItems: 12 });

    const findManyArgs = (prisma.contents.findMany as any).mock.calls[0]?.[0];
    expect(findManyArgs.where.weekly_content_items).toEqual({ none: {} });
    expect(findManyArgs.where.created_at.gte.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(findManyArgs.where.created_at.lt.toISOString()).toBe('2025-01-08T00:00:00.000Z');

    const promptCandidates = JSON.parse(capturedPrompt);
    const idsInPrompt = promptCandidates.map((c: any) => c.id);
    expect(idsInPrompt).toEqual([203, 201, 202]);

    const idsInResult = result.items.map((c) => c.content_id);
    expect(idsInResult).toEqual([203, 201, 202]);
  });

  it('throws when AI returns ids not present in candidates', async () => {
    (AiPromptService.getByScene as any).mockResolvedValue({ prompt: '{{candidates}}' });
    (prisma.weekly_issues.findUnique as any).mockResolvedValue({
      id: 46,
      title: 'Issue 46',
      start_date: new Date('2025-01-01T00:00:00.000Z'),
      end_date: new Date('2025-01-07T00:00:00.000Z'),
    });
    (prisma.weekly_content_items.findMany as any).mockResolvedValue([]);
    (prisma.contents.findMany as any).mockResolvedValue([
      {
        id: BigInt(1),
        title: 'A',
        summary: 's',
        source: 'x',
        source_url: null,
        category_id: null,
        original_score: 1,
        summary_score: 1,
        created_at: new Date('2025-01-01T00:00:00.000Z'),
      },
    ]);
    (serverGenerateJSON as any).mockResolvedValue({
      intro: 'intro',
      items: [{ content_id: 999, section: '文章' }],
    });

    await expect(organizeWeekly({ weeklyIssueId: 46, maxItems: 12 })).rejects.toThrow(
      'AI 返回了不存在的 content_id: 999'
    );
  });
});

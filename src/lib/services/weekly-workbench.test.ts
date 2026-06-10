// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const weeklyIssuesFindFirstMock = vi.fn();
const contentsCountMock = vi.fn();
const automationRunsFindManyMock = vi.fn();
const getWeeklyCandidatesMock = vi.fn();
const organizeWeeklyMock = vi.fn();
const applyWeeklySuggestionMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    weekly_issues: {
      findFirst: (...args: unknown[]) => weeklyIssuesFindFirstMock(...args),
    },
    contents: {
      count: (...args: unknown[]) => contentsCountMock(...args),
    },
    automation_runs: {
      findMany: (...args: unknown[]) => automationRunsFindManyMock(...args),
    },
  },
}));

vi.mock('@/lib/automation/weekly-candidates', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/weekly-candidates')>('@/lib/automation/weekly-candidates');
  return {
    ...actual,
    getWeeklyCandidates: (...args: unknown[]) => getWeeklyCandidatesMock(...args),
  };
});

vi.mock('@/lib/ai/server/weekly-organizer', () => ({
  organizeWeekly: (...args: unknown[]) => organizeWeeklyMock(...args),
}));

vi.mock('@/lib/automation/weekly-suggestions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/automation/weekly-suggestions')>('@/lib/automation/weekly-suggestions');
  return {
    ...actual,
    applyWeeklySuggestion: (...args: unknown[]) => applyWeeklySuggestionMock(...args),
  };
});

import {
  applyWorkbenchSuggestion,
  getCompletenessState,
  getLatestHermesOpsReport,
  getLatestHermesSuggestionPreview,
  getNextAction,
  getWorkbenchRuns,
  getWorkbenchSummary,
  previewWeeklySuggestion,
} from './weekly-workbench';

describe('weekly workbench service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentsCountMock.mockResolvedValue(0);
    automationRunsFindManyMock.mockResolvedValue([]);
    getWeeklyCandidatesMock.mockResolvedValue({
      status: 'empty',
      range: { startDate: '2026-06-01', endDate: '2026-06-07' },
      total: 0,
      candidates: [],
    });
  });

  it('classifies completeness with the current 10-15 threshold', () => {
    expect(getCompletenessState(9)).toBe('insufficient');
    expect(getCompletenessState(10)).toBe('ready');
    expect(getCompletenessState(15)).toBe('ready');
    expect(getCompletenessState(16)).toBe('overloaded');
  });

  it('selects next action from the current production state', () => {
    expect(getNextAction({
      hasIssue: false,
      selectedCount: 0,
      candidateCount: 0,
      unscoredCount: 0,
      published: false,
    }).type).toBe('create_issue');

    expect(getNextAction({
      hasIssue: true,
      issueId: 7,
      selectedCount: 5,
      candidateCount: 2,
      unscoredCount: 0,
      published: false,
    })).toMatchObject({
      type: 'organize_issue',
      href: '/weekly/editor/7#suggestions',
    });

    expect(getNextAction({
      hasIssue: true,
      issueId: 7,
      selectedCount: 12,
      candidateCount: 2,
      unscoredCount: 0,
      published: false,
    })).toMatchObject({
      type: 'publish_issue',
      href: '/weekly/editor/7#publish',
    });
  });

  it('returns summary with issue, candidates, completeness and runs', async () => {
    weeklyIssuesFindFirstMock.mockResolvedValueOnce({
      id: 7,
      issue_number: 42,
      title: 'Weekly',
      desc: null,
      status: 'draft',
      start_date: new Date('2026-06-01T00:00:00Z'),
      end_date: new Date('2026-06-07T00:00:00Z'),
      total_items: 0,
      total_word_count: 0,
      reading_time: 0,
      published_at: null,
      quail_post_id: null,
      quail_post_slug: null,
      quail_published_at: null,
      quail_delivered_at: null,
      quail_publish_error: null,
      weekly_content_items: [
        { id: 1, sort_order: 0, section: 'A', featured: false, content_id: BigInt(1) },
        { id: 2, sort_order: 1, section: 'B', featured: false, content_id: BigInt(2) },
      ],
    });
    contentsCountMock.mockResolvedValueOnce(1);
    getWeeklyCandidatesMock.mockResolvedValueOnce({
      status: 'succeeded',
      range: { startDate: '2026-06-01', endDate: '2026-06-07' },
      total: 4,
      candidates: [],
    });
    automationRunsFindManyMock.mockResolvedValueOnce([
      {
        id: 'auto_1',
        workflow: 'weekly',
        step: 'candidates',
        status: 'succeeded',
        target_type: 'weekly_issue',
        target_id: '7',
        error_code: null,
        error_message: null,
        external_side_effect: false,
        external_ref: null,
        started_at: new Date('2026-06-01T01:00:00Z'),
        finished_at: new Date('2026-06-01T01:01:00Z'),
        result_summary: { total: 4 },
      },
    ]);

    const result = await getWorkbenchSummary({ weekOffset: 0 });

    expect(result.issue).toMatchObject({ id: 7, issueNumber: 42 });
    expect(result.completeness).toMatchObject({ selected: 2, min: 10, max: 15, state: 'insufficient' });
    expect(result.candidates).toMatchObject({ total: 4, unscored: 1 });
    expect(result.runs.runs[0]).toMatchObject({ id: 'auto_1', workflow: 'weekly' });
    expect(result.nextAction.type).toBe('score_candidates');
  });

  it('keeps summary available when automation runs cannot be loaded', async () => {
    weeklyIssuesFindFirstMock.mockResolvedValueOnce({
      id: 7,
      issue_number: 42,
      title: 'Weekly',
      desc: null,
      status: 'draft',
      start_date: new Date('2026-06-01T00:00:00Z'),
      end_date: new Date('2026-06-07T00:00:00Z'),
      total_items: 0,
      total_word_count: 0,
      reading_time: 0,
      published_at: null,
      quail_post_id: null,
      quail_post_slug: null,
      quail_published_at: null,
      quail_delivered_at: null,
      quail_publish_error: null,
      weekly_content_items: [],
    });
    contentsCountMock.mockResolvedValueOnce(0);
    getWeeklyCandidatesMock.mockResolvedValueOnce({
      status: 'empty',
      range: { startDate: '2026-06-01', endDate: '2026-06-07' },
      total: 0,
      candidates: [],
    });
    automationRunsFindManyMock.mockRejectedValueOnce(new Error('runs down'));

    const result = await getWorkbenchSummary({ weekOffset: 0 });

    expect(result.issue).toMatchObject({ id: 7, issueNumber: 42 });
    expect(result.runs).toEqual({ total: 0, runs: [] });
    expect(result.nextAction.type).toBe('collect_candidates');
  });

  it('filters automation runs with a bounded limit', async () => {
    automationRunsFindManyMock.mockResolvedValueOnce([]);

    await getWorkbenchRuns({
      workflow: 'weekly',
      targetType: 'weekly_issue',
      targetId: '7',
      limit: 5,
    });

    expect(automationRunsFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        workflow: 'weekly',
        target_type: 'weekly_issue',
        target_id: '7',
      },
      take: 5,
    }));
  });

  it('returns suggestion preview without applying items', async () => {
    organizeWeeklyMock.mockResolvedValueOnce({
      intro: 'hello',
      items: [{ content_id: 10, section: 'AI' }],
    });

    const result = await previewWeeklySuggestion({ weeklyIssueId: 7, maxItems: 5 });

    expect(organizeWeeklyMock).toHaveBeenCalledWith({ weeklyIssueId: 7, maxItems: 5 });
    expect(result).toMatchObject({
      status: 'preview',
      weeklyIssueId: 7,
      suggestion: {
        items: [{ content_id: 10, section: 'AI' }],
      },
    });
    expect(applyWeeklySuggestionMock).not.toHaveBeenCalled();
  });

  it('returns the latest Hermes suggestion preview from automation runs', async () => {
    automationRunsFindManyMock.mockResolvedValueOnce([
      {
        id: 'auto_hermes',
        result_summary: {
          status: 'preview',
          weeklyIssueId: 7,
          provider: 'hermes',
          artifactVersion: 'weekly-suggestion.v1',
          agentRunId: 'hermes_1',
          confidence: 0.76,
          suggestion: {
            items: [{ content_id: 10, section: 'AI', featured: false, evidenceRefs: [] }],
          },
        },
      },
    ]);

    const result = await getLatestHermesSuggestionPreview(7);

    expect(automationRunsFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workflow: 'weekly',
        step: 'suggest',
        target_id: '7',
      }),
      take: 10,
    }));
    expect(result).toMatchObject({
      provider: 'hermes',
      sourceRunId: 'auto_hermes',
      agentRunId: 'hermes_1',
      confidence: 0.76,
    });
  });

  it('ignores admin previews when looking for latest Hermes suggestions', async () => {
    automationRunsFindManyMock.mockResolvedValueOnce([
      {
        id: 'auto_admin',
        result_summary: {
          status: 'preview',
          weeklyIssueId: 7,
          provider: 'admin',
          suggestion: {
            items: [{ content_id: 10, section: 'AI', featured: false, evidenceRefs: [] }],
          },
        },
      },
    ]);

    await expect(getLatestHermesSuggestionPreview(7)).resolves.toBeNull();
  });

  it('returns the latest Hermes ops report from automation runs', async () => {
    automationRunsFindManyMock.mockResolvedValueOnce([
      {
        result_summary: {
          artifactVersion: 'weekly-ops-report.v1',
          weeklyIssueId: 7,
          agentRunId: 'hermes_ops_1',
          status: 'history_only',
          summary: 'Redis 状态过期，已使用 automation_runs 复盘',
          risks: ['worker heartbeat stale'],
          nextActions: ['检查 worker'],
          runRefs: ['auto_1'],
          jobRefs: ['auto_1'],
          healthRefs: ['health_1'],
          generatedAt: '2026-06-08T00:00:00.000Z',
        },
      },
    ]);

    const result = await getLatestHermesOpsReport(7);

    expect(result).toMatchObject({
      agentRunId: 'hermes_ops_1',
      status: 'history_only',
      risks: ['worker heartbeat stale'],
    });
  });

  it('applies suggestions through the existing automation service logic', async () => {
    applyWeeklySuggestionMock.mockResolvedValueOnce({
      status: 'applied',
      weeklyIssueId: 7,
      linkedCount: 1,
      skippedCount: 0,
    });

    const result = await applyWorkbenchSuggestion({
      weeklyIssueId: 7,
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: true }],
    });

    expect(applyWeeklySuggestionMock).toHaveBeenCalledWith({
      weeklyIssueId: 7,
      replaceExisting: false,
      sourceRunId: undefined,
      agentRunId: undefined,
      items: [{ content_id: 10, section: 'AI', featured: true }],
    });
    expect(result).toMatchObject({ status: 'applied', linkedCount: 1 });
  });
});

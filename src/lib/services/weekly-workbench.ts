import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getWeeklyCandidates, WeeklyCandidatesQuerySchema } from '@/lib/automation/weekly-candidates';
import { applyWeeklySuggestion, SuggestionApplySchema } from '@/lib/automation/weekly-suggestions';
import {
  parseWeeklyOpsReportArtifact,
  parseWeeklySuggestionPreviewResult,
  type WeeklyOpsReportArtifact,
  type WeeklySuggestionPreviewResult,
} from '@/lib/automation/hermes-artifacts';
import { organizeWeekly } from '@/lib/ai/server/weekly-organizer';
import { getWeekRangeByOffset } from '@/lib/utils/weekly-date';

const COMPLETENESS_MIN = 10;
const COMPLETENESS_MAX = 15;
const DEFAULT_RUN_LIMIT = 20;
const MAX_RUN_LIMIT = 50;

export const WorkbenchSummaryQuerySchema = z.object({
  weekOffset: z.coerce.number().int().min(-52).max(52).default(0),
});

export const WorkbenchRunsQuerySchema = z.object({
  workflow: z.string().trim().min(1).max(80).optional(),
  step: z.string().trim().min(1).max(80).optional(),
  status: z.string().trim().min(1).max(30).optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
  targetId: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_RUN_LIMIT).default(DEFAULT_RUN_LIMIT),
});

export const WorkbenchSuggestSchema = z.object({
  weeklyIssueId: z.number().int().positive(),
  maxItems: z.number().int().positive().max(30).default(12),
});

export type WorkbenchSummaryQuery = z.infer<typeof WorkbenchSummaryQuerySchema>;
export type WorkbenchRunsQuery = z.infer<typeof WorkbenchRunsQuerySchema>;
export type WorkbenchSuggestInput = z.infer<typeof WorkbenchSuggestSchema>;

type IssueRecord = NonNullable<Awaited<ReturnType<typeof findIssueForWeek>>>;

export function getCompletenessState(count: number) {
  if (count < COMPLETENESS_MIN) return 'insufficient';
  if (count > COMPLETENESS_MAX) return 'overloaded';
  return 'ready';
}

export function getNextAction(input: {
  hasIssue: boolean;
  issueId?: number | null;
  selectedCount: number;
  candidateCount: number;
  unscoredCount: number;
  published: boolean;
}) {
  const workbenchHref = input.issueId ? `/weekly/editor/${input.issueId}` : '/weekly';

  if (!input.hasIssue) {
    return {
      type: 'create_issue',
      label: '创建本周周刊',
      href: '/weekly/editor/new',
    };
  }

  if (input.candidateCount === 0) {
    return {
      type: 'collect_candidates',
      label: '采集候选内容',
      href: '/inbox',
    };
  }

  if (input.unscoredCount > 0) {
    return {
      type: 'score_candidates',
      label: '处理未评分候选',
      href: '/inbox',
    };
  }

  if (input.selectedCount < COMPLETENESS_MIN) {
    return {
      type: 'organize_issue',
      label: '组刊并应用建议',
      href: `${workbenchHref}#suggestions`,
    };
  }

  if (!input.published) {
    return {
      type: 'publish_issue',
      label: '检查并发布',
      href: `${workbenchHref}#publish`,
    };
  }

  return {
    type: 'review_issue',
    label: '查看复盘',
    href: '/analytics',
  };
}

async function findIssueForWeek(query: WorkbenchSummaryQuery) {
  const range = getWeekRangeByOffset(query.weekOffset);

  const issueInRange = await prisma.weekly_issues.findFirst({
    where: {
      start_date: { lte: range.endDate },
      end_date: { gte: range.startDate },
    },
    orderBy: { issue_number: 'desc' },
    select: weeklyIssueSelect,
  });

  if (issueInRange) return issueInRange;

  return prisma.weekly_issues.findFirst({
    orderBy: { issue_number: 'desc' },
    select: weeklyIssueSelect,
  });
}

const weeklyIssueSelect = {
  id: true,
  issue_number: true,
  title: true,
  desc: true,
  status: true,
  start_date: true,
  end_date: true,
  total_items: true,
  total_word_count: true,
  reading_time: true,
  published_at: true,
  quail_post_id: true,
  quail_post_slug: true,
  quail_published_at: true,
  quail_delivered_at: true,
  quail_publish_error: true,
  weekly_content_items: {
    select: {
      id: true,
      sort_order: true,
      section: true,
      featured: true,
      content_id: true,
    },
    orderBy: { sort_order: 'asc' as const },
  },
};

function formatIssue(issue: IssueRecord | null) {
  if (!issue) return null;

  return {
    id: issue.id,
    issueNumber: issue.issue_number,
    title: issue.title,
    desc: issue.desc ?? null,
    status: issue.status ?? 'draft',
    startDate: issue.start_date.toISOString().slice(0, 10),
    endDate: issue.end_date.toISOString().slice(0, 10),
    totalItems: issue.total_items ?? 0,
    totalWordCount: issue.total_word_count ?? 0,
    readingTime: issue.reading_time ?? 0,
    publishedAt: issue.published_at?.toISOString() ?? null,
    quail: {
      postId: issue.quail_post_id ?? null,
      postSlug: issue.quail_post_slug ?? null,
      publishedAt: issue.quail_published_at?.toISOString() ?? null,
      deliveredAt: issue.quail_delivered_at?.toISOString() ?? null,
      error: issue.quail_publish_error ?? null,
    },
  };
}

export async function getWorkbenchRuns(query: WorkbenchRunsQuery) {
  const automationRunsModel = (prisma as unknown as {
    automation_runs?: {
      findMany: typeof prisma.automation_runs.findMany;
    };
  }).automation_runs;

  if (!automationRunsModel?.findMany) {
    return {
      total: 0,
      runs: [],
    };
  }

  const where = {
    ...(query.workflow ? { workflow: query.workflow } : {}),
    ...(query.step ? { step: query.step } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.targetType ? { target_type: query.targetType } : {}),
    ...(query.targetId ? { target_id: query.targetId } : {}),
  };

  const runs = await automationRunsModel.findMany({
    where,
    orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
    take: query.limit,
    select: {
      id: true,
      workflow: true,
      step: true,
      status: true,
      target_type: true,
      target_id: true,
      error_code: true,
      error_message: true,
      external_side_effect: true,
      external_ref: true,
      started_at: true,
      finished_at: true,
      result_summary: true,
    },
  });

  return {
    total: runs.length,
    runs: runs.map((run) => ({
      id: run.id,
      workflow: run.workflow,
      step: run.step,
      status: run.status,
      targetType: run.target_type,
      targetId: run.target_id,
      errorCode: run.error_code,
      errorMessage: run.error_message,
      externalSideEffect: run.external_side_effect,
      externalRef: run.external_ref,
      startedAt: run.started_at?.toISOString() ?? null,
      finishedAt: run.finished_at?.toISOString() ?? null,
      resultSummary: run.result_summary,
    })),
  };
}

export async function getLatestHermesSuggestionPreview(weeklyIssueId: number): Promise<WeeklySuggestionPreviewResult | null> {
  const automationRunsModel = (prisma as unknown as {
    automation_runs?: {
      findMany: typeof prisma.automation_runs.findMany;
    };
  }).automation_runs;

  if (!automationRunsModel?.findMany) return null;

  const runs = await automationRunsModel.findMany({
    where: {
      workflow: 'weekly',
      step: 'suggest',
      target_type: 'weekly_issue',
      target_id: String(weeklyIssueId),
      status: { in: ['succeeded', 'empty', 'skipped'] },
    },
    orderBy: [{ finished_at: 'desc' }, { started_at: 'desc' }, { created_at: 'desc' }],
    take: 10,
    select: {
      id: true,
      result_summary: true,
    },
  });

  for (const run of runs) {
    const preview = parseWeeklySuggestionPreviewResult(run.result_summary);
    if (preview?.provider === 'hermes') {
      return {
        ...preview,
        sourceRunId: preview.sourceRunId ?? run.id,
      };
    }
  }

  return null;
}

export async function getLatestHermesOpsReport(weeklyIssueId: number): Promise<WeeklyOpsReportArtifact | null> {
  const automationRunsModel = (prisma as unknown as {
    automation_runs?: {
      findMany: typeof prisma.automation_runs.findMany;
    };
  }).automation_runs;

  if (!automationRunsModel?.findMany) return null;

  const runs = await automationRunsModel.findMany({
    where: {
      workflow: 'weekly',
      target_type: 'weekly_issue',
      target_id: String(weeklyIssueId),
      status: { in: ['succeeded', 'empty', 'skipped', 'partial_success'] },
    },
    orderBy: [{ finished_at: 'desc' }, { started_at: 'desc' }, { created_at: 'desc' }],
    take: 20,
    select: {
      result_summary: true,
    },
  });

  for (const run of runs) {
    const report = parseWeeklyOpsReportArtifact(run.result_summary);
    if (report) return report;
  }

  return null;
}

export async function getWorkbenchCandidates(rawQuery: unknown) {
  const query = WeeklyCandidatesQuerySchema.parse(rawQuery);
  return getWeeklyCandidates(query);
}

export async function previewWeeklySuggestion(rawInput: unknown) {
  const input = WorkbenchSuggestSchema.parse(rawInput);
  const suggestion = await organizeWeekly(input);

  return {
    status: 'preview' as const,
    weeklyIssueId: input.weeklyIssueId,
    provider: 'admin' as const,
    artifactVersion: 'weekly-suggestion.v1' as const,
    generatedAt: new Date().toISOString(),
    suggestion,
  };
}

export async function applyWorkbenchSuggestion(rawInput: unknown) {
  const input = SuggestionApplySchema.parse(rawInput);
  return applyWeeklySuggestion(input);
}

export async function getWorkbenchSummary(rawQuery: unknown) {
  const query = WorkbenchSummaryQuerySchema.parse(rawQuery);
  const issue = await findIssueForWeek(query);

  const [candidateResult, unscoredCount, recentRuns] = await Promise.all([
    getWeeklyCandidates({
      weekOffset: query.weekOffset,
      limit: 30,
      status: 'ready',
    }),
    prisma.contents.count({
      where: {
        content_type_id: 3,
        status: 'ready',
        OR: [
          { original_score: null },
          { summary_score: null },
        ],
      },
    }),
    getWorkbenchRuns({
      limit: 10,
    }).catch(() => ({ total: 0, runs: [] })),
  ]);

  const selectedCount = issue?.weekly_content_items.length ?? 0;
  const completenessState = getCompletenessState(selectedCount);
  const hasIssue = Boolean(issue);
  const published = issue?.status === 'published' || Boolean(issue?.quail_published_at);

  return {
    issue: formatIssue(issue),
    completeness: {
      selected: selectedCount,
      min: COMPLETENESS_MIN,
      max: COMPLETENESS_MAX,
      state: completenessState,
    },
    candidates: {
      status: candidateResult.status,
      total: candidateResult.total,
      unscored: unscoredCount,
      range: candidateResult.range,
    },
    publish: {
      status: issue?.status ?? null,
      quailPostId: issue?.quail_post_id ?? null,
      quailPostSlug: issue?.quail_post_slug ?? null,
      quailPublishedAt: issue?.quail_published_at?.toISOString() ?? null,
      quailError: issue?.quail_publish_error ?? null,
    },
    runs: recentRuns,
    nextAction: getNextAction({
      hasIssue,
      issueId: issue?.id ?? null,
      selectedCount,
      candidateCount: candidateResult.total,
      unscoredCount,
      published,
    }),
  };
}

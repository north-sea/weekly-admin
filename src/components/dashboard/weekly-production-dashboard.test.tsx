import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  WeeklyProductionDashboard,
  type JobWorkerSummary,
  type WorkbenchSummary,
} from './weekly-production-dashboard';

const baseSummary: WorkbenchSummary = {
  issue: {
    id: 7,
    issueNumber: 42,
    title: 'AI Weekly',
    status: 'draft',
    startDate: '2026-06-01',
    endDate: '2026-06-07',
    totalItems: 8,
    totalWordCount: 4200,
    readingTime: 21,
    quail: {
      postId: null,
      postSlug: null,
      publishedAt: null,
      deliveredAt: null,
      error: null,
    },
  },
  completeness: {
    selected: 8,
    min: 10,
    max: 15,
    state: 'insufficient',
  },
  candidates: {
    status: 'succeeded',
    total: 18,
    unscored: 2,
    range: {
      startDate: '2026-06-01',
      endDate: '2026-06-07',
    },
  },
  publish: {
    status: 'draft',
    quailPostId: null,
    quailPostSlug: null,
    quailPublishedAt: null,
    quailError: null,
  },
  runs: {
    total: 1,
    runs: [
      {
        id: 'run_1',
        workflow: 'weekly',
        step: 'score',
        status: 'failed',
        targetType: 'weekly_issue',
        targetId: '7',
        errorMessage: 'score failed',
        startedAt: '2026-06-07T01:00:00.000Z',
        finishedAt: '2026-06-07T01:01:00.000Z',
      },
    ],
  },
  nextAction: {
    type: 'score_candidates',
    label: '处理未评分候选',
    href: '/inbox',
  },
};

const healthyJobs: JobWorkerSummary = {
  status: 'healthy',
  reason: null,
  queue: {
    waiting: 0,
    delayed: 0,
    active: 1,
    failed: 0,
    oldestQueuedAgeMs: null,
  },
  workers: {
    count: 1,
    stale: 0,
    heartbeats: [{ workerId: 'worker-a', stale: false, lastSeenAt: '2026-06-08T00:00:00.000Z' }],
  },
  redis: {
    available: true,
  },
};

describe('WeeklyProductionDashboard', () => {
  it('renders the current weekly production state and failed runs', () => {
    render(
      <WeeklyProductionDashboard
        summary={baseSummary}
        jobs={healthyJobs}
        onRefresh={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('周刊驾驶舱')).toBeInTheDocument();
    expect(screen.getByText('第 42 期 · 2026-06-01 至 2026-06-07')).toBeInTheDocument();
    expect(screen.getByText('2 条未评分')).toBeInTheDocument();
    expect(screen.getByText('内容不足')).toBeInTheDocument();
    expect(screen.getByText('weekly/score')).toBeInTheDocument();
    expect(screen.getByText('score failed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('任务队列')).toBeInTheDocument();
    expect(screen.getByText('queued / delayed')).toBeInTheDocument();
    expect(screen.getByText('最久等待 无积压')).toBeInTheDocument();
  });

  it('renders an empty state when no weekly issue exists', () => {
    render(
      <WeeklyProductionDashboard
        summary={null}
        onRefresh={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('尚未创建本周周刊')).toBeInTheDocument();
    expect(screen.getByText('未创建')).toBeInTheDocument();
    expect(screen.getByText('待创建')).toBeInTheDocument();
    expect(screen.getByText('暂无运行记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /创建本周周刊/ })).toBeInTheDocument();
  });

  it('navigates through the primary next-action button', () => {
    const onNavigate = vi.fn();

    render(
      <WeeklyProductionDashboard
        summary={baseSummary}
        jobs={healthyJobs}
        onRefresh={vi.fn()}
        onNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /处理未评分候选/ }));

    expect(onNavigate).toHaveBeenCalledWith('/inbox');
  });

  it('renders backlog warning in the job queue surface', () => {
    render(
      <WeeklyProductionDashboard
        summary={baseSummary}
        jobs={{
          ...healthyJobs,
          status: 'degraded',
          reason: 'Queued jobs are older than the backlog threshold',
          queue: {
            waiting: 2,
            delayed: 1,
            active: 0,
            failed: 0,
            oldestQueuedAgeMs: 600_000,
          },
        }}
        onRefresh={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Queued jobs are older than the backlog threshold')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders stale worker heartbeat state', () => {
    render(
      <WeeklyProductionDashboard
        summary={baseSummary}
        jobs={{
          ...healthyJobs,
          status: 'degraded',
          reason: 'Worker heartbeat is stale',
          workers: {
            count: 2,
            stale: 1,
            heartbeats: [],
          },
        }}
        onRefresh={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Worker heartbeat is stale')).toBeInTheDocument();
    expect(screen.getByText('1 个 worker heartbeat stale')).toBeInTheDocument();
  });

  it('renders history-only degradation when Redis status is unavailable', () => {
    render(
      <WeeklyProductionDashboard
        summary={baseSummary}
        jobs={{
          ...healthyJobs,
          status: 'degraded',
          reason: null,
          redis: {
            available: false,
            error: 'redis down',
          },
        }}
        onRefresh={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Redis 状态不可用，仅可查看历史记录')).toBeInTheDocument();
  });
});

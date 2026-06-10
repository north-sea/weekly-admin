import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationRunTimeline } from './AutomationRunTimeline';

function apiResponse(body: unknown) {
  return {
    json: async () => body,
  } as Response;
}

describe('AutomationRunTimeline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders running and failed run states', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/ops-report')) {
        return Promise.resolve(apiResponse({ success: true, data: null }));
      }

      return Promise.resolve(apiResponse({
        success: true,
        data: {
          total: 2,
          runs: [
            {
              id: 'run_1',
              workflow: 'weekly',
              step: 'publish',
              status: 'failed',
              errorMessage: 'Quail down',
              startedAt: '2026-06-07T01:00:00.000Z',
              finishedAt: '2026-06-07T01:01:00.000Z',
            },
            {
              id: 'run_2',
              workflow: 'weekly',
              step: 'suggest',
              status: 'running',
              errorMessage: null,
              startedAt: '2026-06-07T02:00:00.000Z',
              finishedAt: null,
            },
          ],
        },
      }));
    }));

    render(<AutomationRunTimeline issueId={7} />);

    expect(screen.getByRole('status', { name: '正在加载运行记录' })).toBeInTheDocument();
    expect(await screen.findByText('weekly/publish')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('Quail down')).toBeInTheDocument();
    expect(screen.getByText('weekly/suggest')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('renders queued, retryable and history-only states', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/ops-report')) {
        return Promise.resolve(apiResponse({ success: true, data: null }));
      }

      return Promise.resolve(apiResponse({
        success: true,
        data: {
          total: 3,
          runs: [
            {
              id: 'run_1',
              workflow: 'score',
              step: 'run',
              status: 'queued',
              startedAt: '2026-06-07T01:00:00.000Z',
            },
            {
              id: 'run_2',
              workflow: 'score',
              step: 'run',
              status: 'retrying',
              retryable: true,
              errorMessage: 'temporary failure',
              startedAt: '2026-06-07T02:00:00.000Z',
            },
            {
              id: 'run_3',
              workflow: 'sync',
              step: 'run',
              status: 'succeeded',
              historyOnly: true,
              redis: { statusExpired: true },
              startedAt: '2026-06-07T03:00:00.000Z',
            },
          ],
        },
      }));
    }));

    render(<AutomationRunTimeline issueId={7} />);

    expect(await screen.findByText('queued')).toBeInTheDocument();
    expect(screen.getByText('retrying')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试/ })).toBeDisabled();
    expect(screen.getByText('history only')).toBeInTheDocument();
    expect(screen.getByText('状态已过期，显示历史记录')).toBeInTheDocument();
  });

  it('renders an empty state when no runs exist', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/ops-report')) {
        return Promise.resolve(apiResponse({ success: true, data: null }));
      }

      return Promise.resolve(apiResponse({
        success: true,
        data: { total: 0, runs: [] },
      }));
    }));

    render(<AutomationRunTimeline issueId={7} />);

    expect(await screen.findByText('暂无运行记录')).toBeInTheDocument();
  });

  it('renders load errors without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/ops-report')) {
        return Promise.resolve(apiResponse({ success: true, data: null }));
      }

      return Promise.resolve(apiResponse({
        success: false,
        error: { message: 'runs down' },
      }));
    }));

    render(<AutomationRunTimeline issueId={7} />);

    expect(await screen.findByText('运行记录加载失败')).toBeInTheDocument();
    expect(screen.getByText('runs down')).toBeInTheDocument();
  });

  it('renders Hermes ops report without blocking runs', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/ops-report')) {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            artifactVersion: 'weekly-ops-report.v1',
            weeklyIssueId: 7,
            agentRunId: 'hermes_ops_1',
            status: 'history_only',
            summary: 'Redis 状态过期，已使用 durable runs 复盘',
            risks: ['worker heartbeat stale'],
            nextActions: ['检查 worker'],
            runRefs: ['auto_1'],
            generatedAt: '2026-06-08T00:00:00.000Z',
          },
        }));
      }

      return Promise.resolve(apiResponse({
        success: true,
        data: { total: 0, runs: [] },
      }));
    }));

    render(<AutomationRunTimeline issueId={7} />);

    expect(await screen.findByText('Hermes 复盘')).toBeInTheDocument();
    expect(screen.getByText('Redis 状态过期，已使用 durable runs 复盘')).toBeInTheDocument();
    expect(screen.getByText('worker heartbeat stale')).toBeInTheDocument();
    expect(screen.getByText('检查 worker')).toBeInTheDocument();
    expect(screen.getByText(/auto_1/)).toBeInTheDocument();
  });
});

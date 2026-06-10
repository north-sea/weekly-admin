import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeeklyWorkbench } from './WeeklyWorkbench';

function apiResponse(body: unknown) {
  return {
    json: async () => body,
  } as Response;
}

describe('WeeklyWorkbench', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads issue, candidates and runs into the workbench status bar', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/weekly/7') {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            id: 7,
            issue_number: 42,
            title: 'AI Weekly',
            status: 'draft',
            start_date: '2026-06-01',
            end_date: '2026-06-07',
            total_items: 0,
            contents: [{ id: 1 }, { id: 2 }, { id: 3 }],
          },
        }));
      }

      if (url.startsWith('/api/weekly/workbench/candidates')) {
        return Promise.resolve(apiResponse({
          success: true,
          data: { status: 'succeeded', total: 5 },
        }));
      }

      if (url.startsWith('/api/weekly/workbench/runs')) {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            total: 1,
            runs: [{
              id: 'run_1',
              workflow: 'weekly',
              step: 'suggest',
              status: 'running',
              errorMessage: null,
              startedAt: '2026-06-07T01:00:00.000Z',
            }],
          },
        }));
      }

      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <WeeklyWorkbench issueId={7}>
        <div>编辑区域</div>
      </WeeklyWorkbench>
    );

    expect(screen.getByRole('status', { name: '正在加载工作台状态' })).toBeInTheDocument();
    expect(await screen.findByText('AI Weekly · 2026-06-01 至 2026-06-07')).toBeInTheDocument();
    expect(screen.getByText('3/15')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1 个运行中')).toBeInTheDocument();
    expect(screen.getByText('weekly/suggest')).toBeInTheDocument();
    expect(screen.getByText('编辑区域')).toBeInTheDocument();
  });

  it('renders a setup empty state before the issue is saved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <WeeklyWorkbench issueId={null}>
        <div>新建表单</div>
      </WeeklyWorkbench>
    );

    await waitFor(() => {
      expect(screen.getByText('保存后启用周刊工作台')).toBeInTheDocument();
    });
    expect(screen.getByText('保存周刊基础信息后，候选池、建议和运行记录会在这里加载。')).toBeInTheDocument();
    expect(screen.getByText('新建表单')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows partial load errors without hiding the editor area', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/weekly/7') {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            id: 7,
            issue_number: 42,
            title: 'AI Weekly',
            status: 'draft',
            start_date: '2026-06-01',
            end_date: '2026-06-07',
            total_items: 0,
            contents: [],
          },
        }));
      }

      if (url.startsWith('/api/weekly/workbench/candidates')) {
        return Promise.resolve(apiResponse({
          success: false,
          error: { message: '候选服务不可用' },
        }));
      }

      if (url.startsWith('/api/weekly/workbench/runs')) {
        return Promise.resolve(apiResponse({
          success: false,
          error: { message: 'runs 不可用' },
        }));
      }

      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <WeeklyWorkbench issueId={7}>
        <div>编辑区域</div>
      </WeeklyWorkbench>
    );

    expect(await screen.findByText('工作台状态部分加载失败')).toBeInTheDocument();
    expect(screen.getByText(/候选加载失败：候选服务不可用/)).toBeInTheDocument();
    expect(screen.getByText(/运行记录加载失败：runs 不可用/)).toBeInTheDocument();
    expect(screen.getByText('编辑区域')).toBeInTheDocument();
  });

  it('shows retryable and history-only run states in the status bar', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/weekly/7') {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            id: 7,
            issue_number: 42,
            title: 'AI Weekly',
            status: 'draft',
            start_date: '2026-06-01',
            end_date: '2026-06-07',
            total_items: 0,
            contents: [],
          },
        }));
      }

      if (url.startsWith('/api/weekly/workbench/candidates')) {
        return Promise.resolve(apiResponse({
          success: true,
          data: { status: 'succeeded', total: 5 },
        }));
      }

      if (url.startsWith('/api/weekly/workbench/runs')) {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            total: 1,
            runs: [{
              id: 'run_1',
              workflow: 'score',
              step: 'run',
              status: 'retrying',
              retryable: true,
              historyOnly: true,
              errorMessage: 'temporary failure',
              startedAt: '2026-06-07T01:00:00.000Z',
            }],
          },
        }));
      }

      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <WeeklyWorkbench issueId={7}>
        <div>编辑区域</div>
      </WeeklyWorkbench>
    );

    expect(await screen.findByText('1 个可重试')).toBeInTheDocument();
    expect(screen.getByText('状态已过期，显示历史记录')).toBeInTheDocument();
  });
});

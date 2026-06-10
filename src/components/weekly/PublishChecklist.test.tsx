import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublishChecklist, type PublishChecklistIssue } from './PublishChecklist';

const issue: PublishChecklistIssue = {
  id: 7,
  title: 'AI Weekly',
  status: 'draft',
  start_date: '2026-06-01',
  end_date: '2026-06-07',
  quail_post_slug: null,
  quail_published_at: null,
  quail_delivered_at: null,
  quail_publish_error: null,
};

describe('PublishChecklist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the checklist ready when the issue has 10-15 selected items', () => {
    render(<PublishChecklist issue={issue} selectedCount={12} />);

    expect(screen.getByText('检查项已通过')).toBeInTheDocument();
    expect(screen.getByText('当前 12 篇，建议 10-15 篇')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发布/ })).toBeEnabled();
  });

  it('shows count and Quail errors before publish', () => {
    render(
      <PublishChecklist
        issue={{ ...issue, quail_publish_error: 'Quail down' }}
        selectedCount={8}
      />
    );

    expect(screen.getByText('仍有检查项需要处理')).toBeInTheDocument();
    expect(screen.getByText('当前 8 篇，建议 10-15 篇')).toBeInTheDocument();
    expect(screen.getByText('Quail down')).toBeInTheDocument();
  });

  it('shows published Quail evidence when available', () => {
    render(
      <PublishChecklist
        issue={{
          ...issue,
          status: 'published',
          quail_post_slug: 'weekly-42',
          quail_published_at: '2026-06-07T01:00:00.000Z',
        }}
        selectedCount={12}
      />
    );

    expect(screen.getByText('已发布')).toBeInTheDocument();
    expect(screen.getByText('已发布：weekly-42')).toBeInTheDocument();
  });

  it('publishes through the workbench wrapper after confirmation with idempotency evidence', async () => {
    const onPublished = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve({
      json: async () => ({
        success: true,
        data: { status: 'published', weeklyIssueId: 7, quailPostSlug: 'weekly-42' },
        meta: { runId: 'auto_1', status: 'succeeded' },
      }),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<PublishChecklist issue={issue} selectedCount={12} onPublished={onPublished} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '发布后投递' }));
    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('确认发布周刊')).toBeInTheDocument();
    expect(screen.getByText(/Quail 外部发布并投递/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));

    expect(await screen.findByText('发布请求完成')).toBeInTheDocument();
    expect(screen.getByText(/run auto_1 · succeeded/)).toBeInTheDocument();
    expect(screen.getByText('外部引用：weekly-42')).toBeInTheDocument();
    expect(onPublished).toHaveBeenCalledWith(expect.objectContaining({
      meta: { runId: 'auto_1', status: 'succeeded' },
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/weekly/workbench/7/publish', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': 'weekly-workbench-7-normal-deliver',
      }),
      body: JSON.stringify({ forceRepublish: false, deliver: true }),
    }));
  });

  it('requires force republish before publishing an already published issue', () => {
    render(
      <PublishChecklist
        issue={{
          ...issue,
          status: 'published',
          quail_published_at: '2026-06-07T01:00:00.000Z',
        }}
        selectedCount={12}
      />
    );

    expect(screen.getByRole('button', { name: '发布' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: '强制重新发布' }));

    expect(screen.getByRole('button', { name: '重新发布' })).toBeEnabled();
  });

  it('shows publish errors and failed run evidence', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      json: async () => ({
        success: false,
        error: { code: 'PUBLISH_FAILED', message: 'Quail down' },
        meta: { runId: 'auto_failed', status: 'failed' },
      }),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<PublishChecklist issue={issue} selectedCount={12} />);

    fireEvent.click(screen.getByRole('button', { name: '发布' }));
    fireEvent.click(screen.getByRole('button', { name: '确认发布' }));

    expect(await screen.findByText('发布请求失败')).toBeInTheDocument();
    expect(screen.getByText('Quail down')).toBeInTheDocument();
    expect(screen.getByText(/run auto_failed · failed/)).toBeInTheDocument();
  });
});

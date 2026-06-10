import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AvailableContentsList from './AvailableContentsList';

const candidate = {
  id: 11,
  title: 'Agent 工作流复盘',
  summary: '本周自动化工作流的关键变化',
  content: 'content',
  source: 'Karakeep',
  source_url: 'https://example.com/article',
  original_score: 8,
  summary_score: null,
  category: { id: 1, name: 'AI' },
  tags: [{ id: 1, name: 'Agent' }],
  created_at: '2026-06-07T01:00:00.000Z',
};

describe('AvailableContentsList', () => {
  it('renders candidate metadata, scores, source link and linked state', () => {
    render(
      <AvailableContentsList
        contents={[candidate]}
        loading={false}
        onAddContent={vi.fn()}
        selectedContentIds={[11]}
      />
    );

    expect(screen.getByText('已入刊')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('原文 8')).toBeInTheDocument();
    expect(screen.getByText('摘要未评分')).toBeInTheDocument();
    expect(screen.getByText('Agent 工作流复盘')).toBeInTheDocument();
    expect(screen.getByText('2026-06-07')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /原文/ })).toHaveAttribute('href', 'https://example.com/article');
    expect(screen.getByRole('button', { name: '已添加' })).toBeDisabled();
  });

  it('allows adding unselected candidates', () => {
    const onAddContent = vi.fn();

    render(
      <AvailableContentsList
        contents={[candidate]}
        loading={false}
        onAddContent={onAddContent}
        selectedContentIds={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '添加 Agent 工作流复盘' }));

    expect(onAddContent).toHaveBeenCalledWith(candidate);
  });

  it('shows an actionable empty state', () => {
    render(
      <AvailableContentsList
        contents={[]}
        loading={false}
        onAddContent={vi.fn()}
        selectedContentIds={[]}
      />
    );

    expect(screen.getByText('暂无可用内容')).toBeInTheDocument();
    expect(screen.getByText('去收件箱采集，或调整搜索和分类后刷新。')).toBeInTheDocument();
  });
});

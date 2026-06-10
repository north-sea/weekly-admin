import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyIssueLayout, type WeeklyIssueDetail } from './WeeklyIssueLayout';

describe('WeeklyIssueLayout', () => {
  it('ignores legacy image fields in the weekly output layout', () => {
    const issue: WeeklyIssueDetail = {
      id: 7,
      issue_number: 42,
      title: 'AI Weekly',
      desc: '本期摘要',
      status: 'draft',
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      total_items: 1,
      total_word_count: 1200,
      reading_time: 6,
      contents: [
        {
          id: 11,
          title: 'Agent 工作流复盘',
          summary: '本周自动化工作流的关键变化',
          content: 'content',
          source: 'Karakeep',
          source_url: 'https://example.com/article',
          image_url: 'https://example.com/image.png',
          tags: [],
          created_at: '2026-06-07T01:00:00.000Z',
          section: 'AI',
          featured: true,
        } as any,
      ],
    };

    const { container } = render(<WeeklyIssueLayout issue={issue} />);

    expect(screen.getByText('AI Weekly')).toBeInTheDocument();
    expect(screen.getByText('Agent 工作流复盘')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText(/封面|主图|裁剪|AI 图片/)).not.toBeInTheDocument();
  });
});

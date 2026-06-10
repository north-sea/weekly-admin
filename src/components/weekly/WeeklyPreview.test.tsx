import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WeeklyPreview from './WeeklyPreview';

function apiResponse(body: unknown) {
  return {
    json: async () => body,
  } as Response;
}

describe('WeeklyPreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render legacy image fields in the workbench preview', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(apiResponse({
      success: true,
      data: {
        id: 7,
        issue_number: 42,
        title: 'AI Weekly',
        desc: '本期摘要',
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        cover: 'https://example.com/cover.png',
      },
    }))));

    const { container } = render(
      <WeeklyPreview
        issueId={7}
        contents={[
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
        ]}
      />
    );

    expect(await screen.findByText('AI Weekly')).toBeInTheDocument();
    expect(screen.getByText('Agent 工作流复盘')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText(/封面|主图|裁剪|AI 图片/)).not.toBeInTheDocument();
  });
});

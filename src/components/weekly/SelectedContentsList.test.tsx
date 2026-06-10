import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SelectedContentsList from './SelectedContentsList';

const selectedContent = {
  id: 11,
  title: 'Agent 工作流复盘',
  summary: '本周自动化工作流的关键变化',
  content: 'content',
  source: 'Karakeep',
  tags: [],
  created_at: '2026-06-07T01:00:00.000Z',
  section: 'AI',
  featured: false,
};

describe('SelectedContentsList', () => {
  it('emits section and featured updates for manual editing', () => {
    const onUpdateContent = vi.fn();

    render(
      <SelectedContentsList
        contents={[selectedContent]}
        onRemoveContent={vi.fn()}
        onReorderContents={vi.fn()}
        onUpdateContent={onUpdateContent}
      />
    );

    const sectionInput = screen.getByLabelText('Agent 工作流复盘 栏目');
    fireEvent.change(sectionInput, { target: { value: '工具' } });
    fireEvent.blur(sectionInput);

    expect(onUpdateContent).toHaveBeenCalledWith(expect.objectContaining({
      id: 11,
      section: '工具',
    }));

    fireEvent.click(screen.getByRole('button', { name: '设为精选 Agent 工作流复盘' }));

    expect(onUpdateContent).toHaveBeenCalledWith(expect.objectContaining({
      id: 11,
      featured: true,
    }));
  });

  it('keeps non-drag move controls available', () => {
    render(
      <SelectedContentsList
        contents={[
          selectedContent,
          { ...selectedContent, id: 12, title: '第二篇', section: '工程' },
        ]}
        onRemoveContent={vi.fn()}
        onReorderContents={vi.fn()}
        onUpdateContent={vi.fn()}
      />
    );

    expect(screen.getAllByRole('button', { name: '上移' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '下移' })).toHaveLength(2);
  });
});

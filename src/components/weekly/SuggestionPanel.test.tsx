import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SuggestionPanel } from './SuggestionPanel';

function apiResponse(body: unknown) {
  return {
    json: async () => body,
  } as Response;
}

describe('SuggestionPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders suggestion preview without calling apply', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init) {
        return Promise.resolve(apiResponse({ success: true, data: null }));
      }

      return Promise.resolve(apiResponse({
        success: true,
        data: {
          status: 'preview',
          weeklyIssueId: 7,
          provider: 'admin',
          suggestion: {
            intro: '本期建议聚焦 AI 工具链',
            items: [
              {
                content_id: 10,
                section: 'AI',
                featured: true,
                reason: '评分高且适合作为头条',
                title: 'Agent 运行时更新',
                source_url: 'https://example.com/agent',
                original_score: 8,
                summary_score: 7,
              },
            ],
          },
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestionPanel issueId={7} />);

    fireEvent.click(screen.getByRole('button', { name: /生成建议/ }));

    expect(await screen.findByText('本期建议聚焦 AI 工具链')).toBeInTheDocument();
    expect(screen.getByText('Agent 运行时更新')).toBeInTheDocument();
    expect(screen.getByText('评分高且适合作为头条')).toBeInTheDocument();
    expect(screen.getByText('原文 8')).toBeInTheDocument();
    expect(screen.getByText('摘要 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /原文/ })).toHaveAttribute('href', 'https://example.com/agent');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/weekly/workbench/7/suggest');
    expect(fetchMock).toHaveBeenCalledWith('/api/weekly/workbench/7/suggest', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ maxItems: 12 }),
    }));
  });

  it('loads and displays Hermes preview metadata when available', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init) {
        return Promise.reject(new Error(`unexpected mutation ${String(input)}`));
      }

      return Promise.resolve(apiResponse({
        success: true,
        data: {
          status: 'preview',
          weeklyIssueId: 7,
          provider: 'hermes',
          agentRunId: 'hermes_1',
          sourceRunId: 'auto_hermes',
          confidence: 0.84,
          evidenceRefs: [{ label: 'feedback digest' }],
          suggestion: {
            intro: 'Hermes 建议聚焦偏好命中的 AI 基础设施',
            items: [{
              content_id: 10,
              section: 'AI',
              title: 'Agent 运行时更新',
              reason: '匹配近期偏好',
              confidence: 0.9,
              evidenceRefs: [{ label: 'pref_1' }],
            }],
          },
        },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestionPanel issueId={7} />);

    expect(await screen.findByText('Hermes 建议聚焦偏好命中的 AI 基础设施')).toBeInTheDocument();
    expect(screen.getByText('Hermes')).toBeInTheDocument();
    expect(screen.getByText('置信度 84%')).toBeInTheDocument();
    expect(screen.getByText('feedback digest')).toBeInTheDocument();
    expect(screen.getByText('pref_1')).toBeInTheDocument();
    expect(screen.getByText(/agent hermes_1/)).toBeInTheDocument();
  });

  it('shows generation errors without producing a preview', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init) {
        return Promise.resolve(apiResponse({ success: true, data: null }));
      }

      return Promise.resolve(apiResponse({
        success: false,
        error: { message: '没有可用的候选内容' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestionPanel issueId={7} />);

    fireEvent.click(screen.getByRole('button', { name: /生成建议/ }));

    expect(await screen.findByText('建议生成失败')).toBeInTheDocument();
    expect(screen.getByText('没有可用的候选内容')).toBeInTheDocument();
    expect(screen.queryByText('刷新建议')).not.toBeInTheDocument();
  });

  it('applies the current preview and reports counts', async () => {
    const onApplied = vi.fn();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/suggest')) {
        if (!init) {
          return Promise.resolve(apiResponse({ success: true, data: null }));
        }

        return Promise.resolve(apiResponse({
          success: true,
          data: {
            status: 'preview',
            weeklyIssueId: 7,
            suggestion: {
              items: [
                {
                  content_id: 10,
                  section: 'AI',
                  featured: true,
                  reason: '评分高',
                  title: 'Agent 运行时更新',
                },
              ],
            },
          },
        }));
      }

      if (url.endsWith('/apply')) {
        return Promise.resolve(apiResponse({
          success: true,
          data: {
            status: 'applied',
            weeklyIssueId: 7,
            linkedCount: 1,
            skippedCount: 0,
            replacedCount: 0,
            linkedContents: [{ id: 10, title: 'Agent 运行时更新', section: 'AI' }],
            skippedContents: [],
          },
        }));
      }

      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestionPanel issueId={7} onApplied={onApplied} />);

    fireEvent.click(screen.getByRole('button', { name: /生成建议/ }));
    expect(await screen.findByText('Agent 运行时更新')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '应用建议' }));

    expect(await screen.findByText('建议应用完成')).toBeInTheDocument();
    expect(screen.getByText('新增 1，跳过 0，替换 0')).toBeInTheDocument();
    expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({ linkedCount: 1 }));
    const applyCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/apply'));
    expect(JSON.parse((applyCall?.[1] as RequestInit).body as string)).toEqual({
      replaceExisting: false,
      items: [{ content_id: 10, section: 'AI', featured: true, reason: '评分高' }],
    });
  });

  it('shows apply conflicts as actionable errors', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/suggest')) {
        if (!init) {
          return Promise.resolve(apiResponse({ success: true, data: null }));
        }

        return Promise.resolve(apiResponse({
          success: true,
          data: {
            status: 'preview',
            weeklyIssueId: 7,
            suggestion: {
              items: [{ content_id: 10, section: 'AI', title: 'Agent 运行时更新' }],
            },
          },
        }));
      }

      if (url.endsWith('/apply')) {
        return Promise.resolve(apiResponse({
          success: false,
          error: { message: 'Some content is already linked to another weekly issue' },
        }));
      }

      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SuggestionPanel issueId={7} />);

    fireEvent.click(screen.getByRole('button', { name: /生成建议/ }));
    expect(await screen.findByText('Agent 运行时更新')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '应用建议' }));

    expect(await screen.findByText('建议应用失败')).toBeInTheDocument();
    expect(screen.getByText('Some content is already linked to another weekly issue')).toBeInTheDocument();
  });
});

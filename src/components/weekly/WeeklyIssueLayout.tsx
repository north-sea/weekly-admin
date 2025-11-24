'use client';

import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { Calendar, Tag as TagIcon, ArrowUpRight, Dot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface WeeklyContentItem {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  image_url?: string;
  content: string;
  source?: string;
  source_url?: string;
  category?: {
    id: number;
    name: string;
  } | null;
  tags: Array<{
    id: number;
    name: string;
  }>;
  created_at: string;
  sort_order?: number;
  section?: string;
  featured?: boolean;
  word_count?: number | null;
  reading_time?: number | null;
}

export interface WeeklyIssueDetail {
  id: number;
  issue_number: number;
  title: string;
  description?: string;
  desc?: string;
  cover?: string;
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  total_items: number;
  total_word_count: number;
  reading_time: number;
  published_at?: string;
  contents: WeeklyContentItem[];
}

const statusLabel: Record<WeeklyIssueDetail['status'], string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY年M月D日') : value;
};

const extractImageFromMarkdown = (markdown: string) => {
  const match = markdown.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : null;
};

const buildSummary = (content: WeeklyContentItem) => {
  if (content.summary) return content.summary;
  if (content.description) return content.description;
  if (!content.content) return '';

  const clean = content.content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177)}...`;
};

const computeWordCount = (content: WeeklyContentItem) => {
  if (content.word_count && content.word_count > 0) return content.word_count;
  if (!content.content) return 0;
  return content.content.split(/\s+/).filter(Boolean).length;
};

const computeReadingTime = (content: WeeklyContentItem) => {
  if (content.reading_time && content.reading_time > 0) return content.reading_time;
  const words = computeWordCount(content);
  if (!words) return 0;
  return Math.max(1, Math.ceil(words / 200));
};

const formatLargeNumber = (value: number) => {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}w`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return value.toString();
};

const WeeklyContentCard: React.FC<{
  content: WeeklyContentItem;
  index: number;
}> = ({ content, index }) => {
  const cover = content.image_url || extractImageFromMarkdown(content.content || '');
  const summary = buildSummary(content);

  return (
    <article className="group mb-6 break-inside-avoid overflow-hidden rounded-xl border bg-card shadow-sm ring-1 ring-border/50 transition hover:-translate-y-0.5 hover:shadow-md">
      {cover && (
        <div className="overflow-hidden bg-muted px-4 pt-4">
          <img
            src={cover}
            alt={content.title}
            className="w-full rounded-lg object-contain transition duration-300 group-hover:scale-[1.01]"
            style={{ maxHeight: 320 }}
          />
        </div>
      )}

      <div className="space-y-3 px-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground">
              <TagIcon className="h-3 w-3" />
              {content.section || '未分类'}
            </span>
            {content.tags && content.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-300"
              >
                {tag.name}
              </span>
            ))}
            {content.tags && content.tags.length > 4 && (
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                +{content.tags.length - 4}
              </span>
            )}
          </div>

          {content.source && (
            <a
              href={content.source_url || undefined}
              target={content.source_url ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:text-primary"
            >
              {content.source}
              {content.source_url && <ArrowUpRight className="h-3.5 w-3.5" />}
            </a>
          )}
        </div>

        <a
          href={content.source_url || undefined}
          target={content.source_url ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="block text-lg font-semibold text-amber-600 underline-offset-4 hover:text-amber-700 hover:underline dark:text-amber-300"
        >
          {content.title}
        </a>

        {summary && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Dot className="h-4 w-4 text-amber-500" />
            {`#${index}`}
          </span>
          {content.created_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {dayjs(content.created_at).format('YYYY-MM-DD')}
            </span>
          )}
          {content.featured && (
            <Badge variant="secondary" className="text-[11px]">
              精选
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
};

interface WeeklyIssueLayoutProps {
  issue: WeeklyIssueDetail;
  footerNote?: string;
}

export const WeeklyIssueLayout: React.FC<WeeklyIssueLayoutProps> = ({ issue, footerNote }) => {
  const contents = issue.contents || [];

  const groupedContents = useMemo(() => {
    return contents.reduce((groups: Record<string, WeeklyContentItem[]>, content) => {
      const section = content.section || content.category?.name || '未分类';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(content);
      return groups;
    }, {});
  }, [contents]);

  const stats = useMemo(() => {
    const totalItems = Number(issue.total_items || contents.length);
    const issueWordCount = Number(issue.total_word_count || 0);
    const issueReadingTime = Number(issue.reading_time || 0);

    const totalWordCount =
      issueWordCount > 0
        ? issueWordCount
        : contents.reduce((sum, content) => sum + computeWordCount(content), 0);

    const readingMinutes =
      issueReadingTime > 0
        ? issueReadingTime
        : contents.reduce((sum, content) => sum + computeReadingTime(content), 0);

    return {
      totalItems,
      totalWordCount,
      readingMinutes,
      sectionCount: Object.keys(groupedContents).length,
    };
  }, [contents, groupedContents, issue.reading_time, issue.total_items, issue.total_word_count]);

  const description = issue.desc || issue.description;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <article className="overflow-hidden rounded-2xl border bg-card shadow-sm ring-1 ring-border/50">
          {issue.cover && (
            <img
              src={issue.cover}
              alt={issue.title}
              className="h-48 w-full object-cover md:h-56"
            />
          )}
          <div className="space-y-4 px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Weekly</span>
              <Badge variant="secondary" className="ml-1">
                第 {issue.issue_number} 期
              </Badge>
              <Badge variant={issue.status === 'published' ? 'default' : 'secondary'}>
                {statusLabel[issue.status]}
              </Badge>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
                {issue.title}
              </h1>
              {description && (
                <p className="text-base leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatDate(issue.start_date) || formatDate(issue.published_at) || formatDate(issue.end_date)}</span>
              <span className="inline-flex items-center gap-1 text-primary">
                阅读
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card/60 px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">篇内容</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.totalItems}</div>
        </div>
        <div className="rounded-xl border bg-card/60 px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">字数</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-500">
            {formatLargeNumber(stats.totalWordCount)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">字</span>
          </div>
        </div>
        <div className="rounded-xl border bg-card/60 px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">分钟阅读</div>
          <div className="mt-1 text-2xl font-semibold text-amber-500">
            {stats.readingMinutes}
          </div>
        </div>
        <div className="rounded-xl border bg-card/60 px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground">个分类</div>
          <div className="mt-1 text-2xl font-semibold text-purple-500">
            {stats.sectionCount}
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-8">
        {Object.entries(groupedContents).map(([section, sectionContents]) => (
          <div key={section} className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-primary">{section}</h2>
              <Badge variant="secondary">{sectionContents.length}</Badge>
            </div>
            <div
              className="columns-1 md:columns-2"
              style={{ columnGap: '1.5rem' }}
            >
              {sectionContents.map((content, index) => (
                <WeeklyContentCard
                  key={content.id}
                  content={content}
                  index={index + 1}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {footerNote && (
        <div className="rounded-xl border bg-muted/50 p-4 text-center text-xs text-muted-foreground">
          {footerNote}
        </div>
      )}
    </div>
  );
};

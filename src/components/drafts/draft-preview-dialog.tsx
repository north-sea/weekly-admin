'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import StructuredPreview, { type StructuredPreviewData } from '@/components/content/StructuredPreview';
import type { Draft } from '@/hooks/queries/useDraftQueries';
import dayjs from 'dayjs';

interface DraftPreviewDialogProps {
  draft?: Draft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildPreviewData(draft: Draft): StructuredPreviewData {
  let tags: Array<{ id?: number | string; name: string; attachedBy?: string }> = [];
  try {
    if (draft.tags_suggestion) {
      tags = JSON.parse(draft.tags_suggestion);
    }
  } catch {
    tags = [];
  }

  // 从URL提取域名作为source
  const getSourceFromUrl = (url?: string): string => {
    if (!url) return '';
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  const description = draft.description || draft.note || undefined;
  const summary = draft.summary || description;

  return {
    title: draft.title,
    description,
    summary,
    url: draft.url || undefined,
    image_url: draft.image_url || undefined,
    source: draft.source || getSourceFromUrl(draft.url) || undefined,
    source_url: draft.url || undefined,
    tags: tags.map((tag, idx) => ({ id: tag.id ?? idx, name: tag.name })),
    created_at: draft.karakeep_created_at || undefined,
    content: draft.content || undefined,
  };
}

export function DraftPreviewDialog({ draft, open, onOpenChange }: DraftPreviewDialogProps) {
  if (!draft) {
    return null;
  }

  const previewData = buildPreviewData(draft);
  const aiTags: Array<{ id?: number | string; name: string; attachedBy?: string }> = (() => {
    try {
      return draft.tags_suggestion ? JSON.parse(draft.tags_suggestion) : [];
    } catch {
      return [];
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="flex flex-col">
          <div className="px-6 py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {draft.source || 'Karakeep Draft'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-snug text-slate-900">
              {draft.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              添加于 {draft.karakeep_created_at ? dayjs(draft.karakeep_created_at).format('YYYY-MM-DD HH:mm') : '未知时间'}
            </p>
          </div>
          <Separator />
          <div className="grid grid-cols-[3fr_2fr] divide-x divide-slate-200">
            <ScrollArea className="h-[70vh]">
              <div className="space-y-4 p-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <StructuredPreview
                    data={previewData}
                    mode="desktop"
                    showMeta
                  />
                </div>
                {draft.content && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 shadow-sm">
                    <p className="font-semibold text-slate-900 mb-2">原始备注</p>
                    <p className="whitespace-pre-line leading-relaxed">{draft.content}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="h-[70vh] space-y-4 overflow-y-auto bg-slate-50/70 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI 分类</p>
                <Badge variant="outline" className="text-sm">
                  {draft.category_suggestion || '未提供'}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">标签建议</p>
                <div className="flex flex-wrap gap-2">
                  {aiTags.length === 0 && (
                    <span className="text-sm text-muted-foreground">暂无建议</span>
                  )}
                  {aiTags.map((tag, idx) => (
                    <Badge key={tag.id || idx} variant="secondary" className="text-xs">
                      {tag.attachedBy === 'ai' ? '🤖' : '🏷️'} {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
              {draft.summary && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">AI 摘要</p>
                  <p className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                    {draft.summary}
                  </p>
                </div>
              )}
              {draft.note && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Karakeep 备注</p>
                  <p className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                    {draft.note}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

  return {
    title: draft.title,
    description: draft.description || draft.note || undefined,
    summary: draft.description || draft.note || undefined,
    url: draft.url || undefined,
    image_url: draft.image_url || undefined,
    source: draft.source || getSourceFromUrl(draft.url) || undefined,
    source_url: draft.url || undefined,
    tags: tags.map((tag, idx) => ({ id: tag.id ?? idx, name: tag.name })) ,
    created_at: draft.karakeep_created_at || undefined,
    content: draft.content || undefined,
  };
}

export function DraftPreviewDialog({ draft, open, onOpenChange }: DraftPreviewDialogProps) {
  if (!draft) {
    return null;
  }

  const previewData = buildPreviewData(draft);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="text-xl font-semibold">{draft.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            添加于 {draft.karakeep_created_at ? dayjs(draft.karakeep_created_at).format('YYYY-MM-DD HH:mm') : '未知时间'}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ScrollArea className="h-[65vh]">
          <div className="px-6 py-4 space-y-4">
            {draft.category_suggestion && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">AI 分类建议：</span>
                <Badge variant="outline">{draft.category_suggestion}</Badge>
              </div>
            )}

            {draft.tags_suggestion && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">标签建议：</span>
                {(() => {
                  try {
                    const tags = JSON.parse(draft.tags_suggestion || '[]');
                    return tags.map((tag: { id?: number; name: string; attachedBy?: string }, idx: number) => (
                      <Badge
                        key={tag.id || idx}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag.attachedBy === 'ai' ? '🤖' : '🏷️'} {tag.name}
                      </Badge>
                    ));
                  } catch {
                    return null;
                  }
                })()}
              </div>
            )}

            <Separator />

            <div className="bg-muted/30 rounded-lg p-4">
              <StructuredPreview
                data={previewData}
                mode="desktop"
                showMeta
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

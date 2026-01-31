'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export interface LinkedContent {
  id: number;
  title: string;
}

export interface SkippedContent {
  id: number;
  title: string;
  reason: string;
}

export interface LinkResultData {
  linkedCount: number;
  skippedCount: number;
  linkedContents: LinkedContent[];
  skippedContents: SkippedContent[];
  issueNumber?: number;
  issueTitle?: string;
}

interface LinkResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: LinkResultData | null;
  title?: string;
}

/**
 * 关联结果摘要弹窗
 * 显示关联成功和跳过的内容列表
 */
export function LinkResultDialog({
  open,
  onOpenChange,
  data,
  title = '关联结果',
}: LinkResultDialogProps) {
  if (!data) return null;

  const { linkedCount, skippedCount, linkedContents, skippedContents, issueNumber, issueTitle } = data;
  const totalProcessed = linkedCount + skippedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {linkedCount > 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {issueNumber && issueTitle && (
              <span>
                目标周刊：第 {issueNumber} 期 - {issueTitle}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 统计摘要 */}
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-emerald-500">
                成功 {linkedCount}
              </Badge>
            </div>
            {skippedCount > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  跳过 {skippedCount}
                </Badge>
              </div>
            )}
            <div className="ml-auto text-sm text-slate-500">
              共处理 {totalProcessed} 篇
            </div>
          </div>

          {/* 关联成功列表 */}
          {linkedContents.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                已关联内容
              </h4>
              <ScrollArea className="h-32 rounded-md border border-slate-200">
                <div className="p-2 space-y-1">
                  {linkedContents.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                    >
                      <span className="text-slate-400">#{content.id}</span>
                      <span className="truncate text-slate-700">{content.title}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 跳过列表 */}
          {skippedContents.length > 0 && (
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <XCircle className="h-4 w-4 text-slate-400" />
                跳过内容
              </h4>
              <ScrollArea className="h-32 rounded-md border border-slate-200">
                <div className="p-2 space-y-1">
                  {skippedContents.map((content) => (
                    <div
                      key={content.id}
                      className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-400">#{content.id}</span>
                        <span className="truncate text-slate-700">{content.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {content.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 无内容提示 */}
          {linkedContents.length === 0 && skippedContents.length === 0 && (
            <div className="py-8 text-center text-slate-500">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2">没有找到可关联的内容</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

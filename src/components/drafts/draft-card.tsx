'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Eye,
  Check,
  X,
  ExternalLink,
  Star,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Draft } from '@/hooks/queries/useDraftQueries';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface DraftCardProps {
  draft: Draft;
  onPreview?: (draft: Draft) => void;
  onAdopt?: (draft: Draft) => void;
  onReject?: (draft: Draft) => void;
  onDelete?: (draft: Draft) => void;
  selected?: boolean;
  onSelect?: (draft: Draft, selected: boolean) => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return { variant: 'secondary' as const, label: '待处理', color: 'text-yellow-600' };
    case 'adopted':
      return { variant: 'default' as const, label: '已采用', color: 'text-green-600' };
    case 'rejected':
      return { variant: 'destructive' as const, label: '已拒绝', color: 'text-red-600' };
    default:
      return { variant: 'outline' as const, label: status, color: 'text-gray-600' };
  }
};

const getHostnameFromUrl = (url?: string): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    try {
      return new URL(`https://${url}`).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
};

export function DraftCard({
  draft,
  onPreview,
  onAdopt,
  onReject,
  onDelete,
  selected = false,
  onSelect,
}: DraftCardProps) {
  const statusConfig = getStatusConfig(draft.status);
  const hostname = getHostnameFromUrl(draft.url);
  
  // 解析标签
  let tags: Array<{ id?: number; name: string; attachedBy?: string }> = [];
  try {
    if (draft.tags_suggestion) {
      tags = JSON.parse(draft.tags_suggestion);
    }
  } catch {
    tags = [];
  }

  // 渲染优先级星星
  const renderPriority = () => {
    if (!draft.priority || draft.priority === 0) return null;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: Math.min(draft.priority, 5) }).map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
    );
  };

  return (
    <Card
      className={cn(
        'group relative transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
    >
      {/* 复选框 */}
      {onSelect && (
        <div className="absolute left-3 top-3 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(draft, checked as boolean)}
            className="bg-background"
          />
        </div>
      )}

      <CardHeader className={cn('pb-3', onSelect && 'pl-10')}>
        {/* 状态和优先级 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant={statusConfig.variant} className="text-xs">
            {statusConfig.label}
          </Badge>
          {renderPriority()}
        </div>

        {/* 标题 */}
        <CardTitle className="text-base line-clamp-2 leading-snug">
          {draft.title}
        </CardTitle>

        {/* 来源 */}
        <div className="flex items-center gap-2 pt-1">
          {draft.favicon_url && (
            <Avatar className="h-4 w-4">
              <AvatarImage src={draft.favicon_url} alt={hostname} />
              <AvatarFallback className="text-[10px]">
                {hostname.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <a
            href={draft.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate max-w-[180px]">{hostname || '本地内容'}</span>
            {draft.url && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
          </a>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* 描述/摘要 */}
        {(draft.description || draft.note) && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {draft.description || draft.note}
          </p>
        )}

        {/* 封面图 */}
        {draft.image_url && (
          <div className="relative w-full h-32 rounded overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.image_url}
              alt={draft.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* 分类建议 */}
        {draft.category_suggestion && (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              📁 {draft.category_suggestion}
            </Badge>
          </div>
        )}

        {/* 标签 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag, idx) => (
              <Badge
                key={tag.id || idx}
                variant="secondary"
                className={cn(
                  'text-xs',
                  tag.attachedBy === 'ai' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                )}
              >
                {tag.attachedBy === 'ai' && <Sparkles className="h-3 w-3 mr-1" />}
                {tag.name}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* 时间信息 */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{dayjs(draft.karakeep_created_at).fromNow()}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-0 pb-3 flex flex-wrap gap-2">
        {/* 预览按钮 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreview?.(draft)}
          className="flex-1 min-w-[80px]"
        >
          <Eye className="h-4 w-4 mr-1" />
          预览
        </Button>

        {/* 待处理状态的操作按钮 */}
        {draft.status === 'pending' && (
          <>
            {onAdopt && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onAdopt(draft)}
                className="flex-1 min-w-[80px]"
              >
                <Check className="h-4 w-4 mr-1" />
                采用
              </Button>
            )}
            {onReject && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onReject(draft)}
                className="flex-1 min-w-[80px]"
              >
                <X className="h-4 w-4 mr-1" />
                拒绝
              </Button>
            )}
          </>
        )}

        {/* 删除按钮 */}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(draft)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

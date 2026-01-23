'use client';

import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ScoreDetails = {
  reasons?: string[];
  [key: string]: unknown;
};

interface AIScoreDisplayProps {
  label: string;
  score: number | null | undefined;
  details?: ScoreDetails | null;
}

const formatScore = (score: number) => {
  if (Number.isInteger(score)) return `${score}`;
  return `${Math.round(score * 10) / 10}`;
};

export function AIScoreDisplay({ label, score, details }: AIScoreDisplayProps) {
  const [open, setOpen] = useState(false);
  const reasons = useMemo(() => details?.reasons?.filter(Boolean) ?? [], [details]);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Badge variant={score === null || score === undefined ? 'secondary' : 'default'}>
          {score === null || score === undefined ? '未评分' : formatScore(score)}
        </Badge>
        {reasons.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setOpen(true)}>
            详情
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{label} 评分详情</DialogTitle>
            <DialogDescription>评分维度与简要理由（来自 AI）</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Score</span>
              <Badge>{score === null || score === undefined ? '未评分' : formatScore(score)}</Badge>
            </div>
            {reasons.length > 0 && (
              <ul className="list-disc pl-5 space-y-1">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


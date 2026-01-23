'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

interface AIScoreButtonProps {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

export function AIScoreButton({ label, onClick, disabled, loading }: AIScoreButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || loading}
      className="h-8"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          评分中
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}


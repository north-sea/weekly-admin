import React from 'react';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullscreen?: boolean;
  className?: string;
}

export default function LoadingSpinner({
  size = 'medium',
  text = '加载中...',
  fullscreen = true,
  className,
}: LoadingSpinnerProps) {
  const sizeClassName = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-[3px]',
    large: 'h-12 w-12 border-4',
  }[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullscreen ? 'min-h-screen bg-background' : undefined,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'animate-spin rounded-full border-muted-foreground/25 border-t-foreground',
            sizeClassName
          )}
          aria-hidden="true"
        />
        {text ? <span className="text-sm text-muted-foreground">{text}</span> : null}
      </div>
    </div>
  );
}

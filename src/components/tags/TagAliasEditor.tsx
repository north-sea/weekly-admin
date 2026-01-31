'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagAliasEditorProps {
  aliases: string[];
  onChange: (aliases: string[]) => void;
  maxAliases?: number;
  disabled?: boolean;
  className?: string;
}

export function TagAliasEditor({
  aliases,
  onChange,
  maxAliases = 20,
  disabled = false,
  className,
}: TagAliasEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('别名不能为空');
      return;
    }

    if (aliases.includes(trimmed)) {
      setError('别名已存在');
      return;
    }

    if (aliases.length >= maxAliases) {
      setError(`最多只能添加 ${maxAliases} 个别名`);
      return;
    }

    onChange([...aliases, trimmed]);
    setInputValue('');
    setError(null);
  };

  const handleRemove = (alias: string) => {
    onChange(aliases.filter((a) => a !== alias));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入别名，如 ReactJS、react.js"
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={disabled || !inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {aliases.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {aliases.map((alias) => (
            <Badge
              key={alias}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {alias}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(alias)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          暂无别名。添加别名后，搜索时可以匹配到此标签。
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        已添加 {aliases.length}/{maxAliases} 个别名
      </p>
    </div>
  );
}

"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  variant?: "plain" | "card";
  className?: string;
};

function ErrorState({
  title = "加载失败",
  description,
  onRetry,
  retryLabel = "重试",
  action,
  variant = "plain",
  className,
}: ErrorStateProps) {
  const retryButton = onRetry ? (
    <Button type="button" variant="outline" size="sm" onClick={onRetry}>
      {retryLabel}
    </Button>
  ) : null;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        variant === "card"
          ? "rounded-md border border-destructive/25 bg-destructive/5"
          : "rounded-md bg-destructive/5",
        className
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="mt-5 flex items-center gap-2">
        {retryButton}
        {action}
      </div>
    </div>
  );
}

export { ErrorState };

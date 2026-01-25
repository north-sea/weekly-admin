"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type FormMessageProps = {
  variant?: "error" | "success" | "hint";
  withIcon?: boolean;
  id?: string;
  className?: string;
  children?: React.ReactNode;
};

function FormMessage({
  variant = "error",
  withIcon = true,
  id,
  className,
  children,
}: FormMessageProps) {
  if (!children) return null;

  const Icon =
    variant === "success" ? CheckCircle2 : variant === "hint" ? Info : AlertCircle;

  return (
    <p
      id={id}
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-1.5 text-sm",
        variant === "error"
          ? "text-destructive"
          : variant === "success"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-muted-foreground",
        className
      )}
    >
      {withIcon ? <Icon className="mt-0.5 h-4 w-4" aria-hidden="true" /> : null}
      <span>{children}</span>
    </p>
  );
}

export { FormMessage };


"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  confirmLoadingText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  initialFocus?: "cancel" | "confirm";
  onConfirm: () => void | Promise<void>;
};

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确认",
  confirmLoadingText,
  cancelText = "取消",
  variant = "default",
  initialFocus,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = React.useState(false);

  const resolvedInitialFocus = initialFocus ?? (variant === "destructive" ? "cancel" : "confirm");

  const handleOpenChange = (nextOpen: boolean) => {
    if (confirming) return;
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (confirming) return;
    try {
      setConfirming(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Keep the dialog open on errors; callers should surface feedback via toast.
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const target = resolvedInitialFocus === "cancel" ? cancelRef.current : confirmRef.current;
            target?.focus();
          });
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {cancelText}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={variant}
            onClick={handleConfirm}
            loading={confirming}
            loadingText={confirmLoadingText ?? confirmText}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDialog };


"use client"

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const statusIcon =
          variant === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : variant === "warning" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden="true" />
          ) : variant === "destructive" ? (
            <XCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          ) : null

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              {statusIcon}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

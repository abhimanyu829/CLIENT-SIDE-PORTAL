"use client"

import { useToast } from "@/hooks/use-toast"
import { X, CheckCircle, AlertCircle, Info } from "lucide-react"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`p-4 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-300 pointer-events-auto flex items-start justify-between gap-3 animate-in fade-in-50 slide-in-from-bottom-5 ${
            t.variant === "destructive"
              ? "bg-destructive/90 text-destructive-foreground border-destructive"
              : t.variant === "success"
              ? "bg-emerald-950/80 text-emerald-100 border-emerald-800"
              : "bg-background/90 text-foreground border-border"
          }`}
        >
          <div className="flex gap-2">
            {t.variant === "destructive" && <AlertCircle className="h-5 w-5 shrink-0 text-red-300" />}
            {t.variant === "success" && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />}
            {!t.variant || t.variant === "default" && <Info className="h-5 w-5 shrink-0 text-blue-400" />}
            
            <div className="grid gap-1">
              {t.title && <p className="font-semibold text-sm leading-none">{t.title}</p>}
              {t.description && <p className="text-xs opacity-90 leading-normal">{t.description}</p>}
            </div>
          </div>

          <button
            onClick={() => dismiss(t.id)}
            className="text-foreground/50 hover:text-foreground shrink-0 rounded-md p-0.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

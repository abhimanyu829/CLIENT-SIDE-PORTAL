"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2 } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void> | void
  title: string
  description: string
  requireReason?: boolean
  reasonLabel?: string
  confirmLabel?: string
  destructive?: boolean
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  requireReason = true,
  reasonLabel = "Reason (required)",
  confirmLabel = "Confirm",
  destructive = true,
  children,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError("Please provide a reason.")
      return
    }
    setLoading(true)
    try {
      await onConfirm(reason.trim())
      setReason("")
      setError("")
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !loading) {
          setReason("")
          setError("")
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {destructive && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            )}
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-0.5">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {requireReason && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError("")
              }}
              placeholder="Describe the reason for this action..."
              rows={3}
              className="resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {children}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading || (requireReason && !reason.trim())}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

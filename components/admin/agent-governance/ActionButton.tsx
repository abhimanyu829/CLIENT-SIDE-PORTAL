"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, type ButtonProps } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useToast } from "@/hooks/use-toast"
import { describeFailure, sendGovernance } from "./governance-client"

export interface ConfirmSpec {
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  /** When true the administrator must type a reason; it is sent as `reason` and audited. */
  requireReason?: boolean
}

export interface ActionButtonProps {
  label: string
  url: string
  method?: "POST" | "PATCH" | "PUT" | "DELETE"
  body?: Record<string, unknown>
  confirm?: ConfirmSpec
  successMessage: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  /** Receives the response data (e.g. a one-time secret). */
  onSuccess?: (data: Record<string, unknown>) => void
}

/**
 * One governance action: optional confirmation (dangerous operations),
 * one JSON request to one specific route, a toast, and a server refresh of
 * the page (router.refresh — the existing admin revalidation pattern). A
 * conflict refreshes too, so the administrator sees the current state.
 */
export function ActionButton({ label, url, method = "POST", body, confirm, successMessage, variant = "outline", size = "sm", onSuccess }: ActionButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  async function run(reason?: string) {
    setBusy(true)
    try {
      const result = await sendGovernance(url, { method, body: reason ? { ...(body ?? {}), reason } : body })
      if (!result.ok) {
        const failure = describeFailure(result)
        toast({ title: failure.title, description: failure.description, variant: "destructive" })
        if (result.status === 409) startTransition(() => router.refresh())
        // Keeps the confirmation dialog open with the message.
        throw new Error(failure.description)
      }
      toast({ title: successMessage, variant: "success" })
      onSuccess?.(result.data ?? {})
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }

  if (!confirm) {
    return (
      <Button type="button" variant={variant} size={size} disabled={busy} onClick={() => run().catch(() => undefined)}>
        {label}
      </Button>
    )
  }
  return (
    <>
      <Button type="button" variant={confirm.destructive ? "destructive" : variant} size={size} disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(reason) => run(reason || undefined)}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel ?? label}
        destructive={confirm.destructive ?? false}
        requireReason={confirm.requireReason ?? false}
      />
    </>
  )
}

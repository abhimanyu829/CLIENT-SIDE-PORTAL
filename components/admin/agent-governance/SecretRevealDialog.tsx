"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface RevealedSecret {
  label: string
  value: string
}

/**
 * Shows a credential or webhook secret exactly once. The value lives only in
 * this component's props until the dialog is closed; it is never written to
 * storage, logs or the URL, and cannot be shown again.
 */
export function SecretRevealDialog({ open, title, secrets, onClose }: { open: boolean; title: string; secrets: RevealedSecret[]; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (s: RevealedSecret) => {
    try {
      await navigator.clipboard.writeText(s.value)
      setCopied(s.label)
    } catch {
      setCopied(null)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setCopied(null)
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Copy it now and store it in your secret manager. It is shown only once and cannot be retrieved later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {secrets.map((s, i) => (
            <div key={s.label} className="space-y-1">
              <Label htmlFor={`secret-${i}`}>{s.label}</Label>
              <div className="flex gap-2">
                <Input id={`secret-${i}`} readOnly value={s.value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" onClick={() => copy(s)}>
                  Copy
                </Button>
              </div>
            </div>
          ))}
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {copied ? `${copied} copied to the clipboard.` : ""}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            I have stored it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

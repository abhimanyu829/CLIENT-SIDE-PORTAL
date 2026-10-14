"use client"
import Link from "next/link"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"

type AuthConsentBlockProps = {
  /** Controlled checked state. Omit to let the block manage its own state. */
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Validation message shown when the user tries to continue without accepting. */
  error?: string | null
}

export function AuthConsentBlock({ checked, onCheckedChange, error }: AuthConsentBlockProps = {}) {
  const [internal, setInternal] = useState(false)
  const isControlled = checked !== undefined
  const value = isControlled ? checked : internal

  function update(next: boolean) {
    if (!isControlled) setInternal(next)
    onCheckedChange?.(next)
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-sm font-medium text-foreground">Before you sign in</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Marketplace access requires authenticating and accepting the current <Link href="/terms" className="underline underline-offset-4">Terms</Link> and <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>. After sign-in, explicit acceptance is recorded server-side.
      </p>
      <label className="mt-3 flex items-start gap-2 cursor-pointer rounded-lg border border-border/50 bg-muted/20 p-2.5">
        <Checkbox
          checked={value}
          onCheckedChange={(v) => update(!!v)}
          aria-label="I have read and agree to Terms and Privacy Policy"
          aria-invalid={!!error}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground">I have read and agree to the Terms & Conditions and Privacy Policy.</span>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Required before marketplace access. Cookie choices are separate.</p>
    </div>
  )
}

"use client"
import { useState, type FormEvent, type ReactNode } from "react"
import { AuthConsentBlock } from "./AuthConsentBlock"

const VALIDATION_MESSAGE =
  "Please tick the box to accept the Terms & Conditions and Privacy Policy before continuing."

/**
 * Places the legal acknowledgment at the bottom of the existing login/signup
 * interface and prevents the Clerk form (any descendant <form>) from being
 * submitted until the box is checked.
 *
 * The guard is defensive: it only calls preventDefault when the box is
 * unchecked, so a checked box is never blocked, and it is a no-op if the
 * hosted Clerk UI does not emit a native form submit event. The authoritative
 * gate is still server-side (proxy + page/API consent checks).
 */
export function AuthConsentGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmitCapture(event: FormEvent<HTMLDivElement>) {
    if (checked) return
    event.preventDefault()
    event.stopPropagation()
    setError(VALIDATION_MESSAGE)
  }

  return (
    <div onSubmitCapture={handleSubmitCapture}>
      {children}
      <div className="mt-6">
        <AuthConsentBlock
          checked={checked}
          onCheckedChange={(next) => {
            setChecked(next)
            if (next) setError(null)
          }}
          error={error}
        />
      </div>
    </div>
  )
}

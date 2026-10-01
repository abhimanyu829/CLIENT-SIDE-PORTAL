"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { describeFailure, sendGovernance } from "./governance-client"
import { SecretRevealDialog, type RevealedSecret } from "./SecretRevealDialog"
import { selectClass } from "./ui"

/** Registers a new agent connection through the EXISTING Phase 2 route; the credential is shown once. */
export function CreateConnectionForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secrets, setSecrets] = useState<RevealedSecret[] | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const value = (k: string) => String(form.get(k) ?? "").trim()
    const expires = value("expiresAt")
    const body: Record<string, unknown> = {
      name: value("name"),
      provider: value("provider"),
      ownerId: value("ownerId"),
      environment: value("environment") || undefined,
      authMethod: value("authMethod") || undefined,
      ...(value("teamId") ? { teamId: value("teamId") } : {}),
      ...(value("externalAgentId") ? { externalAgentId: value("externalAgentId") } : {}),
      // datetime-local inputs on governance forms are explicitly UTC.
      ...(expires ? { expiresAt: new Date(`${expires}Z`).toISOString() } : {}),
    }
    setBusy(true)
    setError(null)
    const result = await sendGovernance<{ connection?: { id: string }; credential?: { bearerToken?: string; keyId?: string; signingSecret?: string } }>("/api/admin/agent-connections", { body })
    setBusy(false)
    if (!result.ok) {
      const failure = describeFailure(result)
      setError(failure.description)
      return
    }
    const c = result.data?.credential ?? {}
    const shown: RevealedSecret[] = []
    if (c.bearerToken) shown.push({ label: "Bearer token", value: c.bearerToken })
    if (c.keyId) shown.push({ label: "Key id", value: c.keyId })
    if (c.signingSecret) shown.push({ label: "Signing secret", value: c.signingSecret })
    toast({ title: "Connection created", variant: "success" })
    formEl.reset()
    setSecrets(shown)
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="create-connection-heading" className="space-y-3 rounded-lg border p-4">
      <h3 id="create-connection-heading" className="font-medium">
        Register an agent connection
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="cc-name">Name</Label>
          <Input id="cc-name" name="name" required minLength={2} maxLength={120} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-provider">Provider</Label>
          <Input id="cc-provider" name="provider" required maxLength={60} placeholder="claude, custom, ..." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-owner">Owner user id</Label>
          <Input id="cc-owner" name="ownerId" required maxLength={64} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-team">Team id (optional)</Label>
          <Input id="cc-team" name="teamId" maxLength={64} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-external">External agent id (optional)</Label>
          <Input id="cc-external" name="externalAgentId" maxLength={200} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-env">Environment</Label>
          <select id="cc-env" name="environment" defaultValue="development" className={`${selectClass} w-full`}>
            <option value="development">development</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-auth">Authentication</Label>
          <select id="cc-auth" name="authMethod" defaultValue="BEARER" className={`${selectClass} w-full`}>
            <option value="BEARER">Bearer token</option>
            <option value="SIGNED_REQUEST">Signed requests (HMAC)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cc-expires">Expires, UTC (optional)</Label>
          <Input id="cc-expires" name="expiresAt" type="datetime-local" />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create connection"}
      </Button>
      <SecretRevealDialog
        open={!!secrets}
        title="New connection credential"
        secrets={secrets ?? []}
        onClose={() => {
          setSecrets(null)
          startTransition(() => router.refresh())
        }}
      />
    </form>
  )
}

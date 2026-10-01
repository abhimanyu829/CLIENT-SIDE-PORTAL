"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useToast } from "@/hooks/use-toast"
import { describeFailure, sendGovernance } from "./governance-client"
import { ActionButton } from "./ActionButton"
import { selectClass } from "./ui"

const LEVELS = ["OBSERVE_ONLY", "ASSISTED", "APPROVAL_REQUIRED", "LIMITED_AUTONOMY", "FULL_SCOPED_AUTONOMY"] as const
const TIERS = ["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"] as const
const ENVS = ["development", "staging", "production"] as const

export interface AutonomyEditorProps {
  connectionId: string
  active: {
    version: number
    autonomyLevel: string
    maxRiskTier: string
    allowedCapabilityIds: string[]
    approvalRequiredFor: string[]
    environmentScope: string[]
    expiresAt: string | null
    note: string | null
  } | null
  /** Optimistic-concurrency token: the newest version number (0 = never configured). */
  latestVersion: number
}

const list = (raw: string) =>
  raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * Edits a connection's Phase 7 autonomy policy through the EXISTING autonomy
 * route, with optimistic concurrency (`expectedVersion`). Raising autonomy
 * (full scoped autonomy, or high-risk / critical tiers) needs an explicit
 * confirmation. Autonomy only ever narrows what Phase 6 already allows.
 */
export function AutonomyEditor({ connectionId, active, latestVersion }: AutonomyEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const url = `/api/admin/agent-connections/${encodeURIComponent(connectionId)}/autonomy`

  async function save(body: Record<string, unknown>) {
    const result = await sendGovernance(url, { method: "PUT", body })
    if (!result.ok) {
      const failure = describeFailure(result)
      toast({ title: failure.title, description: failure.description, variant: "destructive" })
      if (result.status === 409) startTransition(() => router.refresh())
      throw new Error(failure.description)
    }
    toast({ title: "Autonomy policy saved", description: "It applies from the next agent request.", variant: "success" })
    startTransition(() => router.refresh())
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const value = (k: string) => String(form.get(k) ?? "").trim()
    const expires = value("expiresAt")
    const body: Record<string, unknown> = {
      expectedVersion: latestVersion,
      autonomyLevel: value("autonomyLevel"),
      maxRiskTier: value("maxRiskTier"),
      allowedCapabilityIds: list(value("allowedCapabilityIds")),
      approvalRequiredFor: list(value("approvalRequiredFor")),
      environmentScope: ENVS.filter((env) => form.get(`env-${env}`) === "on"),
      // datetime-local inputs on governance forms are explicitly UTC.
      expiresAt: expires ? new Date(`${expires}Z`).toISOString() : null,
      ...(value("note") ? { note: value("note") } : {}),
    }
    setPending(body)
  }

  const raising = pending && (pending.autonomyLevel === "FULL_SCOPED_AUTONOMY" || pending.maxRiskTier === "HIGH_RISK_MUTATION" || pending.maxRiskTier === "CRITICAL")

  return (
    <section aria-labelledby="autonomy-heading" className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="autonomy-heading" className="font-medium">
          Autonomy policy {active ? `(version ${active.version})` : "(default: observe only)"}
        </h3>
        {active ? (
          <ActionButton
            label="Disable autonomy"
            method="DELETE"
            url={`${url}?expectedVersion=${active.version}`}
            successMessage="Autonomy disabled — the connection is back to observe-only"
            confirm={{ title: "Disable this autonomy policy?", description: "The connection falls back to OBSERVE_ONLY: reads only, everything else needs approval or is denied.", destructive: true }}
          />
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="au-level">Autonomy level</Label>
            <select id="au-level" name="autonomyLevel" defaultValue={active?.autonomyLevel ?? "OBSERVE_ONLY"} className={`${selectClass} w-full`}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="au-risk">Highest risk tier without approval</Label>
            <select id="au-risk" name="maxRiskTier" defaultValue={active?.maxRiskTier ?? "READ"} className={`${selectClass} w-full`}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="au-allowed">Capability allowlist (comma separated, empty = any)</Label>
            <Input id="au-allowed" name="allowedCapabilityIds" defaultValue={active?.allowedCapabilityIds.join(", ") ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="au-approval">Always require approval for (comma separated)</Label>
            <Input id="au-approval" name="approvalRequiredFor" defaultValue={active?.approvalRequiredFor.join(", ") ?? ""} />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Environments (none = all)</legend>
            <div className="flex flex-wrap gap-3">
              {ENVS.map((env) => (
                <label key={env} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name={`env-${env}`} defaultChecked={active?.environmentScope.includes(env) ?? false} />
                  {env}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label htmlFor="au-expires">Expires, UTC (optional)</Label>
            <Input id="au-expires" name="expiresAt" type="datetime-local" defaultValue={active?.expiresAt ? active.expiresAt.slice(0, 16) : ""} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="au-note">Note (optional)</Label>
          <Textarea id="au-note" name="note" maxLength={500} rows={2} defaultValue={active?.note ?? ""} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <Button type="submit">Save as version {latestVersion + 1}</Button>
      </form>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await save(pending)
        }}
        title={raising ? "Raise this connection's autonomy?" : "Save the autonomy policy?"}
        description={
          raising
            ? "The agent will be able to run higher-risk operations without a fresh human approval (Phase 6 policy and mandatory approvals still apply)."
            : "A new version is created and applies from the next agent request. Approvals granted under the previous version can no longer be used."
        }
        confirmLabel="Save"
        destructive={!!raising}
        requireReason={false}
      />
    </section>
  )
}

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
import { selectClass } from "./ui"

const EFFECTS = ["ALLOW", "DENY", "REQUIRES_APPROVAL"] as const
const SCOPES = ["GLOBAL", "OWNER", "TEAM", "CONNECTION", "CAPABILITY", "RESOURCE_TYPE", "RESOURCE", "ENVIRONMENT"] as const
const TIERS = ["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"] as const

export interface PolicyFormDefaults {
  effect: string
  scope: string
  scopeValue: string | null
  capabilityId: string | null
  riskConstraint: string | null
  approvalRequirement: boolean
  conditions: unknown
}

export type PolicyFormProps =
  | { mode: "create"; capabilityIds: string[] }
  | { mode: "version"; capabilityIds: string[]; policyId: string; latestVersion: number; defaults: PolicyFormDefaults | null }

/**
 * Creates a Phase 6 policy, or publishes version N+1 of one (never edits a
 * version in place). Publishing changes what agents may do from the next
 * authorization, so it is always confirmed. Conditions use the existing
 * declarative policy language and are validated on the server.
 */
export function PolicyForm(props: PolicyFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const defaults = props.mode === "version" ? props.defaults : null
  const url = props.mode === "create" ? "/api/admin/agent-governance/policies" : `/api/admin/agent-governance/policies/${encodeURIComponent(props.policyId)}/versions`
  const prefix = props.mode === "create" ? "pc" : "pv"

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const value = (k: string) => String(form.get(k) ?? "").trim()
    let conditions: unknown = undefined
    if (value("conditions")) {
      try {
        conditions = JSON.parse(value("conditions"))
      } catch {
        setError("Conditions must be valid JSON (or left empty).")
        return
      }
    }
    const body: Record<string, unknown> = {
      effect: value("effect"),
      scope: value("scope"),
      scopeValue: value("scopeValue") || null,
      capabilityId: value("capabilityId") || null,
      riskConstraint: value("riskConstraint") || null,
      approvalRequirement: form.get("approvalRequirement") === "on",
      ...(conditions !== undefined ? { conditions } : {}),
      ...(value("note") ? { note: value("note") } : {}),
    }
    if (props.mode === "create") {
      body.name = value("name")
      if (value("description")) body.description = value("description")
      if (value("priority")) body.priority = Number(value("priority"))
    } else {
      body.expectedCurrentVersion = props.latestVersion
    }
    setPending(body)
  }

  async function publish(body: Record<string, unknown>) {
    const result = await sendGovernance(url, { body })
    if (!result.ok) {
      const failure = describeFailure(result)
      toast({ title: failure.title, description: failure.description, variant: "destructive" })
      if (result.status === 409) startTransition(() => router.refresh())
      throw new Error(failure.description)
    }
    toast({ title: props.mode === "create" ? "Policy created" : "New policy version published", variant: "success" })
    startTransition(() => router.refresh())
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby={`${prefix}-heading`} className="space-y-3 rounded-lg border p-4">
      <h3 id={`${prefix}-heading`} className="font-medium">
        {props.mode === "create" ? "Create a policy" : `Publish version ${props.latestVersion + 1}`}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.mode === "create" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={`${prefix}-name`}>Name</Label>
              <Input id={`${prefix}-name`} name="name" required minLength={2} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${prefix}-priority`}>Priority (higher first)</Label>
              <Input id={`${prefix}-priority`} name="priority" type="number" min={-1000} max={1000} defaultValue={0} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${prefix}-description`}>Description (optional)</Label>
              <Input id={`${prefix}-description`} name="description" maxLength={1000} />
            </div>
          </>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-effect`}>Effect</Label>
          <select id={`${prefix}-effect`} name="effect" defaultValue={defaults?.effect ?? "ALLOW"} className={`${selectClass} w-full`}>
            {EFFECTS.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-scope`}>Scope</Label>
          <select id={`${prefix}-scope`} name="scope" defaultValue={defaults?.scope ?? "CAPABILITY"} className={`${selectClass} w-full`}>
            {SCOPES.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-scope-value`}>Scope value (owner / team / connection / resource / environment)</Label>
          <Input id={`${prefix}-scope-value`} name="scopeValue" maxLength={200} defaultValue={defaults?.scopeValue ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-capability`}>Capability</Label>
          <select id={`${prefix}-capability`} name="capabilityId" defaultValue={defaults?.capabilityId ?? ""} className={`${selectClass} w-full`}>
            <option value="">Any capability</option>
            {props.capabilityIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-risk`}>Risk ceiling (optional)</Label>
          <select id={`${prefix}-risk`} name="riskConstraint" defaultValue={defaults?.riskConstraint ?? ""} className={`${selectClass} w-full`}>
            <option value="">None</option>
            {TIERS.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="approvalRequirement" defaultChecked={defaults?.approvalRequirement ?? false} />
          Turn an allow into &ldquo;requires human approval&rdquo;
        </label>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-conditions`}>Conditions (JSON, optional)</Label>
        <Textarea
          id={`${prefix}-conditions`}
          name="conditions"
          rows={3}
          className="font-mono text-xs"
          defaultValue={defaults?.conditions ? JSON.stringify(defaults.conditions, null, 2) : ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-note`}>Change note (optional)</Label>
        <Input id={`${prefix}-note`} name="note" maxLength={500} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Button type="submit">{props.mode === "create" ? "Create policy" : "Publish version"}</Button>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await publish(pending)
        }}
        title={props.mode === "create" ? "Create this policy?" : "Publish this policy version?"}
        description="Authorization changes from the next agent request. The previous version is kept in the history and can be rolled back."
        confirmLabel={props.mode === "create" ? "Create" : "Publish"}
        destructive={pending?.effect === "ALLOW" && pending?.scope === "GLOBAL"}
        requireReason={false}
      />
    </form>
  )
}

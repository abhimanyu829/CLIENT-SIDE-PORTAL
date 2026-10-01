"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { ActionButton } from "./ActionButton"
import { describeFailure, sendGovernance } from "./governance-client"
import { SecretRevealDialog, type RevealedSecret } from "./SecretRevealDialog"
import { selectClass } from "./ui"

export interface TriggerActionsProps {
  trigger: {
    triggerRef: string
    name: string
    type: string
    status: string
    version: number
    concurrency: string
    input: unknown
    expiresAt: string | null
    schedule: { kind: string; cron: string | null; timezone: string; runAt: string | null; missedRunPolicy: string } | null
    webhook: { path: string; secretVersion: number | null } | null
  }
}

const EDITABLE = ["DRAFT", "PAUSED", "DISABLED"]

/**
 * Lifecycle actions and the edit form for one trigger. Every action sends the
 * version the administrator is looking at (`expectedVersion`), so a change
 * made by someone else in between is a conflict, never a silent overwrite.
 */
export function TriggerActions({ trigger }: TriggerActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [secret, setSecret] = useState<RevealedSecret[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const base = `/api/admin/agent-governance/triggers/${encodeURIComponent(trigger.triggerRef)}`
  const body = { expectedVersion: trigger.version }
  const s = trigger.status

  async function onEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const value = (k: string) => String(form.get(k) ?? "").trim()
    const patch: Record<string, unknown> = { name: value("name"), concurrency: value("concurrency") }
    const expires = value("expiresAt")
    patch.expiresAt = expires ? new Date(`${expires}Z`).toISOString() : null
    if (value("input")) {
      try {
        const parsed = JSON.parse(value("input"))
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object")
        patch.input = parsed
      } catch {
        setError("The capability input must be a JSON object.")
        return
      }
    }
    if (trigger.schedule) {
      patch.schedule =
        trigger.schedule.kind === "ONCE"
          ? { kind: "ONCE", runAt: value("runAt") ? new Date(`${value("runAt")}Z`).toISOString() : "", timezone: value("timezone") || "UTC", missedRunPolicy: value("missedRunPolicy") }
          : { kind: "CRON", cron: value("cron"), timezone: value("timezone") || "UTC", missedRunPolicy: value("missedRunPolicy") }
    }
    setSaving(true)
    const result = await sendGovernance(base, { method: "PATCH", body: { expectedVersion: trigger.version, patch } })
    setSaving(false)
    if (!result.ok) {
      const failure = describeFailure(result)
      setError(failure.description)
      if (result.status === 409) startTransition(() => router.refresh())
      return
    }
    toast({ title: "Trigger updated", variant: "success" })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Trigger actions">
        {s === "DRAFT" || s === "DISABLED" ? (
          <ActionButton
            label="Activate"
            url={`${base}/activate`}
            body={body}
            variant="default"
            successMessage="Trigger activated"
            confirm={{ title: "Activate this trigger?", description: "It starts creating agent tasks on matching events, deliveries or schedule occurrences. Each firing is still authorized against the live policies." }}
          />
        ) : null}
        {s === "PAUSED" ? (
          <ActionButton
            label="Resume"
            url={`${base}/resume`}
            body={body}
            variant="default"
            successMessage="Trigger resumed"
            confirm={{ title: "Resume this trigger?", description: "Schedules continue from the next future occurrence; nothing from the paused period is replayed." }}
          />
        ) : null}
        {s === "ACTIVE" ? (
          <ActionButton label="Pause" url={`${base}/pause`} body={body} successMessage="Trigger paused" confirm={{ title: "Pause this trigger?", description: "It stops firing immediately. Tasks already created continue." }} />
        ) : null}
        {s === "DRAFT" || s === "ACTIVE" || s === "PAUSED" ? (
          <ActionButton
            label="Disable"
            url={`${base}/disable`}
            body={body}
            successMessage="Trigger disabled"
            confirm={{ title: "Disable this trigger?", description: "It stops firing and its schedule is cleared. You can activate it again later.", requireReason: true }}
          />
        ) : null}
        {trigger.type === "WEBHOOK" && EDITABLE.concat("ACTIVE").includes(s) ? (
          <ActionButton
            label="Rotate signing secret"
            url={`${base}/rotate-secret`}
            body={body}
            successMessage="Signing secret rotated"
            confirm={{ title: "Rotate the signing secret?", description: "A new secret is issued and the current one stops working immediately. Update the sender first.", requireReason: true }}
            onSuccess={(data) => {
              if (typeof data.webhookSecret === "string") setSecret([{ label: "Signing secret", value: data.webhookSecret }])
            }}
          />
        ) : null}
        {EDITABLE.concat("ACTIVE").includes(s) ? (
          <ActionButton
            label="Revoke"
            url={`${base}/revoke`}
            body={body}
            successMessage="Trigger revoked"
            confirm={{ title: "Revoke this trigger permanently?", description: "This cannot be undone. It never fires again.", destructive: true, requireReason: true, confirmLabel: "Revoke permanently" }}
          />
        ) : null}
      </div>

      {EDITABLE.includes(s) ? (
        <form onSubmit={onEdit} aria-labelledby="edit-trigger-heading" className="space-y-3 rounded-lg border p-4">
          <h3 id="edit-trigger-heading" className="font-medium">
            Edit (version {trigger.version})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="et-name">Name</Label>
              <Input id="et-name" name="name" defaultValue={trigger.name} required minLength={2} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="et-concurrency">Concurrency</Label>
              <select id="et-concurrency" name="concurrency" defaultValue={trigger.concurrency} className={`${selectClass} w-full`}>
                <option value="DROP_WHILE_RUNNING">Drop while running</option>
                <option value="QUEUE_ONE">Queue one</option>
                <option value="ALLOW_PARALLEL">Allow parallel</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="et-expires">Expires, UTC (empty = never)</Label>
              <Input id="et-expires" name="expiresAt" type="datetime-local" defaultValue={trigger.expiresAt ? trigger.expiresAt.slice(0, 16) : ""} />
            </div>
            {trigger.schedule ? (
              <>
                {trigger.schedule.kind === "ONCE" ? (
                  <div className="space-y-1">
                    <Label htmlFor="et-run-at">Run at, UTC</Label>
                    <Input id="et-run-at" name="runAt" type="datetime-local" defaultValue={trigger.schedule.runAt ? trigger.schedule.runAt.slice(0, 16) : ""} />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="et-cron">Cron</Label>
                    <Input id="et-cron" name="cron" defaultValue={trigger.schedule.cron ?? ""} className="font-mono" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="et-tz">Timezone (IANA)</Label>
                  <Input id="et-tz" name="timezone" defaultValue={trigger.schedule.timezone} maxLength={64} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="et-missed">If runs were missed</Label>
                  <select id="et-missed" name="missedRunPolicy" defaultValue={trigger.schedule.missedRunPolicy} className={`${selectClass} w-full`}>
                    <option value="SKIP">Skip them</option>
                    <option value="CATCH_UP_ONCE">Catch up once</option>
                  </select>
                </div>
              </>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="et-input">Capability input (JSON object)</Label>
            <Textarea id="et-input" name="input" rows={3} className="font-mono text-xs" defaultValue={JSON.stringify(trigger.input ?? {}, null, 2)} />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{s === "ACTIVE" ? "Pause or disable the trigger to edit it." : "This trigger can no longer be changed."}</p>
      )}
      <SecretRevealDialog open={!!secret} title="New webhook signing secret" secrets={secret ?? []} onClose={() => setSecret(null)} />
    </div>
  )
}

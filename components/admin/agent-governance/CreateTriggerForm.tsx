"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { useToast } from "@/hooks/use-toast"
import { describeFailure, sendGovernance } from "./governance-client"
import { SecretRevealDialog, type RevealedSecret } from "./SecretRevealDialog"
import { selectClass } from "./ui"

export interface CreateTriggerFormProps {
  connections: Array<{ id: string; name: string; environment: string }>
  capabilities: Array<{ id: string; version: number; riskTier: string; resourceType: string; resourceLocator: string | null }>
  eventTypes: Array<{ eventType: string; resourceType: string; aboutUser: boolean }>
}

type TriggerType = "EVENT" | "WEBHOOK" | "SCHEDULE"

/**
 * Creates a DRAFT trigger (Phase 9 TriggerService validates everything on the
 * server: owner / team / environment come from the connection, the input
 * must match the capability, the schedule must be bounded). A webhook's
 * signing secret is shown exactly once. A draft never fires until a
 * separate, confirmed activation.
 */
export function CreateTriggerForm({ connections, capabilities, eventTypes }: CreateTriggerFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [type, setType] = useState<TriggerType>("WEBHOOK")
  const [kind, setKind] = useState<"CRON" | "ONCE">("CRON")
  const [pending, setPending] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ ref: string; values: RevealedSecret[] } | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const value = (k: string) => String(form.get(k) ?? "").trim()
    let input: unknown = undefined
    if (value("input")) {
      try {
        input = JSON.parse(value("input"))
      } catch {
        setError("The capability input must be a JSON object (or left empty).")
        return
      }
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        setError("The capability input must be a JSON object (or left empty).")
        return
      }
    }
    const expires = value("expiresAt")
    const body: Record<string, unknown> = {
      type,
      name: value("name"),
      connectionId: value("connectionId"),
      capabilityId: value("capabilityId"),
      concurrency: value("concurrency") || undefined,
      ...(input !== undefined ? { input } : {}),
      // datetime-local inputs on governance forms are explicitly UTC.
      ...(expires ? { expiresAt: new Date(`${expires}Z`).toISOString() } : {}),
    }
    if (type !== "SCHEDULE") body.bindResource = form.get("bindResource") === "on"
    if (type === "EVENT") {
      body.event = {
        eventType: value("eventType"),
        ...(value("eventResourceId") ? { resourceId: value("eventResourceId") } : {}),
        actorScope: value("actorScope") || "OWNER",
      }
    }
    if (type === "SCHEDULE") {
      body.schedule =
        kind === "CRON"
          ? { kind, cron: value("cron"), timezone: value("timezone") || "UTC", missedRunPolicy: value("missedRunPolicy") || "SKIP" }
          : { kind, runAt: value("runAt") ? new Date(`${value("runAt")}Z`).toISOString() : "", timezone: value("timezone") || "UTC", missedRunPolicy: value("missedRunPolicy") || "SKIP" }
    }
    setPending(body)
  }

  async function create(body: Record<string, unknown>) {
    const result = await sendGovernance<{ trigger: { triggerRef: string; webhook: { path: string } | null }; webhookSecret?: string }>("/api/admin/agent-governance/triggers", { body })
    if (!result.ok || !result.data) {
      const failure = describeFailure(result)
      throw new Error(failure.description)
    }
    const { trigger, webhookSecret } = result.data
    toast({ title: "Trigger created as a draft", description: "Review it, then activate it.", variant: "success" })
    if (webhookSecret) {
      setSecret({
        ref: trigger.triggerRef,
        values: [
          { label: "Signing secret", value: webhookSecret },
          { label: "Endpoint path", value: trigger.webhook?.path ?? `/api/agent-webhooks/${trigger.triggerRef}` },
        ],
      })
    } else {
      router.push(`/admin/agent-governance/triggers/${trigger.triggerRef}`)
    }
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="create-trigger-heading" className="space-y-3 rounded-lg border p-4">
      <h3 id="create-trigger-heading" className="font-medium">
        Create a trigger
      </h3>
      {connections.length === 0 ? <p className="text-sm text-muted-foreground">There is no active agent connection to attach a trigger to.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="ct-type">Type</Label>
          <select id="ct-type" name="type" value={type} onChange={(e) => setType(e.target.value as TriggerType)} className={`${selectClass} w-full`}>
            <option value="WEBHOOK">Signed webhook</option>
            <option value="EVENT">Platform event</option>
            <option value="SCHEDULE">Schedule</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ct-name">Name</Label>
          <Input id="ct-name" name="name" required minLength={2} maxLength={120} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ct-connection">Agent connection</Label>
          <select id="ct-connection" name="connectionId" required className={`${selectClass} w-full`}>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.environment})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ct-capability">Capability (async-capable only)</Label>
          <select id="ct-capability" name="capabilityId" required className={`${selectClass} w-full`}>
            {capabilities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} v{c.version} · {c.riskTier}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ct-concurrency">Concurrency</Label>
          <select id="ct-concurrency" name="concurrency" defaultValue="DROP_WHILE_RUNNING" className={`${selectClass} w-full`}>
            <option value="DROP_WHILE_RUNNING">Drop while running</option>
            <option value="QUEUE_ONE">Queue one</option>
            <option value="ALLOW_PARALLEL">Allow parallel</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ct-expires">Expires, UTC (optional)</Label>
          <Input id="ct-expires" name="expiresAt" type="datetime-local" />
        </div>
        {type !== "SCHEDULE" ? (
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="bindResource" />
            Pass the incoming resource id to the capability
          </label>
        ) : null}
        {type === "EVENT" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="ct-event">Event</Label>
              <select id="ct-event" name="eventType" required className={`${selectClass} w-full`}>
                {eventTypes.map((e) => (
                  <option key={e.eventType} value={e.eventType}>
                    {e.eventType} ({e.resourceType})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ct-event-resource">Only this resource id (optional)</Label>
              <Input id="ct-event-resource" name="eventResourceId" maxLength={128} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ct-actor">Who may cause it</Label>
              <select id="ct-actor" name="actorScope" defaultValue="OWNER" className={`${selectClass} w-full`}>
                <option value="OWNER">Only the connection owner</option>
                <option value="ANY">Anyone (product events only)</option>
              </select>
            </div>
          </>
        ) : null}
        {type === "SCHEDULE" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="ct-kind">Schedule kind</Label>
              <select id="ct-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "CRON" | "ONCE")} className={`${selectClass} w-full`}>
                <option value="CRON">Recurring (cron)</option>
                <option value="ONCE">One time</option>
              </select>
            </div>
            {kind === "CRON" ? (
              <div className="space-y-1">
                <Label htmlFor="ct-cron">Cron (minute hour day month weekday)</Label>
                <Input id="ct-cron" name="cron" required placeholder="0 9 * * 1-5" className="font-mono" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="ct-run-at">Run at, UTC</Label>
                <Input id="ct-run-at" name="runAt" type="datetime-local" required />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="ct-tz">Timezone (IANA)</Label>
              <Input id="ct-tz" name="timezone" defaultValue="UTC" list="ct-tz-list" maxLength={64} />
              <datalist id="ct-tz-list">
                {["UTC", "Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Singapore"].map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ct-missed">If runs were missed</Label>
              <select id="ct-missed" name="missedRunPolicy" defaultValue="SKIP" className={`${selectClass} w-full`}>
                <option value="SKIP">Skip them</option>
                <option value="CATCH_UP_ONCE">Catch up once</option>
              </select>
            </div>
          </>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="ct-input">Capability input (JSON object, optional)</Label>
        <Textarea id="ct-input" name="input" rows={3} className="font-mono text-xs" placeholder='{"limit": 10}' />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={connections.length === 0 || capabilities.length === 0}>
        Create draft trigger
      </Button>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending) await create(pending)
        }}
        title="Create this trigger as a draft?"
        description="It is validated now but will not fire until you activate it. Every firing is authorized again against the live policies."
        confirmLabel="Create draft"
        destructive={false}
        requireReason={false}
      />
      <SecretRevealDialog
        open={!!secret}
        title="Webhook signing secret"
        secrets={secret?.values ?? []}
        onClose={() => {
          const ref = secret?.ref
          setSecret(null)
          if (ref) router.push(`/admin/agent-governance/triggers/${ref}`)
        }}
      />
    </form>
  )
}

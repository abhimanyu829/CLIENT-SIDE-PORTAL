import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { listWebhooks, type WebhookRow } from "@/lib/agent-gateway/governance/queries"
import { firstParam, parsePage, pickEnum, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import { TRIGGER_STATUSES } from "@/lib/agent-gateway/triggers/types"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/webhooks"

export default async function GovernanceWebhooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const status = pickEnum(firstParam(params, "status"), TRIGGER_STATUSES)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<WebhookRow> | null = null
  try {
    data = await listWebhooks({ status, page })
  } catch {
    data = null
  }

  return (
    <section aria-labelledby="webhooks-heading" className="space-y-4">
      <SectionHeader
        id="webhooks-heading"
        title="Webhooks"
        description="Signed webhook triggers. Only Abhibhi-signed deliveries with the trigger's own secret are accepted; secrets are shown once and can be rotated on the trigger page."
      >
        <Link className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" href="/admin/agent-governance/triggers?type=WEBHOOK">
          Create or manage
        </Link>
      </SectionHeader>
      <FilterBar action={BASE} fields={[{ name: "status", label: "Status", value: status, options: enumOptions(TRIGGER_STATUSES) }]} />
      {data === null ? (
        <Unavailable what="Webhooks" />
      ) : (
        <>
          <GovTable
            caption="Webhook triggers"
            rows={data.rows}
            rowKey={(r) => r.trigger.triggerRef}
            empty="No webhook matches these filters."
            columns={[
              { header: "Webhook", cell: (r) => <Link className="underline" href={`/admin/agent-governance/triggers/${r.trigger.triggerRef}`}>{r.trigger.name}</Link> },
              { header: "Status", cell: (r) => <StatusPill status={r.trigger.status} /> },
              { header: "Endpoint", cell: (r) => <Mono>{r.trigger.webhook?.path ?? "—"}</Mono> },
              { header: "Secret version", cell: (r) => r.trigger.webhook?.secretVersion ?? "—" },
              { header: "Deliveries (24 h)", cell: (r) => r.runsLast24h },
              { header: "Last delivery", cell: (r) => <Time value={r.lastRunAt} /> },
              { header: "Capability", cell: (r) => <Mono>{r.trigger.capabilityId}</Mono> },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
      <section aria-labelledby="signing-heading" className="space-y-2 rounded-lg border p-4 text-sm">
        <h3 id="signing-heading" className="font-medium">
          How senders sign a delivery
        </h3>
        <p className="text-muted-foreground">
          POST JSON to the endpoint with the headers <Mono>x-abhibhi-timestamp</Mono>, <Mono>x-abhibhi-nonce</Mono> (new for every attempt),{" "}
          <Mono>x-abhibhi-event-id</Mono> (stable across retries) and <Mono>x-abhibhi-signature</Mono> = hex HMAC-SHA256 of these lines joined by a newline:
        </p>
        <pre className="overflow-auto rounded-md bg-muted/40 p-3 text-xs">{`abhibhi.webhook.v1
<timestamp>
<nonce>
<event id>
POST
/api/agent-webhooks/<trigger ref>
<hex sha256 of the raw body>`}</pre>
        <p className="text-muted-foreground">
          Only <Mono>resourceId</Mono> is read from the body, and only for triggers that bind a resource. A repeated event id answers 200 with the original run.
        </p>
      </section>
    </section>
  )
}

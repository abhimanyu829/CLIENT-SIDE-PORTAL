import Link from "next/link"
import { requireGovernanceViewer } from "@/lib/agent-gateway/governance/access"
import { LEDGER_CATEGORY_FILTERS, listLedgerEvents, type AuditEventAdminView } from "@/lib/agent-gateway/governance/evidence"
import { firstParam, parsePage, pickEnum, pickId, type Paged, type SearchParams } from "@/lib/agent-gateway/governance/pagination"
import { ActionButton } from "@/components/admin/agent-governance/ActionButton"
import { LedgerVerifyButton } from "@/components/admin/agent-governance/LedgerVerifyButton"
import { FilterBar, GovTable, Mono, Pagination, SectionHeader, StatusPill, Time, Unavailable, enumOptions } from "@/components/admin/agent-governance/ui"

export const dynamic = "force-dynamic"

const BASE = "/admin/agent-governance/ledger"

function filterHref(key: string, value: string): string {
  return `${BASE}?${new URLSearchParams({ [key]: value }).toString()}`
}

export default async function GovernanceLedgerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireGovernanceViewer()
  const params = await searchParams
  const category = pickEnum(firstParam(params, "category"), LEDGER_CATEGORY_FILTERS)
  const connectionId = pickId(firstParam(params, "connectionId"), /^[A-Za-z0-9_-]{1,64}$/)
  const capabilityId = pickId(firstParam(params, "capabilityId"), /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/)
  const taskRef = pickId(firstParam(params, "taskRef"), /^atk_[0-9a-f]{32}$/)
  const traceId = pickId(firstParam(params, "traceId"), /^[0-9a-f]{32}$/)
  const page = parsePage(firstParam(params, "page"))
  let data: Paged<AuditEventAdminView> | null = null
  try {
    data = await listLedgerEvents({ category, connectionId, capabilityId, taskRef, traceId, page })
  } catch {
    data = null
  }
  const narrowed = [connectionId, capabilityId, taskRef, traceId].filter(Boolean)

  return (
    <section aria-labelledby="ledger-heading" className="space-y-4">
      <SectionHeader
        id="ledger-heading"
        title="Audit ledger"
        description="Append-only, hash-chained evidence of every agent decision, execution, approval, recovery and governance change (Phase 11). Inputs and results appear only as digests; nothing here can be edited or deleted."
      >
        <LedgerVerifyButton />
      </SectionHeader>
      <FilterBar action={BASE} fields={[{ name: "category", label: "Category", value: category, options: enumOptions(LEDGER_CATEGORY_FILTERS) }]} />
      {narrowed.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Filtered by{" "}
          {narrowed.map((v) => (
            <Mono key={v}>{`${v} `}</Mono>
          ))}
          .{" "}
          <Link className="underline" href={BASE}>
            Clear
          </Link>
        </p>
      ) : null}
      {data === null ? (
        <Unavailable what="The audit ledger" />
      ) : (
        <>
          <GovTable
            caption="Audit ledger events, newest first"
            rows={data.rows}
            rowKey={(r) => r.eventId}
            empty="No event matches these filters."
            columns={[
              { header: "Seq", cell: (r) => <Mono>{r.sequence}</Mono> },
              { header: "Time", cell: (r) => <Time value={r.occurredAt} /> },
              { header: "Event", cell: (r) => <span className="font-mono text-xs">{`${r.category} · ${r.action}`}</span> },
              { header: "Outcome", cell: (r) => <StatusPill status={r.outcome} /> },
              { header: "Actor", cell: (r) => <span className="text-xs">{`${r.actorType.toLowerCase()} ${r.actorId ?? ""}`}</span> },
              {
                header: "Capability",
                cell: (r) =>
                  r.capabilityId ? (
                    <Link className="underline font-mono text-xs" href={filterHref("capabilityId", r.capabilityId)}>
                      {r.capabilityVersion ? `${r.capabilityId}@v${r.capabilityVersion}` : r.capabilityId}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Connection",
                cell: (r) =>
                  r.connectionId ? (
                    <Link className="underline font-mono text-xs" href={filterHref("connectionId", r.connectionId)}>
                      {r.connectionId}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              {
                header: "Trace",
                cell: (r) =>
                  r.traceId ? (
                    <Link className="underline font-mono text-xs" href={filterHref("traceId", r.traceId)} aria-label={`Events of trace ${r.traceId}`}>
                      {r.traceId.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              { header: "Code", cell: (r) => <Mono>{r.errorCode ?? r.resultCode ?? "—"}</Mono> },
              { header: "Digest", cell: (r) => <Mono>{r.eventDigestPrefix}</Mono> },
              {
                header: "Recovery",
                cell: (r) =>
                  r.recoverable ? (
                    <ActionButton
                      label="Request recovery"
                      url="/api/admin/agent-governance/recoveries"
                      body={{ eventId: r.eventId }}
                      successMessage="Recovery processed. See Recoveries for the outcome."
                      confirm={{
                        title: "Recover this execution?",
                        description: `Runs the capability's declared recovery for ${r.capabilityId} through the normal authorization, autonomy and approval checks, or records that manual recovery is required. It never edits the ledger.`,
                        confirmLabel: "Request recovery",
                        destructive: true,
                        requireReason: true,
                      }}
                    />
                  ) : (
                    "—"
                  ),
              },
            ]}
          />
          <Pagination basePath={BASE} meta={data.meta} params={params} />
        </>
      )}
    </section>
  )
}

/**
 * lib/agent-gateway/execution/adapters/tickets-list-adapter.ts
 *
 * Binds capability "tickets.list" to the existing Ticket model access
 * pattern used by `app/api/tickets/route.ts`'s `GET` handler.
 *
 * Deliberate divergence from the real route, per the Phase 4 audit: the
 * real route lets an admin caller (`SUPER_ADMIN`/`SUB_ADMIN`) see ALL
 * tickets, unscoped. This adapter NEVER takes that branch — every
 * execution is unconditionally scoped to `clientId: context.ownerId`
 * (the trusted Phase 2 machine identity's owner), regardless of what role
 * that owning User happens to have. An AI-facing "list tickets" capability
 * must always mean "this connection's own tickets," never "every ticket
 * in the system" — inheriting the admin branch would be a much broader
 * disclosure than the capability's `resource.resourceType: "Ticket"` +
 * ownership-scoped contract implies.
 *
 * `assignedTo` (an internal staff user id) is excluded from the output —
 * the real route's query returns it unfiltered; it has no meaning to an
 * external AI caller and could be used to enumerate internal staff.
 */
import { db } from "@/lib/db"
import type { TicketStatus } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface TicketsListInput {
  status?: string
  limit?: number
}

export interface TicketSummary {
  id: string
  subject: string
  status: string
}

export interface TicketsListOutput {
  items: TicketSummary[]
}

const EXISTING_SERVICE_LIMIT_CAP = 50 // matches app/api/tickets/route.ts's own cap exactly

const VALID_TICKET_STATUSES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])

export class TicketsListAdapter implements AgentCapabilityAdapter<TicketsListInput, TicketsListOutput> {
  readonly capabilityId = "tickets.list"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: TicketsListInput): Promise<ExecutionResult<TicketsListOutput>> {
    const startedAt = Date.now()

    if (input.status !== undefined && !VALID_TICKET_STATUSES.has(input.status)) {
      // The real route casts the raw query param without validating
      // against the enum (silently returns zero rows for junk input) —
      // this adapter validates explicitly instead, since a silent
      // empty-result is a worse contract for a machine caller than a
      // clear rejection.
      throw new ExecutionError("INVALID_INPUT", `Unsupported ticket status: "${input.status}".`)
    }

    const limit = Math.min(input.limit ?? 20, EXISTING_SERVICE_LIMIT_CAP)

    if (context.signal.aborted) {
      throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    }

    // Unconditionally owner-scoped — never the "admin sees everything"
    // branch the real route supports for human admin callers. See file
    // header for the rationale.
    const tickets = await db.ticket.findMany({
      where: {
        clientId: context.ownerId,
        ...(input.status ? { status: input.status as TicketStatus } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, title: true, status: true },
    })

    return {
      output: { items: tickets.map((t) => ({ id: t.id, subject: t.title, status: t.status })) },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

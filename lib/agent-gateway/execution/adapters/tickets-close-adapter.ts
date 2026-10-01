/**
 * lib/agent-gateway/execution/adapters/tickets-close-adapter.ts
 *
 * Phase 13 — capability "tickets.close": closes one of the connection
 * owner's tickets. Traces to the CLIENT branch of
 * `app/api/tickets/[id]/route.ts` PATCH ("clients can only close their own
 * ticket": owner check, then `status: CLOSED`). The staff branch (status,
 * priority, assignment) is never reachable.
 *
 * End-state idempotent: closing a CLOSED ticket changes nothing and
 * returns the same result (`changed: false`), so a retry or a duplicate
 * recovery is harmless. The update is conditional on the owner, so a
 * ticket that changed hands between the read and the write is not touched.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface TicketsCloseInput {
  ticketId: string
}

export interface TicketsCloseOutput {
  id: string
  status: string
  changed: boolean
}

/** The owner's ticket, or the one RESOURCE_NOT_FOUND for missing and not-owned alike. */
async function findOwnedTicket(context: AgentExecutionContext, ticketId: unknown) {
  const ticket = typeof ticketId === "string" ? await db.ticket.findUnique({ where: { id: ticketId }, select: { id: true, clientId: true, status: true } }) : null
  if (!ticket || ticket.clientId !== context.ownerId) {
    throw new ExecutionError("RESOURCE_NOT_FOUND", "No ticket exists for the given id.")
  }
  return ticket
}

export class TicketsCloseAdapter implements AgentCapabilityAdapter<TicketsCloseInput, TicketsCloseOutput> {
  readonly capabilityId = "tickets.close"
  readonly capabilityVersion = 1

  /** Read-only preflight used by the gate before an approval (contracts/adapter.ts). */
  async checkResource(context: AgentExecutionContext, input: TicketsCloseInput): Promise<void> {
    await findOwnedTicket(context, input?.ticketId)
  }

  async execute(context: AgentExecutionContext, input: TicketsCloseInput): Promise<ExecutionResult<TicketsCloseOutput>> {
    const startedAt = Date.now()
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    const ticket = await findOwnedTicket(context, input.ticketId)
    if (ticket.status === "CLOSED") {
      return { output: { id: ticket.id, status: "CLOSED", changed: false }, executionMode: "SYNC", durationMs: Date.now() - startedAt }
    }
    const updated = await db.ticket.updateMany({ where: { id: ticket.id, clientId: context.ownerId }, data: { status: "CLOSED" } })
    if (updated.count !== 1) throw new ExecutionError("CONFLICT", "The ticket changed while it was being closed. Read it again.")
    return { output: { id: ticket.id, status: "CLOSED", changed: true }, executionMode: "SYNC", durationMs: Date.now() - startedAt }
  }
}

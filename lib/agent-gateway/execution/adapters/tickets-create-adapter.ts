/**
 * lib/agent-gateway/execution/adapters/tickets-create-adapter.ts
 *
 * Phase 13 — capability "tickets.create": opens a support ticket for the
 * connection's owner. Traces to `app/api/tickets/route.ts` POST (the same
 * single `db.ticket.create`, the same defaults: priority MEDIUM, category
 * GENERAL, trimmed title / description), with these deliberate
 * divergences:
 *
 *   - `clientId` is ALWAYS `context.ownerId` (Phase 2 identity), never input;
 *   - priority is limited to LOW / MEDIUM / HIGH: CRITICAL is a staff
 *     triage decision, not something an agent asserts;
 *   - no `projectId` (an agent does not attach tickets to projects; the
 *     human route checks project ownership since the PRE-13-2 fix);
 *   - the category is a closed vocabulary.
 *
 * Recovery (Phase 11): COMPENSATABLE through tickets.close (the ticket
 * stays on record, closed).
 */
import { db } from "@/lib/db"
import type { TicketPriority } from "@prisma/client"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export const TICKET_CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "PRODUCT", "OTHER"] as const
export const AGENT_TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const

export interface TicketsCreateInput {
  subject: string
  description: string
  priority?: (typeof AGENT_TICKET_PRIORITIES)[number]
  category?: (typeof TICKET_CATEGORIES)[number]
}

export interface TicketsCreateOutput {
  id: string
  subject: string
  status: string
  priority: string
  category: string
  createdAt: string
}

export class TicketsCreateAdapter implements AgentCapabilityAdapter<TicketsCreateInput, TicketsCreateOutput> {
  readonly capabilityId = "tickets.create"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: TicketsCreateInput): Promise<ExecutionResult<TicketsCreateOutput>> {
    const startedAt = Date.now()
    const subject = input.subject.trim()
    const description = input.description.trim()
    if (!subject || !description) throw new ExecutionError("INVALID_INPUT", "Subject and description are required.")
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")

    const ticket = await db.ticket.create({
      data: {
        clientId: context.ownerId,
        title: subject,
        description,
        priority: (input.priority ?? "MEDIUM") as TicketPriority,
        category: input.category ?? "GENERAL",
      },
      select: { id: true, title: true, status: true, priority: true, category: true, createdAt: true },
    })
    return {
      output: { id: ticket.id, subject: ticket.title, status: ticket.status, priority: ticket.priority, category: ticket.category, createdAt: ticket.createdAt.toISOString() },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

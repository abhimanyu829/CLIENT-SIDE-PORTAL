/**
 * lib/agent-gateway/execution/adapters/tickets-get-adapter.ts
 *
 * Phase 13 — capability "tickets.get": one support ticket of the
 * connection's owner, with its conversation. Traces to the client branch
 * of `app/api/tickets/[id]/route.ts` GET (owner check), with these
 * deliberate divergences:
 *
 *   - never the staff branch: always `clientId === context.ownerId`;
 *     not-found and not-owned are the same RESOURCE_NOT_FOUND (no oracle);
 *   - INTERNAL staff notes (`TicketMessage.isInternal`) are never returned
 *     (the human route returns them to the client: see the Phase 13 bug
 *     report, PRE-13-1);
 *   - no staff identities: `assignedTo`, assignee / client e-mail and
 *     sender ids are excluded; a message only says whether it came from
 *     the customer;
 *   - bounded: the latest 50 messages, attachments omitted.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface TicketsGetInput {
  ticketId: string
}

export interface TicketDetail {
  id: string
  subject: string
  description: string
  status: string
  priority: string
  category: string
  createdAt: string
  updatedAt: string
  messages: Array<{ id: string; content: string; fromCustomer: boolean; createdAt: string }>
  messagesTruncated: boolean
}

export const TICKET_MESSAGE_LIMIT = 50

export class TicketsGetAdapter implements AgentCapabilityAdapter<TicketsGetInput, TicketDetail> {
  readonly capabilityId = "tickets.get"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext, input: TicketsGetInput): Promise<ExecutionResult<TicketDetail>> {
    const startedAt = Date.now()
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    const ticket = await db.ticket.findUnique({
      where: { id: input.ticketId },
      select: {
        id: true,
        clientId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "desc" },
          take: TICKET_MESSAGE_LIMIT + 1,
          select: { id: true, content: true, senderId: true, createdAt: true },
        },
      },
    })
    if (!ticket || ticket.clientId !== context.ownerId) {
      throw new ExecutionError("RESOURCE_NOT_FOUND", "No ticket exists for the given id.")
    }
    const truncated = ticket.messages.length > TICKET_MESSAGE_LIMIT
    const messages = ticket.messages.slice(0, TICKET_MESSAGE_LIMIT).reverse()
    return {
      output: {
        id: ticket.id,
        subject: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        messages: messages.map((m) => ({ id: m.id, content: m.content, fromCustomer: m.senderId === ticket.clientId, createdAt: m.createdAt.toISOString() })),
        messagesTruncated: truncated,
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

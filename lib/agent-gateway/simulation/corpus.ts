/**
 * lib/agent-gateway/simulation/corpus.ts
 *
 * Phase 14 — the security regression corpus: one scenario per security
 * bug or finding fixed in Phases 4-13 that can be expressed through the
 * agent surface. Every entry names the bug it guards; a regression of the
 * fix makes the entry (or an invariant) fail. Entries are append-only:
 * a fixed bug's scenario is never removed.
 */
import { ALPHA, BRAVO, PLANTED_SECRET } from "./world"
import { keyed, tool } from "./scenarios"
import type { Scenario } from "./types"

const TICKET = { subject: "Regression ticket", description: "Regression corpus ticket body." }

export const SECURITY_REGRESSION_CORPUS: readonly Scenario[] = [
  {
    id: "REG-P4-1",
    reference: "Phase 4 audit: tickets.list never takes the human route's admin branch",
    title: "tickets.list is owner-scoped regardless of the owner's role",
    category: "REGRESSION",
    steps: [tool(BRAVO, "tickets.list", {}, { outcome: "ok" })],
  },
  {
    id: "REG-P4-2",
    reference: "Phase 4 audit: subscriptions.get normalises not-owned to not-found",
    title: "Not-owned subscription is RESOURCE_NOT_FOUND",
    category: "REGRESSION",
    steps: [tool(BRAVO, "subscriptions.get", { subscriptionId: "sim_sub_alpha" }, { outcome: "error", code: "RESOURCE_NOT_FOUND" })],
  },
  {
    id: "REG-P5-1",
    reference: "Phase 5: tool names are capability ids; no path-like or versioned aliases",
    title: "Aliased tool names are not callable",
    category: "REGRESSION",
    steps: [
      tool(ALPHA, "products.get@v1", { id: "sim_prod_pub" }, { outcome: "error" }),
      tool(ALPHA, "./products.get", { id: "sim_prod_pub" }, { outcome: "error" }),
    ],
  },
  {
    id: "REG-P8-1",
    reference: "Phase 8: tasks are bound to the submitting connection (no existence oracle)",
    title: "Cross-connection task status is TASK_NOT_FOUND",
    category: "REGRESSION",
    steps: [
      { kind: "task_submit", actor: BRAVO, capabilityId: "products.list", input: {}, expect: { outcome: "ok" }, label: "t" },
      tool(ALPHA, "agent_task_status", { taskRef: "$ref:t.taskRef" }, { outcome: "error", code: "TASK_NOT_FOUND" }),
    ],
  },
  {
    id: "REG-P12-B1",
    reference: "P12-B1: secret-shaped resource ids were echoed to the approver",
    title: "A credential-shaped id is never echoed to the agent",
    category: "REGRESSION",
    steps: [tool(ALPHA, "tickets.get", { ticketId: PLANTED_SECRET.slice(0, 64) }, { outcome: "error", code: "RESOURCE_NOT_FOUND" })],
  },
  {
    id: "REG-P12-B2",
    reference: "P12-B2: adapter-less capabilities were listed and callable",
    title: "Described-only capabilities are not tools",
    category: "REGRESSION",
    steps: [
      { kind: "list_tools", actor: ALPHA, expect: { includes: ["tickets.create", "products.get"], excludes: ["products.createDraft", "coupons.create"] } },
      tool(ALPHA, "coupons.create", { code: "SPRING", discountType: "PERCENTAGE", discountValue: 10 }, { outcome: "error" }),
    ],
  },
  {
    id: "REG-P12-B3",
    reference: "P12-B3: products.get served DRAFT products",
    title: "Drafts are not in the agent catalogue",
    category: "REGRESSION",
    steps: [tool(ALPHA, "products.get", { id: "sim_prod_draft" }, { outcome: "error", code: "RESOURCE_NOT_FOUND" })],
  },
  {
    id: "REG-P12-E",
    reference: "Phase 12 E: secrets in stored business data are redacted",
    title: "A token planted in a ticket never reaches the agent",
    category: "REGRESSION",
    steps: [tool(ALPHA, "tickets.get", { ticketId: "sim_tk_planted" }, { outcome: "ok" })],
  },
  {
    id: "REG-P12-B4",
    reference: "Phase 12 B4: hostile input is refused before the gate",
    title: "Bidirectional controls in a write never create an approval or a ticket",
    category: "REGRESSION",
    steps: [tool(BRAVO, "tickets.create", { subject: "Hello there", description: "pay\u202Eme back" }, { outcome: "error" }, undefined, keyed("reg-p12-b4-0001"))],
  },
  {
    id: "REG-P13-B1",
    reference: "P13-B1: keyed writes refused after the gate",
    title: "A keyed write without a key is refused before any approval",
    category: "REGRESSION",
    steps: [tool(BRAVO, "tickets.create", TICKET, { outcome: "error", code: "IDEMPOTENCY_KEY_REQUIRED" })],
  },
  {
    id: "REG-P13-B2",
    reference: "P13-B2: recovery. idempotency prefix was not reserved",
    title: "recovery. keys are refused on both paths",
    category: "REGRESSION",
    steps: [
      tool(ALPHA, "tickets.create", TICKET, { outcome: "error", code: "INVALID_INPUT" }, undefined, keyed("recovery.rcv_regression01")),
      { kind: "task_submit", actor: ALPHA, capabilityId: "tickets.create", input: TICKET, idempotencyKey: "recovery.rcv_regression01", expect: { outcome: "error" } },
    ],
  },
  {
    id: "REG-P13-E",
    reference: "Phase 13 E: internal staff notes never leave tickets.get",
    title: "Internal notes are not in the conversation",
    category: "REGRESSION",
    steps: [tool(ALPHA, "tickets.get", { ticketId: "sim_tk_alpha" }, { outcome: "ok" })],
  },
  {
    id: "REG-P14-F2",
    reference: "P14-F2: an approval could be requested for a resource the owner does not own",
    title: "An approval-gated write on another owner's resource is RESOURCE_NOT_FOUND on both paths, before any approval",
    category: "REGRESSION",
    steps: [
      tool(BRAVO, "tickets.close", { ticketId: "sim_tk_alpha" }, { outcome: "error", code: "RESOURCE_NOT_FOUND" }),
      { kind: "task_submit", actor: BRAVO, capabilityId: "tickets.close", input: { ticketId: "sim_tk_alpha" }, expect: { outcome: "error", code: "RESOURCE_NOT_FOUND" } },
    ],
  },
]

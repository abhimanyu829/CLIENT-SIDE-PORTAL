/**
 * lib/support-tickets.ts
 *
 * Shared rules for the support-ticket API routes (app/api/tickets/**,
 * app/api/dashboard/tickets):
 *
 *   - who is support STAFF (may see and manage other people's tickets and
 *     staff-internal notes): the real roles and the admin workforce model,
 *     never role names that do not exist;
 *   - validation of client-supplied ticket fields, so a bad value is a 400
 *     with a reason instead of a database error.
 */
import { z } from "zod"
import { TicketPriority, TicketStatus } from "@prisma/client"
import { validateSubadminCredentialSession } from "@/lib/subadmin-workforce"
import { canUseSubadminPermission } from "@/lib/subadmin-permission-policy"

export type SupportAction = "VIEW" | "EDIT"

/**
 * Whether a signed-in user acts as support staff for `action`:
 *   - SUPER_ADMIN: always;
 *   - SUB_ADMIN: only with an active admin credential session and the
 *     workforce "Support" permission for the action (the same rules the
 *     admin panel applies, lib/admin-auth.ts);
 *   - everyone else: no (a customer, limited to their own tickets).
 * `user.role` comes from `auth()`, which reads it from the database. Any
 * error is "not staff" (fail closed).
 */
export async function isSupportStaff(user: { id: string; role?: string | null }, action: SupportAction): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true
  if (user.role !== "SUB_ADMIN") return false
  try {
    const access = await validateSubadminCredentialSession(user.id, "SUB_ADMIN")
    return access.allowed && canUseSubadminPermission(access.permissions, "Support", action)
  } catch {
    return false
  }
}

export const TICKET_TITLE_MAX = 300
export const TICKET_DESCRIPTION_MAX = 20_000
export const TICKET_CATEGORY_MAX = 50
export const TICKET_MESSAGE_MAX = 10_000

const blankToUndefined = (value: unknown) => (value === null || value === "" ? undefined : value)

/**
 * Priority from a client. Case-insensitive; "URGENT" (what the dashboard form
 * has always offered as its top priority) is the enum's CRITICAL. Missing,
 * null or empty means "use the default".
 */
const prioritySchema = z.preprocess((value) => {
  const v = blankToUndefined(value)
  if (typeof v !== "string") return v
  const upper = v.trim().toUpperCase()
  return upper === "URGENT" ? "CRITICAL" : upper
}, z.nativeEnum(TicketPriority, { errorMap: () => ({ message: "Priority must be LOW, MEDIUM, HIGH or CRITICAL" }) }).optional())

const requiredText = (label: string, max: number) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

/** Body of a new ticket (POST /api/tickets, POST /api/dashboard/tickets). Unknown fields are ignored. */
export const createTicketSchema = z.object({
  title: requiredText("Title", TICKET_TITLE_MAX),
  description: requiredText("Description", TICKET_DESCRIPTION_MAX),
  priority: prioritySchema,
  category: z.preprocess(
    blankToUndefined,
    z.string({ invalid_type_error: "Category must be text" }).trim().min(1).max(TICKET_CATEGORY_MAX, `Category must be at most ${TICKET_CATEGORY_MAX} characters`).optional()
  ),
  projectId: z.preprocess(blankToUndefined, z.string({ invalid_type_error: "Project id must be text" }).trim().min(1).max(64).optional()),
})

/** Staff update of a ticket (PATCH /api/tickets/[id]). Unknown fields are ignored; at least one field is required. */
export const staffTicketUpdateSchema = z
  .object({
    status: z.nativeEnum(TicketStatus, { errorMap: () => ({ message: "Status must be OPEN, IN_PROGRESS, RESOLVED or CLOSED" }) }).optional(),
    priority: prioritySchema,
    /** A staff member's user id, or null to unassign. */
    assignedTo: z.string({ invalid_type_error: "assignedTo must be a user id or null" }).trim().min(1).max(64).nullable().optional(),
    /** ISO-8601 timestamp, or null to clear. */
    resolvedAt: z.string({ invalid_type_error: "resolvedAt must be an ISO-8601 timestamp or null" }).datetime({ offset: true, message: "resolvedAt must be an ISO-8601 timestamp" }).nullable().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), { message: "Nothing to update" })

/** The first validation message, for a 400 response. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request"
}

/** Parses a JSON body; `undefined` when the body is missing or not JSON. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

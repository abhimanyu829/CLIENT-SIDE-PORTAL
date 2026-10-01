/** Phase 10 — create a trigger (DRAFT). SUPER_ADMIN only; a webhook secret is returned once. */
import { createTriggerRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = createTriggerRoute

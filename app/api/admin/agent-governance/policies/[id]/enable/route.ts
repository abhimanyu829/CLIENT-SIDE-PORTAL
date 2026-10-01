/** Phase 10 — turn a policy's kill switch back on (idempotent). */
import { policyToggleRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = policyToggleRoute(true)

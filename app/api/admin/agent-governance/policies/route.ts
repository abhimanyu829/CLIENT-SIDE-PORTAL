/** Phase 10 — create a Phase 6 authorization policy with its first version. */
import { createPolicyRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = createPolicyRoute

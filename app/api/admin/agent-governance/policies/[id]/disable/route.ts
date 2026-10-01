/** Phase 10 — policy kill switch (idempotent; effective on the next authorization). */
import { policyToggleRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = policyToggleRoute(false)

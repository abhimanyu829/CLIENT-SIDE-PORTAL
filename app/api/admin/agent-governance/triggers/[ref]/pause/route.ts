/** Phase 10 — pause an ACTIVE trigger. Optimistic on `expectedVersion`. */
import { triggerTransitionRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = triggerTransitionRoute("pause")

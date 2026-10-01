/** Phase 10 — disable a trigger. Optimistic on `expectedVersion`. */
import { triggerTransitionRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = triggerTransitionRoute("disable")

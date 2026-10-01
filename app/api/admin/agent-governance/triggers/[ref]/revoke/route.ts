/** Phase 10 — revoke a trigger (terminal). Optimistic on `expectedVersion`. */
import { triggerTransitionRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = triggerTransitionRoute("revoke")

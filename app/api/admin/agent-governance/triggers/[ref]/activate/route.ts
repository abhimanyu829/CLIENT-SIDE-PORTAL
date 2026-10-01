/** Phase 10 — activate a DRAFT or DISABLED trigger. Optimistic on `expectedVersion`. */
import { triggerTransitionRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = triggerTransitionRoute("activate")

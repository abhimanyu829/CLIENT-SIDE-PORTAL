/** Phase 10 — resume a PAUSED trigger (schedules restart at the next future occurrence). */
import { triggerTransitionRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = triggerTransitionRoute("resume")

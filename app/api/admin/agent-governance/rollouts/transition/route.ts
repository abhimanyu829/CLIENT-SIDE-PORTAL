/** Phase 15: advance / pause / resume / roll back one capability's rollout. */
import { transitionRolloutRoute } from "@/lib/agent-gateway/governance/routes"
export const dynamic = "force-dynamic"
export const POST = transitionRolloutRoute

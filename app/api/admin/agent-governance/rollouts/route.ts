/** Phase 15: configure the rollout cohort of one capability (a new rollout starts at DISABLED). */
import { configureRolloutRoute } from "@/lib/agent-gateway/governance/routes"
export const dynamic = "force-dynamic"
export const POST = configureRolloutRoute

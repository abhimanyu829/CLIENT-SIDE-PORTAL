/** Phase 10 — edit a trigger that cannot fire (DRAFT / PAUSED / DISABLED). Optimistic on `expectedVersion`. */
import { updateTriggerRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const PATCH = updateTriggerRoute

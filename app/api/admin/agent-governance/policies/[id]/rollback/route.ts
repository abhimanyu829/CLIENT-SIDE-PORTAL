/** Phase 10 — roll a policy back by publishing a copy of an earlier version. Optimistic on `expectedCurrentVersion`. */
import { rollbackPolicyRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = rollbackPolicyRoute

/** Phase 10 — publish a new version of a policy. Optimistic on `expectedCurrentVersion`. */
import { publishPolicyVersionRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = publishPolicyVersionRoute

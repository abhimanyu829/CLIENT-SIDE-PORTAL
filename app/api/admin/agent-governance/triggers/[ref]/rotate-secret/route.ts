/** Phase 10 — rotate a webhook trigger's signing secret (returned once; the old one stops working). */
import { rotateTriggerSecretRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = rotateTriggerSecretRoute

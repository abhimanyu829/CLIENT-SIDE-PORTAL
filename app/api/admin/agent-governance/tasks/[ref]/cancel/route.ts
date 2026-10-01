/** Phase 10 — cancel an agent task on behalf of its connection. Optimistic on `expectedStatus`. */
import { cancelTaskRoute } from "@/lib/agent-gateway/governance/routes"

export const dynamic = "force-dynamic"
export const POST = cancelTaskRoute

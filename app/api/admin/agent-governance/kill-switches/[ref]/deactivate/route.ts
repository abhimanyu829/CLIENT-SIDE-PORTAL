/** Phase 15: deactivate one kill switch (optimistic concurrency, reason required). */
import { deactivateKillSwitchRoute } from "@/lib/agent-gateway/governance/routes"
export const dynamic = "force-dynamic"
export const POST = deactivateKillSwitchRoute

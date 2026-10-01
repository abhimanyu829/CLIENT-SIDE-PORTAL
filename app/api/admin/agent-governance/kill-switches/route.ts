/** Phase 15: activate an emergency kill switch (GLOBAL / CAPABILITY / CONNECTION / RISK_TIER). */
import { activateKillSwitchRoute } from "@/lib/agent-gateway/governance/routes"
export const dynamic = "force-dynamic"
export const POST = activateKillSwitchRoute

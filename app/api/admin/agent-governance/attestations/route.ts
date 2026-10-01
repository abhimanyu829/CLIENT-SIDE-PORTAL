/** Phase 15: record a release attestation (an append-only audit-ledger event). */
import { recordAttestationRoute } from "@/lib/agent-gateway/governance/routes"
export const dynamic = "force-dynamic"
export const POST = recordAttestationRoute

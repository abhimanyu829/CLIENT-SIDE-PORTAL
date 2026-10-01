/** Phase 11 — verify the audit ledger's hash chain (read-only). */
import { verifyLedgerRoute } from "@/lib/agent-gateway/governance/routes"
export const dynamic = "force-dynamic"
export const POST = verifyLedgerRoute

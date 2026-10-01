/**
 * app/api/agent-webhooks/[ref]/route.ts
 *
 * Abhibhi Agent Gateway — Phase 9 signed webhook intake for ONE
 * human-configured webhook trigger. Not a session route (no Clerk): the
 * caller is authenticated by the trigger's own HMAC secret. All checks live
 * in lib/agent-gateway/triggers/webhook-handler.ts; the task stack is built
 * only after a delivery is fully verified.
 */
import { handleAgentWebhook } from "@/lib/agent-gateway/triggers/webhook-handler"
import { createTriggerRuntime } from "@/lib/agent-gateway/triggers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  return handleAgentWebhook(request, ref, { runtime: createTriggerRuntime })
}

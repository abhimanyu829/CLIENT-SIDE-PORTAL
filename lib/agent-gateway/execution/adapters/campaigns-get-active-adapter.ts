/**
 * lib/agent-gateway/execution/adapters/campaigns-get-active-adapter.ts
 *
 * Phase 13 — capability "campaigns.getActive": the currently running
 * promotional campaign, exactly as the existing PUBLIC endpoint
 * `app/api/campaigns/active/route.ts` returns it (same query, same
 * ordering, same field set). Public storefront data; no ownership.
 *
 * Deliberately excluded (the public route excludes them too): analytics
 * counters and revenue, A/B variants, creator id, CTA URLs, geo / segment
 * targeting.
 */
import { db } from "@/lib/db"
import type { AgentCapabilityAdapter } from "../contracts/adapter"
import type { AgentExecutionContext } from "../contracts/execution-context"
import type { ExecutionResult } from "../contracts/execution-result"
import { ExecutionError } from "../contracts/execution-error"

export interface ActiveCampaign {
  id: string
  name: string
  label: string | null
  type: string
  discountPercent: number
  bannerText: string | null
  startsAt: string
  endsAt: string
  applicableTierIds: string[]
  secondsRemaining: number
}

export interface CampaignsGetActiveOutput {
  campaign: ActiveCampaign | null
}

export class CampaignsGetActiveAdapter implements AgentCapabilityAdapter<Record<string, never>, CampaignsGetActiveOutput> {
  readonly capabilityId = "campaigns.getActive"
  readonly capabilityVersion = 1

  async execute(context: AgentExecutionContext): Promise<ExecutionResult<CampaignsGetActiveOutput>> {
    const startedAt = Date.now()
    if (context.signal.aborted) throw new ExecutionError("CANCELLED", "Execution was cancelled before the existing service was invoked.")
    const now = context.timestamp
    const campaign = await db.campaign.findFirst({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { discountPercent: "desc" },
      select: { id: true, name: true, label: true, type: true, discountPercent: true, bannerText: true, startsAt: true, endsAt: true, applicableTierIds: true },
    })
    return {
      output: {
        campaign: campaign
          ? {
              id: campaign.id,
              name: campaign.name,
              label: campaign.label ?? null,
              type: campaign.type,
              discountPercent: campaign.discountPercent,
              bannerText: campaign.bannerText ?? null,
              startsAt: campaign.startsAt.toISOString(),
              endsAt: campaign.endsAt.toISOString(),
              applicableTierIds: campaign.applicableTierIds.slice(0, 50),
              secondsRemaining: Math.max(0, Math.floor((campaign.endsAt.getTime() - now.getTime()) / 1000)),
            }
          : null,
      },
      executionMode: "SYNC",
      durationMs: Date.now() - startedAt,
    }
  }
}

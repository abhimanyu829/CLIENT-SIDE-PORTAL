/**
 * app/api/admin/agent-connections/route.ts
 *
 * Admin-authenticated AgentConnection creation/list, mirroring the EXISTING
 * app/api/admin/subadmins/accounts/route.ts convention exactly (requireSuperAdmin,
 * zod input validation, no new admin auth mechanism). Only SUPER_ADMIN may
 * create machine identities — this is a CRITICAL-tier operation per Phase 0's
 * risk classification (identity/privilege provisioning), so it deliberately
 * uses the stricter requireSuperAdmin(), not requireAdmin().
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { GatewayError } from "@/lib/agent-gateway/shared/errors"

const createSchema = z.object({
  name: z.string().min(2).max(120),
  provider: z.string().min(1).max(60),
  externalAgentId: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  ownerId: z.string().min(1),
  teamId: z.string().min(1).optional(),
  environment: z.enum(["development", "staging", "production"]).optional(),
  authMethod: z.enum(["BEARER", "SIGNED_REQUEST"]).optional(),
  expiresAt: z.string().datetime().optional(),
})

export async function POST(req: Request) {
  const admin = await requireSuperAdmin()
  const parsed = createSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid agent connection payload" }, { status: 400 })
  }

  try {
    const result = await getAgentConnectionService().create({
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      // actorId is ALWAYS the server-resolved admin session — never taken
      // from the request body (Phase 2 spec §15/§28).
      actorId: admin.userId,
    })

    return NextResponse.json({
      success: true,
      connection: result.connection,
      // Displayed EXACTLY ONCE — this response is never reproducible after
      // this call (Phase 2 spec §9). Never logged (see observability/*
      // modules — none of them are given this value).
      credential: result.credential,
    })
  } catch (err) {
    if (err instanceof GatewayError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ success: false, error: "Unable to create agent connection" }, { status: 500 })
  }
}

export async function GET() {
  await requireSuperAdmin()
  const connections = await db.agentConnection.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      provider: true,
      externalAgentId: true,
      ownerId: true,
      teamId: true,
      status: true,
      authMethod: true,
      environment: true,
      createdAt: true,
      lastAuthenticatedAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  })
  return NextResponse.json({ success: true, connections })
}

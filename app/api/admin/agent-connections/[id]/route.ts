/**
 * app/api/admin/agent-connections/[id]/route.ts
 *
 * View a single AgentConnection's metadata. Never returns a credential
 * value — only status/timestamps/ownership metadata (Phase 2 spec §9:
 * "if a token must be displayed, display it ONCE at creation/rotation.
 * Afterward: 'credential available', NOT the actual credential").
 */
import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getAgentConnectionService } from "@/lib/agent-gateway/identity/connection-service"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin()
  const { id } = await params

  const connection = await getAgentConnectionService().getById(id)
  if (!connection) {
    return NextResponse.json({ success: false, error: "Connection not found" }, { status: 404 })
  }

  const credentials = await db.agentCredential.findMany({
    where: { connectionId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      fingerprint: true, // safe to display — never the secret itself
      keyId: true,
      createdAt: true,
      activatedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
      replacesCredentialId: true,
    },
  })

  return NextResponse.json({ success: true, connection, credentials })
}

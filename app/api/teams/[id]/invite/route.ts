import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

const acceptSchema = z.object({
  action: z.enum(["accept", "reject"]),
})

/**
 * POST /api/teams/[id]/invite
 * Allows the authenticated user to accept or reject their pending team invite.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await context.params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: 'action must be "accept" or "reject"' } },
        { status: 422 }
      )
    }
    const { action } = parsed.data

    // Find the pending invite for this user in this team
    const membership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.user.id } },
    })

    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "No invite found for this team" } },
        { status: 404 }
      )
    }

    if (membership.inviteStatus !== "PENDING") {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: `Invite already ${membership.inviteStatus.toLowerCase()}` } },
        { status: 409 }
      )
    }

    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true, ownerId: true } })

    if (action === "accept") {
      await db.teamMember.update({
        where: { teamId_userId: { teamId, userId: session.user.id } },
        data: { inviteStatus: "ACCEPTED", acceptedAt: new Date() },
      })

      // Notify team owner
      if (team?.ownerId) {
        const user = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
        await createNotification({
          userId: team.ownerId,
          type: "SYSTEM",
          title: "Team Invite Accepted",
          body: `${user?.name ?? "A user"} accepted your invite to join "${team.name}".`,
          actionUrl: `/dashboard/teams/${teamId}`,
        })
      }

      await auditLog({
        userId: session.user.id,
        action: "team.invite.accepted",
        entity: "Team",
        entityId: teamId,
      })

      return NextResponse.json({
        success: true,
        data: { message: `You joined "${team?.name ?? teamId}"`, teamId },
      })
    } else {
      // Reject — remove the membership record
      await db.teamMember.delete({
        where: { teamId_userId: { teamId, userId: session.user.id } },
      })

      await auditLog({
        userId: session.user.id,
        action: "team.invite.rejected",
        entity: "Team",
        entityId: teamId,
      })

      return NextResponse.json({
        success: true,
        data: { message: "Invite rejected", teamId },
      })
    }
  } catch (error) {
    logger.error({ error }, `POST /api/teams/${(await context.params).id}/invite`)
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { createNotification } from "@/lib/notifications"
import { auditLog } from "@/lib/audit"

const inviteSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
})

const removeSchema = z.object({
  userId: z.string().min(1),
})

// Helper: check if session user has admin/owner role in the team
async function getTeamMembership(teamId: string, userId: string) {
  return db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  })
}

// GET /api/teams/[id]/members
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    // Caller must be a member of the team
    const membership = await getTeamMembership(teamId, session.user.id)
    if (!membership || membership.inviteStatus !== "ACCEPTED") {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not a team member" } }, { status: 403 })
    }

    const members = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { invitedAt: "asc" },
    })

    return NextResponse.json({ success: true, data: members })
  } catch (error) {
    logger.error({ error }, "GET /api/teams/[id]/members")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// POST /api/teams/[id]/members — invite a user to the team
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    // Only OWNER or ADMIN can invite
    const callerMembership = await getTeamMembership(teamId, session.user.id)
    if (!callerMembership || !["OWNER", "ADMIN"].includes(callerMembership.role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Only team owners and admins can invite members" } }, { status: 403 })
    }

    const body = await req.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }
    const { userId, role } = parsed.data

    // Check the user exists
    const invitee = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (!invitee) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 })
    }

    // Check if already a member
    const existing = await getTeamMembership(teamId, userId)
    if (existing) {
      return NextResponse.json({ success: false, error: { code: "CONFLICT", message: "User is already a team member or has a pending invite" } }, { status: 409 })
    }

    const member = await db.teamMember.create({
      data: {
        teamId,
        userId,
        role,
        inviteStatus: "PENDING",
        invitedBy: session.user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    // Notify invitee
    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } })
    await createNotification({
      userId,
      type: "SYSTEM",
      title: "Team Invitation",
      body: `You've been invited to join the team "${team?.name ?? teamId}" as ${role}.`,
      actionUrl: `/dashboard/teams`,
      metadata: { teamId, invitedBy: session.user.id },
    })

    await auditLog({
      userId: session.user.id,
      action: "team.member.invite",
      entity: "Team",
      entityId: teamId,
      after: { inviteeId: userId, role },
    })

    return NextResponse.json({ success: true, data: member }, { status: 201 })
  } catch (error) {
    logger.error({ error }, "POST /api/teams/[id]/members")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

// DELETE /api/teams/[id]/members — remove a member
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await context.params

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 })
    }

    const body = await req.json()
    const parsed = removeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "userId required" } },
        { status: 422 }
      )
    }
    const { userId } = parsed.data

    const callerMembership = await getTeamMembership(teamId, session.user.id)
    const isSelf = userId === session.user.id

    // Allow: owner/admin removing others, or member removing themselves
    if (!callerMembership) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not a team member" } }, { status: 403 })
    }
    if (!isSelf && !["OWNER", "ADMIN"].includes(callerMembership.role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 })
    }

    // Cannot remove the team owner
    const targetMembership = await getTeamMembership(teamId, userId)
    if (targetMembership?.role === "OWNER" && !isSelf) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "Cannot remove the team owner" } }, { status: 400 })
    }

    await db.teamMember.delete({ where: { teamId_userId: { teamId, userId } } })

    await auditLog({
      userId: session.user.id,
      action: isSelf ? "team.member.leave" : "team.member.remove",
      entity: "Team",
      entityId: teamId,
      after: { removedUserId: userId },
    })

    return NextResponse.json({ success: true, data: { message: isSelf ? "Left team" : "Member removed" } })
  } catch (error) {
    logger.error({ error }, "DELETE /api/teams/[id]/members")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}

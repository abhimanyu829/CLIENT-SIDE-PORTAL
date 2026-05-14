import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { logger } from "@/lib/logger"
import { auditLog } from "@/lib/audit"
import { hash } from "bcryptjs"

const patchUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        timezone: true,
        isVerified: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        notifPrefs: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!user) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User not found" }}, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    logger.error({ error }, "API error in GET /api/users/me")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" }}, { status: 401 })
    }

    const body = await req.json()
    const validatedData = patchUserSchema.parse(body)

    const userBefore = await db.user.findUnique({ where: { id: session.user.id }})

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: validatedData,
    })

    auditLog({
      userId: session.user.id,
      action: "update:user:profile",
      entity: "user",
      entityId: updatedUser.id,
      before: userBefore ?? undefined,
      after: updatedUser,
      req,
    })

    const { passwordHash, ...safeUser } = updatedUser
    return NextResponse.json({ success: true, data: safeUser })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: error.errors }}, { status: 400 })
    }
    logger.error({ error }, "API error in PATCH /api/users/me")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }}, { status: 500 })
  }
}

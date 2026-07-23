import { NextResponse } from "next/server"
import { z } from "zod"
import { hash } from "bcryptjs"
import { requireSuperAdmin } from "@/lib/admin-auth"
import {
  logSubadminActivity,
  setSubadminPermissions,
  updateSubadminStatus,
} from "@/lib/subadmin-workforce"
import { isSubadminAction, isSubadminResource } from "@/lib/subadmin-permission-policy"
import { db } from "@/lib/db"

function prisma() {
  return db as any
}

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "DISABLED", "REVOKED"]).optional(),
  reason: z.string().max(1000).optional(),
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(80).optional(),
  password: z.string().min(8).max(200).optional(),
  permissions: z
    .array(
      z.object({
        resource: z.string().refine(isSubadminResource),
        action: z.string().refine(isSubadminAction),
      })
    )
    .optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid subadmin update payload" }, { status: 400 })
  }

  let account = null

  if (parsed.data.status) {
    account = await updateSubadminStatus({
      id,
      status: parsed.data.status,
      reason: parsed.data.reason,
      admin,
    })
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.name) data.name = parsed.data.name
  if (parsed.data.email) data.email = parsed.data.email.toLowerCase()
  if (parsed.data.username) data.username = parsed.data.username
  if (parsed.data.password) {
    data.passwordHash = await hash(parsed.data.password, 12)
    data.passwordChangedAt = new Date()
    data.lastCredentialRotatedAt = new Date()
    data.forceLogoutVersion = { increment: 1 }
  }
  if (Object.keys(data).length > 0) {
    data.updatedById = admin.userId
    account = await prisma().subadminAccount.update({
      where: { id },
      data: {
        ...data,
        sessions: parsed.data.password
          ? { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } }
          : undefined,
      },
    })
    await logSubadminActivity({
      subadminId: id,
      actorId: admin.userId,
      action: "SUBADMIN_ACCOUNT_UPDATED",
      entity: "SubadminAccount",
      entityId: id,
      metadata: { fields: Object.keys(data) },
    })
  }

  if (parsed.data.permissions) {
    await setSubadminPermissions(id, parsed.data.permissions, admin)
  }

  account ??= await prisma().subadminAccount.findUnique({ where: { id } })
  return NextResponse.json({ success: true, account })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  const account = await updateSubadminStatus({
    id,
    status: "REVOKED",
    reason: "Deleted/revoked by Super Admin",
    admin,
  })
  return NextResponse.json({ success: true, account })
}

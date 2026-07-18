import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logSubadminActivity, notifySuperAdmins, validateSubadminCredentialSession } from "@/lib/subadmin-workforce"

function prisma() {
  return db as any
}

const createSchema = z.object({
  resource: z.string().min(2).max(80),
  action: z.string().min(2).max(80),
  entity: z.string().max(120).optional(),
  entityId: z.string().max(120).optional(),
  title: z.string().min(3).max(180),
  payload: z.record(z.unknown()).default({}),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUB_ADMIN") {
    return NextResponse.json({ success: false, error: "Subadmin access required" }, { status: 401 })
  }

  const access = await validateSubadminCredentialSession(session.user.id, session.user.role)
  if (!access.allowed) {
    return NextResponse.json({ success: false, error: access.reason }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid approval request payload" }, { status: 400 })
  }

  const subadmin = await prisma().subadminAccount.findFirst({
    where: { userId: session.user.id, status: "ACTIVE", credentialsActive: true },
    select: { id: true, name: true, email: true },
  })
  if (!subadmin) {
    return NextResponse.json({ success: false, error: "Active subadmin account required" }, { status: 403 })
  }

  const approval = await prisma().subadminApprovalRequest.create({
    data: {
      subadminId: subadmin.id,
      requestedById: session.user.id,
      resource: parsed.data.resource,
      action: parsed.data.action,
      entity: parsed.data.entity,
      entityId: parsed.data.entityId,
      title: parsed.data.title,
      payload: parsed.data.payload,
      status: "PENDING_APPROVAL",
    },
  })

  await logSubadminActivity({
    subadminId: subadmin.id,
    actorId: session.user.id,
    action: "APPROVAL_REQUEST_CREATED",
    entity: "SubadminApprovalRequest",
    entityId: approval.id,
    metadata: { resource: parsed.data.resource, action: parsed.data.action },
  })

  await notifySuperAdmins({
    title: "New admin approval request",
    body: `${subadmin.name} requested ${parsed.data.action} access for ${parsed.data.resource}.`,
    actionUrl: "/admin/subadmins",
    metadata: { approvalRequestId: approval.id },
  }).catch(() => null)

  return NextResponse.json({ success: true, approval })
}

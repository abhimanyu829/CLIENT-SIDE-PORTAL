import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { createSubadminAccount } from "@/lib/subadmin-workforce"
import { isSubadminAction, isSubadminResource } from "@/lib/subadmin-permission-policy"

const permissionSchema = z.object({
  resource: z.string().refine(isSubadminResource),
  action: z.string().refine(isSubadminAction),
})

const createSchema = z.object({
  applicationId: z.string().optional().or(z.literal("")),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(200),
  permissions: z.array(permissionSchema).default([]),
})

export async function POST(req: Request) {
  const admin = await requireSuperAdmin()
  const parsed = createSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid subadmin account payload" }, { status: 400 })
  }

  const result = await createSubadminAccount({
    ...parsed.data,
    applicationId: parsed.data.applicationId || undefined,
    admin,
  })

  return NextResponse.json({
    success: true,
    account: result.account,
    accessToken: result.rawToken,
  })
}

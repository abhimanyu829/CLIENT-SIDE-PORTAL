import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { ADMIN_ACTIONS, ADMIN_RESOURCES, createSubadminAccount } from "@/lib/subadmin-workforce"

const permissionSchema = z.object({
  resource: z.string().refine((value) => ADMIN_RESOURCES.includes(value)),
  action: z.string().refine((value) => ADMIN_ACTIONS.includes(value)),
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

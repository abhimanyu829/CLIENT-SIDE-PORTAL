import { NextResponse } from "next/server"
import { z } from "zod"
import { createSubadminApplication, getPortalSetting } from "@/lib/subadmin-workforce"

const applicationSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(180),
  phone: z.string().max(40).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  skills: z.union([z.array(z.string()), z.string()]).transform((value) =>
    Array.isArray(value)
      ? value.map((item) => item.trim()).filter(Boolean)
      : value.split(",").map((item) => item.trim()).filter(Boolean)
  ),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  resumeUrl: z.string().url().optional().or(z.literal("")),
  motivation: z.string().min(20).max(4000),
})

export async function GET() {
  const setting = await getPortalSetting()
  return NextResponse.json({
    enabled: setting.enabled,
    applicationsOpen: setting.applicationsOpen,
    portalPath: setting.portalPath,
  })
}

export async function POST(req: Request) {
  const parsed = applicationSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid application details", issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const application = await createSubadminApplication({
      ...parsed.data,
      phone: parsed.data.phone || undefined,
      country: parsed.data.country || undefined,
      portfolioUrl: parsed.data.portfolioUrl || undefined,
      githubUrl: parsed.data.githubUrl || undefined,
      linkedinUrl: parsed.data.linkedinUrl || undefined,
      resumeUrl: parsed.data.resumeUrl || undefined,
    })

    return NextResponse.json({
      success: true,
      application: { id: application.id, status: application.status },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Application failed"
    const status = message === "APPLICATION_PORTAL_CLOSED" ? 403 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

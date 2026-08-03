import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { updateServiceConfig, decryptConfig } from "@/lib/services/service-lifecycle-service"

const configSchema = z.object({
  applicationUrl: z.string().optional(),
  adminUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  temporaryPassword: z.string().optional(),
  databaseName: z.string().optional(),
  databaseStorage: z.string().optional(),
  databaseSize: z.string().optional(),
  allocatedStorage: z.string().optional(),
  allocatedRam: z.string().optional(),
  allocatedCpu: z.string().optional(),
  dockerContainerName: z.string().optional(),
  containerId: z.string().optional(),
  imageVersion: z.string().optional(),
  gitRepository: z.string().optional(),
  branch: z.string().optional(),
  environmentVariables: z.record(z.string(), z.string()).optional(),
  sslStatus: z.string().optional(),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  expiryDate: z.string().optional(),
  renewalDate: z.string().optional(),
  supportLevel: z.string().optional(),
  documentationUrl: z.string().optional(),
  tutorialUrl: z.string().optional(),
  monitoringStatus: z.string().optional(),
  deploymentNotes: z.string().optional(),
}).partial()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const service = await db.purchasedService.findUnique({ where: { id }, select: { config: true } })
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: decryptConfig(service.config) })
  } catch (err) {
    console.error("[admin/deployment-center/[id]/config GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load config" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = configSchema.parse(await req.json())

    await updateServiceConfig(id, body, admin.userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid config" }, { status: 400 })
    const message = err instanceof Error ? err.message : "Failed to update config"
    console.error("[admin/deployment-center/[id]/config PUT]", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

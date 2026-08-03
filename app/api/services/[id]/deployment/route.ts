import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getQueuePosition } from "@/lib/services/service-lifecycle-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  try {
    const service = await db.purchasedService.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true, estimatedCompletionAt: true, deployment: true },
    })
    if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const queueAhead = service.deployment ? await getQueuePosition(service.deployment) : 0

    return NextResponse.json({
      success: true,
      data: {
        serviceStatus: service.status,
        deploymentStatus: service.deployment?.status ?? "PENDING",
        statusHistory: service.deployment?.statusHistory ?? [],
        queueAhead,
        estimatedCompletionAt: service.estimatedCompletionAt,
        startedAt: service.deployment?.startedAt ?? null,
        completedAt: service.deployment?.completedAt ?? null,
      },
    })
  } catch (err) {
    console.error("[services/[id]/deployment GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load deployment status" }, { status: 500 })
  }
}

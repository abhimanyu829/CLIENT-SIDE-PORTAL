import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/projects/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await db.project.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, email: true, avatarUrl: true } },
        manager: { select: { name: true, avatarUrl: true } },
        tickets: { orderBy: { updatedAt: "desc" }, take: 5 },
        files: { orderBy: { createdAt: "desc" } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "ADMIN" || role === "STAFF"
    if (!isAdmin && project.clientId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ data: project })
  } catch (err) {
    console.error("[projects/[id]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/projects/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const role = (session?.user as any)?.role
    if (role !== "ADMIN" && role !== "STAFF") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { title, description, status, managerId, deadline, budget, tags, milestones } = body

    const updated = await db.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(managerId !== undefined && { managerId }),
        ...(deadline !== undefined && { deadline: new Date(deadline) }),
        ...(budget !== undefined && { budget }),
        ...(tags !== undefined && { tags }),
        ...(milestones !== undefined && { milestones }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[projects/[id]] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/projects/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const role = (session?.user as any)?.role
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[projects/[id]] DELETE:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

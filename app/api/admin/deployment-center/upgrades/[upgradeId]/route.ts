import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

const patchSchema = z.object({
  status: z.enum(["PAID", "REJECTED", "CANCELLED"]),
})

/// Payment confirmation for an upgrade (any gateway): marks it PAID so the
/// admin can apply it, or rejects/cancels it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ upgradeId: string }> }) {
  try {
    await requireAdmin()
    const { upgradeId } = await params
    const { status } = patchSchema.parse(await req.json())

    const upgrade = await db.serviceUpgrade.findUnique({ where: { id: upgradeId } })
    if (!upgrade) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (upgrade.status === "APPLIED") return NextResponse.json({ error: "Already applied" }, { status: 409 })

    const updated = await db.serviceUpgrade.update({ where: { id: upgradeId }, data: { status } })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    console.error("[admin/deployment-center/upgrades/[upgradeId] PATCH]", err)
    return NextResponse.json({ success: false, error: "Failed to update upgrade" }, { status: 500 })
  }
}

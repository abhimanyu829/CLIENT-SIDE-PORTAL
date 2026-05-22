import { Suspense } from "react"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import AdminUsersClient from "./AdminUsersClient"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>
}) {
  const admin = await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, Number(params?.page ?? 1))
  const limit = 20
  const search = params?.search ?? ""
  const role = params?.role ?? ""

  const where = {
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { role: role as "CLIENT" | "SUB_ADMIN" | "SUPER_ADMIN" } : {}),
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        subscriptions: {
          include: { tier: true, product: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { payments: true, sessions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    // isBanned fields — safe fallback if column not yet in DB
    isBanned: (u as any).isBanned ?? false,
    bannedAt: (u as any).bannedAt?.toISOString?.() ?? null,
    banReason: (u as any).banReason ?? null,
    subscriptions: u.subscriptions.map((s) => ({
      ...s,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      tier: { ...s.tier, price: String(s.tier.price), createdAt: s.tier.createdAt.toISOString() },
    })),
    embedding: undefined,
  }))

  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading users...</div>}>
      <AdminUsersClient
        users={serialized}
        total={total}
        page={page}
        limit={limit}
        isSuperAdmin={admin.isSuperAdmin}
      />
    </Suspense>
  )
}

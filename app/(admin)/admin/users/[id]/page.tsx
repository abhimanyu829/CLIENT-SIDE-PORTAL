import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import UserProfileClient from "./UserProfileClient"

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireAdmin()

  const user = await db.user.findUnique({
    where: { id },
    include: {
      subscriptions: {
        include: { tier: true, product: true, payments: { take: 5, orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 30, include: { invoice: true } },
      sessions: { orderBy: { lastActiveAt: "desc" }, take: 15 },
      apiKeys: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  })

  if (!user) notFound()

  const serialized = {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    embedding: undefined,
    twoFactorSecret: undefined,
    passwordHash: undefined,
    subscriptions: user.subscriptions.map((s) => ({
      ...s,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      tier: { ...s.tier, price: String(s.tier.price), createdAt: s.tier.createdAt.toISOString() },
      payments: s.payments.map((p) => ({
        ...p, amount: String(p.amount), createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null,
      })),
    })),
    payments: user.payments.map((p) => ({
      ...p, amount: String(p.amount), createdAt: p.createdAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null,
      invoice: p.invoice ? { ...p.invoice, totalAmount: String(p.invoice.totalAmount), taxAmount: String(p.invoice.taxAmount), issuedAt: p.invoice.issuedAt.toISOString() } : null,
    })),
    sessions: user.sessions.map((s) => ({
      ...s, createdAt: s.createdAt.toISOString(), lastActiveAt: s.lastActiveAt.toISOString(), expiresAt: s.expiresAt.toISOString(),
    })),
    apiKeys: user.apiKeys.map((k) => ({
      ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null,
    })),
    auditLogs: user.auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  }

  return <UserProfileClient user={serialized} isSuperAdmin={admin.isSuperAdmin} adminUserId={admin.userId} />
}

/**
 * Phase 8 — RBAC gate tests (the authorization boundary for every
 * subscription-governance endpoint).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

let gate: {
  user: {
    id: string
    role: string
    isBanned?: boolean
    permissions?: Array<{ resource: string; action: string }>
    allowed?: boolean
  }
}

function applyGate(user: {
  id: string
  role: string
  isBanned?: boolean
  permissions?: Array<{ resource: string; action: string }>
  allowed?: boolean
}) {
  return user
}

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: gate.user.id } })),
}))
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () =>
        gate.user.isBanned ? { role: gate.user.role, isBanned: true, name: null }
          : { role: gate.user.role, isBanned: false, name: "T" },
      ),
    },
  },
}))
vi.mock("@/lib/subadmin-workforce", () => ({
  validateSubadminCredentialSession: vi.fn(async () => ({ allowed: gate.user.allowed ?? true, reason: null, permissions: (gate.user.permissions ?? []).map((p) => ({ resource: p.resource, action: p.action })), panelEligible: true, landingPath: "/admin" })),
}))
vi.mock("@/lib/subadmin-permission-policy", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/subadmin-permission-policy")>()
  return {
    ...original,
    canUseSubadminPermission: vi.fn((permissions: Array<{ resource: string; action: string }>, resource: string, action: string) =>
      permissions.some((p) => p.resource === resource && p.action === action),
    ),
  }
})

import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"

beforeEach(() => {
  gate = { user: { id: "u", role: "SUPER_ADMIN", permissions: [] } }
})

describe("adminSubscriptionGate", () => {
  it("allows SUPER_ADMIN for any action", async () => {
    const result = await adminSubscriptionGate("VIEW")
    expect(result).toMatchObject({ ok: true, isSuperAdmin: true, userId: "u" })
  })

  it("allows SUB_ADMIN with the matching SubscriptionGovernance permission", async () => {
    gate = { user: { id: "s", role: "SUB_ADMIN", permissions: [{ resource: "SubscriptionGovernance", action: "APPROVE" }] } }
    expect((await adminSubscriptionGate("APPROVE")).ok).toBe(true)
    expect((await adminSubscriptionGate("VIEW")).ok).toBe(false)
  })

  it("denies SUB_ADMIN lacking the permission (direct API cannot bypass)", async () => {
    gate = { user: { id: "s", role: "SUB_ADMIN", permissions: [{ resource: "Orders", action: "VIEW" }] } }
    const result = await adminSubscriptionGate("VIEW")
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: "FORBIDDEN" })
  })

  it("denies ordinary customers", async () => {
    gate = { user: { id: "c", role: "CUSTOMER" } }
    expect((await adminSubscriptionGate("VIEW")).ok).toBe(false)
  })

  it("denies banned admins and unauthenticated callers", async () => {
    gate = { user: { id: "b", role: "SUPER_ADMIN", isBanned: true } }
    expect((await adminSubscriptionGate("VIEW")).ok).toBe(false)
    gate = { user: { id: "", role: "SUPER_ADMIN" } }
    const r = await adminSubscriptionGate("VIEW")
    expect(r.ok).toBe(false)
    expect((r as { reason?: string }).reason).toBe("UNAUTHENTICATED")
  })
})

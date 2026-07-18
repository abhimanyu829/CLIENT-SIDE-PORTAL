import * as React from "react"
import { cookies, headers } from "next/headers"
import { compare, hash } from "bcryptjs"
import { randomBytes, createHash } from "crypto"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/resend"
import { createNotification } from "@/lib/notifications"
import type { AdminSession } from "@/lib/admin-auth"

export const SUBADMIN_SESSION_COOKIE = "nexusai_subadmin_admin_session"
export const SUBADMIN_SESSION_DAYS = 1

export const ADMIN_RESOURCES = [
  "Products",
  "Services",
  "Users",
  "Orders",
  "Payments",
  "Refunds",
  "Analytics",
  "Email Center",
  "Support",
  "Media",
  "Blogs",
  "Marketing",
  "CRM",
  "Documentation",
]

export const ADMIN_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "PUBLISH"]

function prisma() {
  return db as any
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizePath(value: string) {
  const cleaned = value.trim().replace(/\/+/g, "/")
  if (!cleaned.startsWith("/")) return `/${cleaned}`
  return cleaned === "/" ? "/join-our-team" : cleaned
}

export async function getRequestMeta() {
  const headerStore = await headers()
  return {
    ip:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      null,
    userAgent: headerStore.get("user-agent") ?? null,
  }
}

export async function getPortalSetting() {
  const portal = await prisma().adminPortalSetting.findUnique({
    where: { id: "subadmin-portal" },
  })

  return (
    portal ?? {
      id: "subadmin-portal",
      enabled: true,
      applicationsOpen: true,
      portalPath: "/join-our-team",
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  )
}

export async function upsertPortalSetting(input: {
  enabled: boolean
  applicationsOpen: boolean
  portalPath: string
  admin: AdminSession
}) {
  const portalPath = normalizePath(input.portalPath)
  const setting = await prisma().adminPortalSetting.upsert({
    where: { id: "subadmin-portal" },
    create: {
      id: "subadmin-portal",
      enabled: input.enabled,
      applicationsOpen: input.applicationsOpen,
      portalPath,
      updatedById: input.admin.userId,
    },
    update: {
      enabled: input.enabled,
      applicationsOpen: input.applicationsOpen,
      portalPath,
      updatedById: input.admin.userId,
    },
  })

  await logSubadminActivity({
    actorId: input.admin.userId,
    action: "PORTAL_SETTING_UPDATED",
    entity: "AdminPortalSetting",
    entityId: setting.id,
    metadata: { enabled: input.enabled, applicationsOpen: input.applicationsOpen, portalPath },
  })

  return setting
}

export async function resolveSuperAdmins() {
  return prisma().user.findMany({
    where: { role: "SUPER_ADMIN", isBanned: false },
    select: { id: true, email: true, name: true },
    take: 20,
  })
}

export async function notifySuperAdmins(input: {
  title: string
  body: string
  actionUrl: string
  metadata?: Record<string, unknown>
  subject?: string
}) {
  const admins = await resolveSuperAdmins()
  await Promise.all(
    admins.map((admin: { id: string; email: string; name: string | null }) =>
      createNotification({
        userId: admin.id,
        title: input.title,
        body: input.body,
        type: "SYSTEM",
        actionUrl: input.actionUrl,
        metadata: input.metadata,
      }).catch(() => null)
    )
  )

  const to = admins.map((admin: { email: string }) => admin.email).filter(Boolean)
  if (to.length > 0) {
    await sendEmail({
      to,
      subject: input.subject ?? input.title,
      react: React.createElement("div", null, [
        React.createElement("h2", { key: "h" }, input.title),
        React.createElement("p", { key: "p" }, input.body),
        React.createElement("p", { key: "a" }, `Open: ${input.actionUrl}`),
      ]),
    })
  }
}

export async function logSubadminActivity(input: {
  subadminId?: string | null
  actorId?: string | null
  action: string
  entity?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown>
}) {
  const meta = await getRequestMeta().catch(() => ({ ip: null, userAgent: null }))
  return prisma().subadminActivityLog.create({
    data: {
      subadminId: input.subadminId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  })
}

export async function createSubadminApplication(input: {
  name: string
  email: string
  phone?: string
  country?: string
  skills: string[]
  portfolioUrl?: string
  githubUrl?: string
  linkedinUrl?: string
  resumeUrl?: string
  motivation: string
}) {
  const setting = await getPortalSetting()
  if (!setting.enabled || !setting.applicationsOpen) {
    throw new Error("APPLICATION_PORTAL_CLOSED")
  }

  const application = await prisma().subadminApplication.upsert({
    where: { email: input.email.toLowerCase() },
    create: {
      ...input,
      email: input.email.toLowerCase(),
      status: "PENDING",
    },
    update: {
      name: input.name,
      phone: input.phone,
      country: input.country,
      skills: input.skills,
      portfolioUrl: input.portfolioUrl,
      githubUrl: input.githubUrl,
      linkedinUrl: input.linkedinUrl,
      resumeUrl: input.resumeUrl,
      motivation: input.motivation,
      status: "PENDING",
      adminNotes: null,
      reviewedById: null,
      reviewedAt: null,
    },
  })

  await notifySuperAdmins({
    title: "New subadmin application",
    body: `${application.name} (${application.email}) submitted a workforce application.`,
    actionUrl: "/admin/subadmins",
    metadata: { applicationId: application.id },
  }).catch(() => null)

  await sendEmail({
    to: application.email,
    subject: "NexusAI application received",
    react: React.createElement("div", null, [
      React.createElement("h2", { key: "h" }, "Application received"),
      React.createElement("p", { key: "p" }, "Your NexusAI team application is now pending review."),
    ]),
  }).catch(() => null)

  return application
}

export async function reviewSubadminApplication(input: {
  id: string
  status: "APPROVED" | "REJECTED" | "SHORTLISTED"
  adminNotes?: string
  admin: AdminSession
}) {
  const application = await prisma().subadminApplication.update({
    where: { id: input.id },
    data: {
      status: input.status,
      adminNotes: input.adminNotes ?? null,
      reviewedById: input.admin.userId,
      reviewedAt: new Date(),
    },
  })

  await logSubadminActivity({
    actorId: input.admin.userId,
    action: `APPLICATION_${input.status}`,
    entity: "SubadminApplication",
    entityId: application.id,
    metadata: { email: application.email, adminNotes: input.adminNotes },
  })

  await sendEmail({
    to: application.email,
    subject: `NexusAI application ${input.status.toLowerCase()}`,
    react: React.createElement("div", null, [
      React.createElement("h2", { key: "h" }, `Application ${input.status.toLowerCase()}`),
      React.createElement("p", { key: "p" }, input.adminNotes || "Your application status has been updated."),
    ]),
  }).catch(() => null)

  return application
}

export async function createSubadminAccount(input: {
  applicationId?: string
  name: string
  email: string
  username: string
  password: string
  permissions: Array<{ resource: string; action: string }>
  admin: AdminSession
}) {
  const email = input.email.toLowerCase()
  const passwordHash = await hash(input.password, 12)
  const rawToken = randomBytes(32).toString("hex")
  const accessTokenHash = sha256(rawToken)

  const user = await prisma().user.upsert({
    where: { email },
    create: {
      email,
      name: input.name,
      role: "SUB_ADMIN",
      isVerified: true,
      emailVerified: new Date(),
    },
    update: {
      name: input.name,
      role: "SUB_ADMIN",
      isBanned: false,
    },
    select: { id: true, email: true, name: true },
  })

  const account = await prisma().subadminAccount.upsert({
    where: { email },
    create: {
      userId: user.id,
      applicationId: input.applicationId || null,
      name: input.name,
      email,
      username: input.username,
      passwordHash,
      accessTokenHash,
      status: "ACTIVE",
      credentialsActive: true,
      createdById: input.admin.userId,
      updatedById: input.admin.userId,
      passwordChangedAt: new Date(),
      lastCredentialRotatedAt: new Date(),
    },
    update: {
      userId: user.id,
      name: input.name,
      username: input.username,
      passwordHash,
      accessTokenHash,
      status: "ACTIVE",
      credentialsActive: true,
      updatedById: input.admin.userId,
      passwordChangedAt: new Date(),
      lastCredentialRotatedAt: new Date(),
      forceLogoutVersion: { increment: 1 },
    },
  })

  await setSubadminPermissions(account.id, input.permissions, input.admin)

  if (input.applicationId) {
    await prisma().subadminApplication.update({
      where: { id: input.applicationId },
      data: { status: "APPROVED", reviewedById: input.admin.userId, reviewedAt: new Date() },
    }).catch(() => null)
  }

  await logSubadminActivity({
    subadminId: account.id,
    actorId: input.admin.userId,
    action: "SUBADMIN_CREDENTIALS_CREATED",
    entity: "SubadminAccount",
    entityId: account.id,
    metadata: { username: input.username, email },
  })

  await sendEmail({
    to: email,
    subject: "NexusAI admin credentials created",
    react: React.createElement("div", null, [
      React.createElement("h2", { key: "h" }, "Admin credentials created"),
      React.createElement("p", { key: "p" }, "Your NexusAI admin credentials are ready. Login with Google first, then enter the username and password provided by the Super Admin."),
    ]),
  }).catch(() => null)

  return { account, rawToken }
}

export async function setSubadminPermissions(
  subadminId: string,
  permissions: Array<{ resource: string; action: string }>,
  admin: AdminSession
) {
  const existing = await prisma().subadminPermission.findMany({ where: { subadminId } })
  const requested = new Set(permissions.map((p) => `${p.resource}:${p.action}`))

  await Promise.all(
    existing.map((permission: any) => {
      const key = `${permission.resource}:${permission.action}`
      if (requested.has(key)) return Promise.resolve(permission)
      return prisma().subadminPermission.update({
        where: { id: permission.id },
        data: { revokedAt: new Date(), revokeReason: "Removed by Super Admin" },
      })
    })
  )

  await Promise.all(
    permissions.map((permission) =>
      prisma().subadminPermission.upsert({
        where: {
          subadminId_resource_action: {
            subadminId,
            resource: permission.resource,
            action: permission.action,
          },
        },
        create: {
          subadminId,
          resource: permission.resource,
          action: permission.action,
          grantedById: admin.userId,
        },
        update: {
          revokedAt: null,
          revokeReason: null,
          grantedById: admin.userId,
          grantedAt: new Date(),
        },
      })
    )
  )

  await logSubadminActivity({
    subadminId,
    actorId: admin.userId,
    action: "SUBADMIN_PERMISSIONS_UPDATED",
    entity: "SubadminAccount",
    entityId: subadminId,
    metadata: { permissions },
  })
}

export async function updateSubadminStatus(input: {
  id: string
  status: "ACTIVE" | "SUSPENDED" | "DISABLED" | "REVOKED" | "PENDING"
  admin: AdminSession
  reason?: string
}) {
  const now = new Date()
  const account = await prisma().subadminAccount.update({
    where: { id: input.id },
    data: {
      status: input.status,
      updatedById: input.admin.userId,
      forceLogoutVersion: { increment: 1 },
      suspendedAt: input.status === "SUSPENDED" ? now : undefined,
      disabledAt: input.status === "DISABLED" ? now : undefined,
      revokedAt: input.status === "REVOKED" ? now : undefined,
      credentialsActive: input.status === "ACTIVE" ? true : input.status === "PENDING" ? false : false,
      sessions: {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: now },
        },
      },
    },
  })

  if (account.userId && input.status !== "ACTIVE") {
    await prisma().user.update({
      where: { id: account.userId },
      data: { isBanned: true, bannedAt: now, banReason: input.reason ?? `Subadmin ${input.status}` },
    }).catch(() => null)
  }

  if (account.userId && input.status === "ACTIVE") {
    await prisma().user.update({
      where: { id: account.userId },
      data: { isBanned: false, bannedAt: null, banReason: null, role: "SUB_ADMIN" },
    }).catch(() => null)
  }

  await logSubadminActivity({
    subadminId: account.id,
    actorId: input.admin.userId,
    action: `SUBADMIN_${input.status}`,
    entity: "SubadminAccount",
    entityId: account.id,
    metadata: { reason: input.reason },
  })

  await sendEmail({
    to: account.email,
    subject: `NexusAI admin account ${input.status.toLowerCase()}`,
    react: React.createElement("div", null, [
      React.createElement("h2", { key: "h" }, `Account ${input.status.toLowerCase()}`),
      React.createElement("p", { key: "p" }, input.reason || "Your NexusAI admin account status changed."),
    ]),
  }).catch(() => null)

  return account
}

export async function validateSubadminCredentialSession(userId: string, role: string) {
  if (role === "SUPER_ADMIN") return { allowed: true, reason: null }
  if (role !== "SUB_ADMIN") return { allowed: false, reason: "NOT_ADMIN" }

  const account = await prisma().subadminAccount.findFirst({
    where: {
      OR: [{ userId }],
      status: "ACTIVE",
      credentialsActive: true,
    },
    select: {
      id: true,
      forceLogoutVersion: true,
      permissions: { where: { revokedAt: null }, select: { id: true } },
    },
  })

  if (!account) return { allowed: false, reason: "NO_ACTIVE_SUBADMIN_ACCOUNT" }
  if (account.permissions.length === 0) return { allowed: false, reason: "NO_PERMISSIONS" }

  const cookieStore = await cookies()
  const token = cookieStore.get(SUBADMIN_SESSION_COOKIE)?.value
  if (!token) return { allowed: false, reason: "ADMIN_CREDENTIAL_LOGIN_REQUIRED" }

  const tokenHash = sha256(token)
  const session = await prisma().subadminSession.findUnique({
    where: { sessionTokenHash: tokenHash },
    select: { id: true, subadminId: true, expiresAt: true, revokedAt: true, forceLogoutVersion: true },
  })

  if (
    !session ||
    session.subadminId !== account.id ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.forceLogoutVersion !== account.forceLogoutVersion
  ) {
    return { allowed: false, reason: "ADMIN_CREDENTIAL_SESSION_INVALID" }
  }

  await prisma().subadminSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => null)

  return { allowed: true, reason: null }
}

export async function createCredentialSession(input: {
  userId: string
  email: string
  username: string
  password: string
}) {
  const account = await prisma().subadminAccount.findFirst({
    where: {
      username: input.username,
      email: input.email.toLowerCase(),
      status: "ACTIVE",
      credentialsActive: true,
    },
    include: { permissions: { where: { revokedAt: null } } },
  })

  if (!account || !account.passwordHash) {
    throw new Error("INVALID_ADMIN_CREDENTIALS")
  }
  if (account.lockedUntil && account.lockedUntil > new Date()) {
    throw new Error("ADMIN_CREDENTIALS_LOCKED")
  }
  if (account.userId && account.userId !== input.userId) {
    throw new Error("ADMIN_EMAIL_MISMATCH")
  }
  if (account.permissions.length === 0) {
    throw new Error("NO_ADMIN_PERMISSIONS")
  }

  const ok = await compare(input.password, account.passwordHash)
  if (!ok) {
    const failedLoginCount = account.failedLoginCount + 1
    await prisma().subadminAccount.update({
      where: { id: account.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    })
    throw new Error("INVALID_ADMIN_CREDENTIALS")
  }

  const token = randomBytes(32).toString("hex")
  const tokenHash = sha256(token)
  const meta = await getRequestMeta()
  const expiresAt = new Date(Date.now() + SUBADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma().subadminAccount.update({
    where: { id: account.id },
    data: {
      userId: input.userId,
      failedLoginCount: 0,
      lockedUntil: null,
      lastAdminLoginAt: new Date(),
    },
  })

  await prisma().subadminSession.create({
    data: {
      subadminId: account.id,
      sessionTokenHash: tokenHash,
      ip: meta.ip,
      userAgent: meta.userAgent,
      device: meta.userAgent?.slice(0, 180) ?? null,
      forceLogoutVersion: account.forceLogoutVersion,
      expiresAt,
    },
  })

  await logSubadminActivity({
    subadminId: account.id,
    actorId: input.userId,
    action: "SUBADMIN_CREDENTIAL_LOGIN",
    entity: "SubadminSession",
    metadata: { username: input.username },
  })

  return { token, expiresAt }
}

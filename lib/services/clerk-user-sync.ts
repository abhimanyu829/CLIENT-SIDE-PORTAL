import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

const userWithPermissions = {
  permissions: { include: { permission: true } },
} satisfies Prisma.UserInclude

export type SyncedClerkUser = Prisma.UserGetPayload<{
  include: typeof userWithPermissions
}>

export type ClerkUserProfile = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  imageUrl?: string | null
}

export function profileFromCurrentClerkUser(clerkUser: any): ClerkUserProfile | null {
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress

  if (!clerkUser?.id || !email) return null

  return {
    id: clerkUser.id,
    email,
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
    name: clerkUser.fullName ?? null,
    imageUrl: clerkUser.imageUrl ?? null,
  }
}

export function profileFromClerkWebhookData(data: any): ClerkUserProfile | null {
  const email =
    data?.primary_email_address_id
      ? data?.email_addresses?.find((item: any) => item.id === data.primary_email_address_id)?.email_address
      : data?.email_addresses?.[0]?.email_address

  if (!data?.id || !email) return null

  return {
    id: data.id,
    email,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url ?? null,
  }
}

export async function syncClerkUserToDatabase(
  profile: ClerkUserProfile,
  options: { updateLastLogin?: boolean } = {}
): Promise<SyncedClerkUser> {
  const email = profile.email.toLowerCase().trim()
  const displayName =
    profile.name ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    email

  return db.$transaction(async (tx) => {
    const [byClerkId, byEmail] = await Promise.all([
      tx.user.findUnique({
        where: { clerkUserId: profile.id },
        include: userWithPermissions,
      }),
      tx.user.findUnique({
        where: { email },
        include: userWithPermissions,
      }),
    ])

    if (byClerkId && byEmail && byClerkId.id !== byEmail.id) {
      throw new Error("CLERK_EMAIL_ALREADY_LINKED")
    }

    const existing = byClerkId ?? byEmail

    if (existing?.isBanned) {
      return existing
    }

    const sharedData = {
      clerkUserId: profile.id,
      name: displayName,
      isVerified: true,
      ...(profile.imageUrl && !existing?.avatarUrl ? { avatarUrl: profile.imageUrl } : {}),
      ...(options.updateLastLogin ? { lastLoginAt: new Date() } : {}),
    }

    if (existing) {
      return tx.user.update({
        where: { id: existing.id },
        data: sharedData,
        include: userWithPermissions,
      })
    }

    return tx.user.create({
      data: {
        email,
        ...sharedData,
      },
      include: userWithPermissions,
    })
  })
}

export async function anonymizeDeletedClerkUser(clerkUserId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { clerkUserId } })
    if (!user) return null

    return tx.user.update({
      where: { id: user.id },
      data: {
        clerkUserId: null,
        email: `deleted-${user.id}@nexus.local`,
        name: "Deleted User",
        isBanned: true,
        bannedAt: new Date(),
        banReason: "Clerk account deleted",
      },
    })
  })
}

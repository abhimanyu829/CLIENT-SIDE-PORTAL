import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

/**
 * On-demand sync endpoint for Clerk users.
 * Called by the frontend right after signup/login to ensure the database
 * has the user record immediately, bypassing webhook delays.
 *
 * NOTE: We call currentUser() directly from Clerk here instead of going
 * through the unified auth() helper. This is intentional — right after
 * setActive() the Clerk session cookie is fresh and currentUser() is the
 * most reliable way to read it server-side without a NextAuth roundtrip.
 */
export async function POST() {
  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      // Not authenticated via Clerk — nothing to sync
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      return NextResponse.json({ success: false, error: "No email on Clerk user" }, { status: 400 })
    }

    // Fast path: already linked
    let dbUser = await db.user.findUnique({
      where: { clerkUserId: clerkUser.id },
      select: { id: true, isBanned: true },
    })

    if (!dbUser) {
      // Slow path: try email-based lookup (existing user migrating to Clerk)
      const existing = await db.user.findUnique({
        where: { email },
        select: { id: true, isBanned: true, clerkUserId: true, avatarUrl: true },
      })

      if (existing && !existing.isBanned) {
        // Auto-link the existing record to this Clerk identity
        dbUser = await db.user.update({
          where: { id: existing.id },
          data: {
            clerkUserId: clerkUser.id,
            isVerified: true,
            lastLoginAt: new Date(),
            ...(existing.avatarUrl ? {} : { avatarUrl: clerkUser.imageUrl ?? undefined }),
          },
          select: { id: true, isBanned: true },
        })
      } else if (!existing) {
        // Brand-new user: create internal record
        const name =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email

        dbUser = await db.user.create({
          data: {
            email,
            name,
            clerkUserId: clerkUser.id,
            isVerified: true,
            avatarUrl: clerkUser.imageUrl ?? undefined,
            lastLoginAt: new Date(),
          },
          select: { id: true, isBanned: true },
        })
      } else {
        // existing user but banned
        return NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 })
      }
    }

    if (dbUser?.isBanned) {
      return NextResponse.json({ success: false, error: "Account suspended" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      userId: dbUser?.id,
    })
  } catch (error) {
    console.error("Manual clerk-sync failed:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

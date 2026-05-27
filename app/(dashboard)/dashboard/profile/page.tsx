import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import ProfileClient from "@/components/dashboard/ProfileClient"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      timezone: true,
      notifPrefs: true,
      isVerified: true,
      emailVerified: true,
      phoneVerified: true,
    },
  })

  if (!user) redirect("/login")

  return (
    <ProfileClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        timezone: user.timezone,
        notifPrefs: user.notifPrefs as any,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        phoneVerified: user.phoneVerified?.toISOString() ?? null,
      }}
    />
  )
}

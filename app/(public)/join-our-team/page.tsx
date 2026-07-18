import JoinOurTeamClient from "./JoinOurTeamClient"
import { getPortalSetting } from "@/lib/subadmin-workforce"

export default async function JoinOurTeamPage() {
  const setting = await getPortalSetting()

  if (!setting.enabled || !setting.applicationsOpen) {
    return (
      <main className="min-h-screen bg-background px-4 py-20 text-foreground">
        <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">NexusAI Workforce</p>
          <h1 className="mt-4 text-3xl font-semibold">Applications are closed</h1>
          <p className="mt-3 text-muted-foreground">
            The subadmin registration portal is currently disabled by the Super Admin.
          </p>
        </div>
      </main>
    )
  }

  return <JoinOurTeamClient />
}

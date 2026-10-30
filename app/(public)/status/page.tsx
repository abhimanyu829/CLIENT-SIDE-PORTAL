import type { Metadata } from "next"
import StatusClient from "./StatusClient"

export const revalidate = 60

export const metadata: Metadata = {
  title: "System Status & App Releases — NexusAI | ABHIBHIDEVELOPERS GROUP",
  description:
    "Real-time system telemetry, 90-day uptime monitoring, app services health checks, and upcoming NexusAI mobile and desktop app releases by Abhibhi Developers.",
}

export default function StatusPage() {
  return <StatusClient />
}

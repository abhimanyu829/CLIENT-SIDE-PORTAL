import type { Metadata } from "next"
import StatusClient from "./StatusClient"

export const revalidate = 60

export const metadata: Metadata = {
  title: "System Status & App Releases — Abhibhideveloper",
  description:
    "Real-time system telemetry, 90-day uptime monitoring, app services health checks, and upcoming mobile and desktop app releases by Abhibhideveloper.",
  alternates: { canonical: "https://abhibhideveloper.tech/status" },
}

export default function StatusPage() {
  return <StatusClient />
}
